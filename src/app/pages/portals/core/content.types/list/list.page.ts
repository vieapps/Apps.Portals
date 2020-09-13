import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { PlatformUtility } from "@components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@components/app.pagination";
import { AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { ContentTypeDefinition } from "@models/portals.base";

@Component({
	selector: "page-portals-core-content-types-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsContentTypesListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private isSystemAdministrator = false;
	private canModerateOrganization = false;
	private systemID: string;
	private organization: Organization;
	private repositoryID: string;
	private module: Module;
	private definitionID: string;
	private definition: ContentTypeDefinition;
	private definitions: Array<ContentTypeDefinition>;

	title = "ContentTypes";
	contentTypes = new Array<ContentType>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { Title: "Ascending" };
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;
	labels = {
		edit: "Update this content type",
		advancedEdit: "Update this content type in advanced mode",
		showContents: "View the list of contents",
		showExpressions: "Expressions"
	};

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	get totalDisplays() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			let identity = "ContentTypes:Refresh";
			if (this.definition !== undefined) {
				identity = `ContentTypes:${this.definitionID}:Refresh`;
			}
			else if (AppUtility.isNotEmpty(this.repositoryID)) {
				identity = `ContentTypes:${this.repositoryID}:Refresh`;
			}
			AppEvents.off(this.portalsCoreSvc.name, identity);
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.systemID = this.configSvc.requestParams["SystemID"];
		this.repositoryID = this.configSvc.requestParams["RepositoryID"];
		this.definitionID = this.configSvc.requestParams["DefinitionID"];

		this.organization = this.portalsCoreSvc.getOrganization(this.systemID);
		this.module = Module.get(this.repositoryID);
		this.definitions = this.portalsCoreSvc.contentTypeDefinitions;
		this.definition = AppUtility.isNotEmpty(this.definitionID) ? this.definitions.find(definition => definition.ID === this.definitionID) : undefined;

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		if (!this.isSystemAdministrator && this.organization === undefined) {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		if (!AppUtility.isNotEmpty(this.systemID) && !AppUtility.isNotEmpty(this.repositoryID) && !AppUtility.isNotEmpty(this.definitionID) && this.organization !== undefined) {
			this.systemID = this.organization.ID;
		}

		if (AppUtility.isNotEmpty(this.systemID)) {
			this.filterBy.And.push({ SystemID: { Equals: this.systemID } });
		}
		if (AppUtility.isNotEmpty(this.repositoryID)) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.repositoryID } });
		}
		if (this.definition !== undefined) {
			this.filterBy.And.push({ ContentTypeDefinitionID: { Equals: this.definitionID } });
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			advancedEdit: await this.configSvc.getResourceAsync("portals.common.advancedEdit"),
			showContents: await this.configSvc.getResourceAsync("portals.cms.common.buttons.list"),
			showExpressions: await this.configSvc.getResourceAsync("portals.expressions.title.list", { info: "" })
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.contenttypes.title.${(this.searching ? "search" : "list")}`);
		const titleInfo = AppUtility.isNotEmpty(this.repositoryID)
			? Module.contains(this.repositoryID)
				? Module.get(this.repositoryID).Title
				: undefined
			: this.organization !== undefined
				? this.organization.Title
				: undefined;
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: titleInfo !== undefined ? `[${titleInfo}]` : "" });

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.contenttypes.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.contenttypes.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.contenttypes.title.search"), "search", () => this.openSearchAsync())
			];
			await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
			let identity = "ContentTypes:Refresh";
			if (this.definition !== undefined) {
				identity = `ContentTypes:${this.definitionID}:Refresh`;
			}
			else if (AppUtility.isNotEmpty(this.repositoryID)) {
				identity = `ContentTypes:${this.repositoryID}:Refresh`;
			}
			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "Content.Type" && (info.args.Type === "Created" || info.args.Type === "Deleted")) {
					this.prepareResults();
				}
			}, identity);
		}

		if (this.configSvc.isDebug) {
			console.log("<Portals>: ContentTypes", this.configSvc.requestParams, this.filterBy, this.sortBy);
		}
	}

	track(index: number, contentType: ContentType) {
		return `${contentType.ID}@${index}`;
	}

	getInfo(contentType: ContentType) {
		const module = Module.get(contentType.RepositoryID);
		const contentTypeDefinition = Organization.contentTypeDefinitions.find(definition => definition.ID === contentType.ContentTypeDefinitionID);
		return `${(module !== undefined ? `Module: ${module.Title} - ` : "")}Definition: ${contentTypeDefinition.Title}${(AppUtility.isNotEmpty(contentType.Description) ? " - " + contentType.Description : "")}`;
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.contentTypes = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.searchAsync(() => this.infiniteScrollCtrl.disabled = false);
			}
			else {
				this.prepareResults();
			}
		}
	}

	onClearSearch() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.contentTypes = [];
	}

	onCancelSearch() {
		this.onClearSearch();
		this.startSearchAsync();
	}

	async onInfiniteScrollAsync() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchAsync(async () => {
				if (this.infiniteScrollCtrl !== undefined) {
					await this.infiniteScrollCtrl.complete();
				}
			});
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("content.type");
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchContentType(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCoreSvc.searchContentTypeAsync(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
	}

	private cancelSearch(dontDisableInfiniteScroll?: boolean) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isFalse(dontDisableInfiniteScroll)) {
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.contentTypes.push(ContentType.get(o.ID) || ContentType.deserialize(o, ContentType.get(o.ID))));
		}
		else {
			let objects = new List(results === undefined ? ContentType.all : results.map(o => ContentType.get(o.ID) || ContentType.deserialize(o, ContentType.get(o.ID))));
			if (AppUtility.isNotEmpty(this.systemID) && AppUtility.isNotEmpty(this.repositoryID) && AppUtility.isNotEmpty(this.definitionID)) {
				objects = objects.Where(o => o.SystemID === this.systemID && o.RepositoryID === this.repositoryID && o.ContentTypeDefinitionID === this.definitionID);
			}
			else if (AppUtility.isNotEmpty(this.definitionID)) {
				if (this.isSystemAdministrator) {
					objects = objects.Where(o => o.ContentTypeDefinitionID === this.definitionID);
				}
				else {
					objects = objects.Where(o => o.SystemID === this.systemID && o.ContentTypeDefinitionID === this.definitionID);
				}
			}
			else if (AppUtility.isNotEmpty(this.repositoryID)) {
				objects = objects.Where(o => o.RepositoryID === this.repositoryID);
			}
			else {
				objects = objects.Where(o => o.SystemID === this.systemID);
			}
			objects = objects.OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.contentTypes = results === undefined
				? objects.ToArray()
				: this.contentTypes.concat(objects.ToArray());
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	async showActionsAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async openSearchAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync("/portals/core/content.types/search");
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync("/portals/core/content.types/create");
	}

	async editAsync(event: Event, contentType: ContentType, isAdvancedMode: boolean = false) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(contentType.getRouterURI({ ID: contentType.ID, Advanced: isAdvancedMode }));
	}

	async showContentsAsync(event: Event, contentType: ContentType) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(contentType));
	}

	async showExpressionsAsync(event: Event, contentType: ContentType) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(contentType, undefined, undefined, undefined, "expression", "core"));
	}

}
