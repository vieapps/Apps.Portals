import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
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

	title = {
		track: "ContentTypes",
		page: "ContentTypes"
	};
	filtering = false;
	contentTypes = new Array<ContentType>();
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
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
		versions: "Versions",
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
			await this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateRootAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		const title = await this.configSvc.getResourceAsync("portals.contenttypes.title.list");
		this.title.track = AppUtility.format(title, { info: "" });

		if (!this.canModerateOrganization) {
			await this.trackAsync(`${this.title.track} | No Permission`, "Check");
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
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
			versions: await this.configSvc.getResourceAsync("versions.view"),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title"),
			move: await this.configSvc.getResourceAsync("portals.contenttypes.list.move")
		};

		const titleInfo = AppUtility.isNotEmpty(this.repositoryID)
			? Module.contains(this.repositoryID)
				? Module.get(this.repositoryID).Title
				: undefined
			: this.organization !== undefined
				? this.organization.Title
				: undefined;
		this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: titleInfo !== undefined ? `[${titleInfo}]` : "" });

		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.contenttypes.title.create"), "create", () => this.create()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll())
		];

		this.startSearch(() => this.appFormsSvc.hideLoadingAsync());

		const identity = this.definition !== undefined
			? `ContentTypes:${this.definitionID}:Refresh`
			: AppUtility.isNotEmpty(this.repositoryID)
				? `ContentTypes:${this.repositoryID}:Refresh`
				: "ContentTypes:Refresh";
		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "Content.Type" && info.args.SystemID === this.organization.ID) {
				if (info.args.Type === "Created" || info.args.Type === "Deleted") {
					AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy), this.paginationPrefix);
				}
				if (info.args.Type === "Deleted") {
					ContentType.instances.remove(info.args.ID);
					this.contentTypes.removeAt(this.contentTypes.findIndex(contentType => contentType.ID === info.args.ID));
				}
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
			this.onClear();
		}
	}

	onClear(isOnCanceled?: boolean) {
		if (this.filtering) {
			this.filterBy.Query = undefined;
			this.contentTypes = this.objects.map(object => object);
			if (isOnCanceled) {
				this.filtering = false;
				this.objects = [];
			}
		}
	}

	onCancel() {
		this.onClear(true);
	}

	onInfiniteScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.search(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : () => {});
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("content.type");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title.track);
		};
		this.portalsCoreSvc.searchContentTypesAsync(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		const predicate: (contentType:  ContentType) => boolean = AppUtility.isNotEmpty(this.systemID) && AppUtility.isNotEmpty(this.repositoryID) && AppUtility.isNotEmpty(this.definitionID)
			? object => object.SystemID === this.systemID && object.RepositoryID === this.repositoryID && object.ContentTypeDefinitionID === this.definitionID
			: AppUtility.isNotEmpty(this.definitionID)
				? this.isSystemAdministrator
					? object => object.ContentTypeDefinitionID === this.definitionID
					: object => object.SystemID === this.systemID && object.ContentTypeDefinitionID === this.definitionID
				: AppUtility.isNotEmpty(this.repositoryID)
					? object => object.RepositoryID === this.repositoryID
					: object => object.SystemID === this.systemID;
		const objects = (results === undefined ? ContentType.instances.toArray(predicate) : ContentType.toArray(results).filter(predicate))
			.sortBy("Title", { name: "LastModified", reverse: true })
			.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
		this.contentTypes = results === undefined ? objects : this.contentTypes.concat(objects);
		if (onNext !== undefined) {
			onNext();
		}
	}

	private doRefresh(contentTypes: ContentType[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title.track, "Refresh");
			if (index < contentTypes.length - 1) {
				AppUtility.invoke(() => this.doRefresh(contentTypes, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0 && contentTypes.length > 1) {
			this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug ? () => console.log(`--- Start to refresh ${contentTypes.length} content-types -----------------`) : () => {});
		}
		this.portalsCoreSvc.refreshContentTypeAsync(contentTypes[index].ID, refreshNext, refreshNext, undefined, useXHR);
	}

	private do(action: () => void, event?: Event) {
		if (event !== undefined) {
			event.stopPropagation();
		}
		this.listCtrl.closeSlidingItems().then(() => action());
	}

	showActions() {
		this.do(() => this.appFormsSvc.showActionSheetAsync(this.actions));
	}

	openSearch() {
		this.do(async () => {
			this.filtering = true;
			this.objects = this.contentTypes.map(obj => obj);
			this.infiniteScrollCtrl.disabled = true;
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
			PlatformUtility.focus(this.searchCtrl);
		});
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync("/portals/core/content.types/create"));
	}

	edit(event: Event, contentType: ContentType, isAdvancedMode: boolean = false) {
		this.do(() => this.configSvc.navigateForwardAsync(contentType.getRouterURI({ ID: contentType.ID, Advanced: isAdvancedMode })), event);
	}

	showContents(event: Event, contentType: ContentType) {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(contentType)), event);
	}

	showExpressions(event: Event, contentType: ContentType) {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(contentType, undefined, undefined, undefined, "expression", "core")), event);
	}

	refresh(event: Event, contentType: ContentType) {
		this.do(() => this.doRefresh([contentType], 0, true, () => this.appFormsSvc.showToastAsync("The content-type was freshen-up")), event);
	}

	refreshAll() {
		this.doRefresh(this.contentTypes, 0, false, () => this.appFormsSvc.showToastAsync("All the content-types were freshen-up"));
	}

	clearCache(event: Event, contentType: ContentType) {
		this.do(() => this.portalsCoreSvc.clearCacheAsync("content.type", contentType.ID), event);
	}

	move(event: Event, contentType: ContentType) {
		this.do(async () => this.portalsCoreSvc.moveAsync(
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
		).then(() => this.trackAsync(this.title.track, "Move")), event);
	}

	viewVersions(event: Event, contentType: ContentType) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(contentType.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "ContentType", id: contentType.ID })), event);
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("Content.Type", this.organization.ID);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync("Content.Type", this.organization.ID).then(() => this.trackAsync(this.actions[3].text, "Import"));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "ContentType", action: action || "Browse" });
	}

}
