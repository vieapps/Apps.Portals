import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { ContentTypeDefinition } from "@app/models/portals.base";

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

	private isSystemAdministrator = false;
	private canModerateOrganization = false;
	private systemID: string;
	private organization: Organization;
	private repositoryID: string;
	private definitionID: string;
	private definition: ContentTypeDefinition;
	private definitions: Array<ContentTypeDefinition>;
	private objects = new Array<ContentType>();

	title = "ContentTypes";
	filtering = false;
	contentTypes = new Array<ContentType>();
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
		contents: "View the list of contents",
		expressions: "Expressions",
		filter: "Quick filter",
		cancel: "Cancel",
		cache: "Clear cache",
		move: "Move content-type and contents to other module"
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
		const identity = this.definition !== undefined
			? `ContentTypes:${this.definitionID}:Refresh`
			: AppUtility.isNotEmpty(this.repositoryID)
				? `ContentTypes:${this.repositoryID}:Refresh`
				: "ContentTypes:Refresh";
		AppEvents.off(this.portalsCoreSvc.name, identity);
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.systemID = this.configSvc.requestParams["SystemID"];
		this.repositoryID = this.configSvc.requestParams["RepositoryID"];
		this.definitionID = this.configSvc.requestParams["DefinitionID"];

		this.organization = this.portalsCoreSvc.getOrganization(this.systemID);
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
			contents: await this.configSvc.getResourceAsync("portals.cms.common.buttons.list"),
			expressions: await this.configSvc.getResourceAsync("portals.expressions.title.list", { info: "" }),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title"),
			move: await this.configSvc.getResourceAsync("portals.contenttypes.list.move")
		};

		const title = await this.configSvc.getResourceAsync("portals.contenttypes.title.list");
		const titleInfo = AppUtility.isNotEmpty(this.repositoryID)
			? Module.contains(this.repositoryID)
				? Module.get(this.repositoryID).Title
				: undefined
			: this.organization !== undefined
				? this.organization.Title
				: undefined;
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: titleInfo !== undefined ? `[${titleInfo}]` : "" });

		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.contenttypes.title.create"), "create", () => this.createAsync()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
		];
		await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
		const identity = this.definition !== undefined
			? `ContentTypes:${this.definitionID}:Refresh`
			: AppUtility.isNotEmpty(this.repositoryID)
				? `ContentTypes:${this.repositoryID}:Refresh`
				: "ContentTypes:Refresh";
		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "Content.Type" && (info.args.Type === "Created" || info.args.Type === "Deleted")) {
				this.prepareResults();
			}
		}, identity);
	}

	track(index: number, contentType: ContentType) {
		return `${contentType.ID}@${index}`;
	}

	getInfo(contentType: ContentType) {
		const module = Module.get(contentType.RepositoryID);
		return `${(module !== undefined ? `Module: ${module.Title} - ` : "")}Definition: ${contentType.contentTypeDefinition.Title}${(AppUtility.isNotEmpty(contentType.Description) ? " - " + contentType.Description : "")}`;
	}

	canMove(contentType: ContentType) {
		const objectName = contentType.getObjectName(false);
		return this.isSystemAdministrator && ("Link" === objectName || "Item" === objectName);
	}

	onSearch(event: any) {
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			this.contentTypes = this.objects.filter(ContentType.getFilterBy(this.filterBy.Query));
		}
		else {
			this.contentTypes = this.objects.map(obj => obj);
		}
	}

	onClear() {
		this.filterBy.Query = undefined;
		this.contentTypes = this.objects.map(obj => obj);
	}

	async onCancel() {
		AppUtility.invoke(() => {
			this.onClear();
			this.filtering = false;
		}, 123);
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
		this.request = AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination);
		const onSuccess = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentURL);
		};
		await this.portalsCoreSvc.searchContentTypeAsync(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		const predicate: (contentType:  ContentType) => boolean = AppUtility.isNotEmpty(this.systemID) && AppUtility.isNotEmpty(this.repositoryID) && AppUtility.isNotEmpty(this.definitionID)
			? obj => obj.SystemID === this.systemID && obj.RepositoryID === this.repositoryID && obj.ContentTypeDefinitionID === this.definitionID
			: AppUtility.isNotEmpty(this.definitionID)
				? this.isSystemAdministrator
					? obj => obj.ContentTypeDefinitionID === this.definitionID
					: obj => obj.SystemID === this.systemID && obj.ContentTypeDefinitionID === this.definitionID
				: AppUtility.isNotEmpty(this.repositoryID)
					? obj => obj.RepositoryID === this.repositoryID
					: obj => obj.SystemID === this.systemID;
		let objects = results === undefined
			? ContentType.instances.toList(predicate)
			: ContentType.toList(results).Where(predicate);
		objects = objects.OrderBy(obj => obj.Title).ThenByDescending(obj => obj.LastModified);
		if (results === undefined && this.pagination !== undefined) {
			objects = objects.Take(this.pageNumber * this.pagination.PageSize);
		}
		this.contentTypes = results === undefined
			? objects.ToArray()
			: this.contentTypes.concat(objects.ToArray());
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
		this.filtering = true;
		PlatformUtility.focus(this.searchCtrl);
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
		this.objects = this.contentTypes.map(obj => obj);
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

	async clearCacheAsync(event: Event, contentType: ContentType) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.clearCacheAsync("content.type", contentType.ID);
	}

	async moveAsync(event: Event, contentType: ContentType) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.moveAsync(
			"ContentType",
			contentType.ID,
			{
				firstConfirm: await this.appFormsSvc.getResourceAsync("portals.contenttypes.list.moveFirstConfirm"),
				lastConfirm: await this.appFormsSvc.getResourceAsync("portals.contenttypes.list.moveLastConfirm"),
				explanation: await this.appFormsSvc.getResourceAsync("portals.contenttypes.list.moveExplanation"),
				noData: await this.appFormsSvc.getResourceAsync("portals.contenttypes.list.moveNoModule"),
				invalidData: await this.appFormsSvc.getResourceAsync("portals.contenttypes.list.moveInvalidModule"),
				done: await this.appFormsSvc.getResourceAsync("portals.contenttypes.list.moveDone")
			},
			(data: any, previousData?: any) => previousData !== undefined ? data.moduleID === previousData.moduleID : AppUtility.isNotEmpty(data.moduleID),
			[{
				type: "text",
				name: "moduleID",
				placeholder: "Module ID"
			}],
			data => {
				return { "x-module-id": data.moduleID };
			}
		);
		if (this.configSvc.isDebug) {
			console.log("<Portals>: move content-type and belong contents to other module", contentType);
		}
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("Content.Type", this.organization.ID);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync("Content.Type", this.organization.ID);
	}

}
