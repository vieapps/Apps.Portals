import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { NestedObject } from "@app/models/portals.base";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Link } from "@app/models/portals.cms.link";

@Component({
	selector: "page-portals-cms-links-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CmsLinksListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: false }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: false }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild("originalItems", { static: false }) private listCtrl: IonList;

	private subscription: Subscription;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private parentID: string;
	private children = "{{number}} children: {{children}}";

	canUpdate = false;
	canContribute = false;

	title = "Categories";
	parentLink: Link;
	links = new Array<Link>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { OrderIndex: "Ascending", Title: "Ascending" };
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;
	labels = {
		children: "View the children",
		view: "View this link",
		edit: "Edit",
		refresh: "refresh",
		expression: "Create new expression",
		save: "Save",
		cancel: "Cancel"
	};
	processing = false;
	redordering = false;
	reorderItems: Array<NestedObject>;
	private hash = "";
	private ordered: Array<NestedObject>;

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	get gotPagination() {
		return this.pagination !== undefined || this.parentLink !== undefined;
	}

	get totalDisplays() {
		return this.parentLink !== undefined
			? this.parentLink.childrenIDs.length
			: AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.parentLink !== undefined
			? this.parentLink.childrenIDs.length
			: this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			if (this.parentLink !== undefined) {
				AppEvents.off(this.portalsCoreSvc.name, `CMS.Links:${this.parentLink.ID}:Refresh`);
			}
			else {
				AppEvents.off(this.portalsCoreSvc.name, "CMS.Links:Refresh");
			}
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const contentTypeID = this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"];
		this.contentType = ContentType.get(contentTypeID);
		if (this.contentType === undefined && AppUtility.isNotEmpty(contentTypeID)) {
			await this.portalsCoreSvc.getContentTypeAsync(contentTypeID, _ => this.contentType = ContentType.get(contentTypeID), undefined, true);
		}

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.backAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = ContentType.get(contentTypeID);
		}

		this.module = this.contentType !== undefined
			? Module.get(this.contentType.RepositoryID)
			: await this.portalsCoreSvc.getActiveModuleAsync();

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfLink(this.module);

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Link", this.contentType === undefined ? undefined : this.contentType.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Link", this.contentType === undefined ? undefined : this.contentType.Privileges);
		if (!this.canContribute) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Mode: "UpdateSidebarWithContentTypes" });

		this.labels = {
			children: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.view"),
			edit: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.edit"),
			expression: await this.configSvc.getResourceAsync("portals.expressions.title.create"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			save: await this.configSvc.getResourceAsync("common.buttons.save"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		this.children = await this.configSvc.getResourceAsync("portals.cms.links.list.children");
		await this.prepareTitleAsync();

		if (this.searching) {
			this.prepareFilterBy(false);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.links.list.search");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.search"), "search", () => this.openSearchAsync())
			];
			if (this.canUpdate) {
				this.actions.insert(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.reorder"), "swap-vertical", () => this.openReorderAsync()), 1);
				this.actions.push(
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
				);
			}

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentLink = Link.get(this.parentID);

			if (this.parentLink !== undefined) {
				this.contentType = this.parentLink.contentType;
				this.module = this.parentLink.module;
				this.organization = this.parentLink.organization;
				this.prepareLinks();
				await this.prepareTitleAsync();
				await this.appFormsSvc.hideLoadingAsync();
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Link") {
						this.prepareLinks();
					}
				}, `CMS.Links:${this.parentLink.ID}:Refresh`);
			}
			else {
				this.prepareFilterBy();
				await this.prepareTitleAsync();
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Link") {
						this.prepareResults();
					}
				}, "CMS.Links:Refresh");
			}
		}

		if (this.configSvc.isDebug) {
			console.log("<CMS Portals>: Links (request info)", this.configSvc.requestParams, this.filterBy, this.sortBy);
			console.log("<CMS Portals>: Links (management info)", `\n- Organization:`, this.organization, `\n- Module:`, this.module, `\n- Content Type:`, this.contentType);
		}
	}

	private async prepareTitleAsync() {
		if (this.redordering) {
			this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("portals.cms.links.title.reorder");
		}
		else {
			const title = await this.configSvc.getResourceAsync(`portals.cms.links.title.${(this.searching ? "search" : "list")}`);
			this.configSvc.appTitle = this.title = AppUtility.format(title, { info: this.parentLink !== undefined ? `[${this.parentLink.FullTitle}]` : this.contentType === undefined && this.organization === undefined ? "" : `[${(this.contentType === undefined ? this.organization.Title : this.organization.Title + " :: " + this.contentType.Title)}]` });
		}
	}

	private prepareFilterBy(addParentID: boolean = true) {
		this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
		if (this.module !== undefined) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.module.ID } });
		}
		if (this.contentType !== undefined) {
			this.filterBy.And.push({ RepositoryEntityID: { Equals: this.contentType.ID } });
		}
		if (addParentID) {
			this.filterBy.And.push({ ParentID: "IsNull" });
		}
	}

	private prepareLinks() {
		this.links = this.parentLink.Children;
		if (this.configSvc.isDebug) {
			console.log("<CMS Portals>: Links (children)", this.links);
		}
	}

	track(index: number, item: any) {
		return `${item.ID}@${index}`;
	}

	getInfo(link: Link) {
		return link.childrenIDs === undefined || link.childrenIDs.length < 1
			? link.URL
			: AppUtility.format(this.children, { number: link.childrenIDs.length, children: `${link.Children[0].Title}${(link.childrenIDs.length > 1 ? `, ${link.Children[1].Title}` : "")}, ...` });
	}

	onSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.links = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.searchAsync(() => this.infiniteScrollCtrl.disabled = false);
			}
			else {
				this.prepareResults();
			}
		}
	}

	onClear() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.links = [];
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
		return this.portalsCoreSvc.getPaginationPrefix("cms.link");
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
			this.subscription = this.portalsCmsSvc.searchLink(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCmsSvc.searchLinkAsync(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
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
			(results || []).forEach(o => this.links.push(Link.get(o.ID) || Link.deserialize(o, Link.get(o.ID))));
		}
		else {
			const predicate: (link: Link) => boolean = obj => obj.SystemID === this.organization.ID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true) && obj.ParentID === this.parentID;
			let objects = results === undefined
				? Link.instances.toArray(predicate)
				: Link.toArray(results).filter(predicate);
			objects = objects.sortBy("OrderIndex", "Title");
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.take(this.pageNumber * this.pagination.PageSize);
			}
			this.links = results === undefined
				? objects
				: this.links.concat(objects);
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
		await this.configSvc.navigateForwardAsync("/portals/cms/links/search");
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		const params: { [key: string]: string } = {};
		if (AppUtility.isNotEmpty(this.parentID)) {
			params["ParentID"] = this.parentID;
		}
		if (this.contentType !== undefined) {
			params["RepositoryEntityID"] = this.contentType.ID;
			await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, params));
		}
	}

	async viewAsync(event: Event, link: Link) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(link.routerURI);
	}

	async editAsync(event: Event, link: Link) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		if (this.canUpdate) {
			await this.configSvc.navigateForwardAsync(link.routerURI.replace("/view/", "/update/"));
		}
	}

	async showChildrenAsync(event: Event, link: Link) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(link.listURI);
	}

	async refreshAsync(event: Event, link: Link) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCmsSvc.refreshLinkAsync(link.ID, async _ => await this.appFormsSvc.showToastAsync("The link was freshen-up"));
	}

	async createExpressionAsync(event: Event, link: Link) {
		const contentType = link.contentType;
		const params = AppUtility.isObject(contentType, true)
			? {
				Title: `Children of ${link.Title}`,
				RepositoryID: contentType.RepositoryID,
				RepositoryEntityID: contentType.ID,
				ContentTypeDefinitionID: contentType.ContentTypeDefinitionID,
				Filter: {
					Operator: "And",
					Children: [{
						Attribute: "ParentID",
						Operator: "Equals",
						Value: link.ID
					}]
				}
			}
			: undefined;
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "create", link.ansiTitle, params, "expression", "core"));
	}

	private async backAsync(message: string, url?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message,
			undefined,
			async () => await this.configSvc.navigateHomeAsync(url),
			await this.configSvc.getResourceAsync("common.buttons.ok")
		);
	}

	private async openReorderAsync() {
		this.reorderItems = this.links.sortBy("OrderIndex", "Title").map(c => {
			return {
				ID: c.ID,
				Title: c.Title,
				OrderIndex: c.OrderIndex
			} as NestedObject;
		});
		this.ordered = this.reorderItems.map(c => {
			return {
				ID: c.ID,
				Title: c.Title,
				OrderIndex: c.OrderIndex
			} as NestedObject;
		});
		this.hash = AppCrypto.hash(this.ordered);
		this.redordering = true;
		await this.prepareTitleAsync();
	}

	onReordered(event: any) {
		try {
			this.ordered.move(event.detail.from as number, event.detail.to as number).forEach((category, orderIndex) => category.OrderIndex = orderIndex);
		}
		catch (error) {
			console.error("Error occurred while reordering", error);
		}
		event.detail.complete();
	}

	async doReorderAsync() {
		if (this.hash !== AppCrypto.hash(this.ordered)) {
			this.processing = true;
			await this.appFormsSvc.showLoadingAsync(this.title);
			const reordered = this.ordered.toList().Select(category => {
				return {
					ID: category.ID,
					OrderIndex: category.OrderIndex
				};
			}).ToArray();
			await this.portalsCmsSvc.updateLinkAsync(
				{
					LinkID: this.parentLink === undefined ? undefined : this.parentLink.ID,
					SystemID: this.organization === undefined ? undefined : this.organization.ID,
					RepositoryID: this.module === undefined ? undefined : this.module.ID,
					RepositoryEntityID: this.contentType === undefined ? undefined : this.contentType.ID,
					Links: reordered
				},
				async _ => {
					this.links.forEach(link => link.OrderIndex = reordered.find(i => i.ID === link.ID).OrderIndex);
					if (this.parentLink !== undefined) {
						this.prepareLinks();
					}
					await this.cancelReorderAsync(() => this.processing = false);
				},
				async error => {
					this.processing = false;
					await this.appFormsSvc.showErrorAsync(error);
				},
				{
					"x-update": "order-index"
				}
			);
		}
		else {
			await this.cancelReorderAsync();
		}
	}

	async cancelReorderAsync(onNext?: () => void) {
		this.redordering = false;
		await this.prepareTitleAsync();
		await this.appFormsSvc.hideLoadingAsync(onNext);
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("CMS.Link", this.organization.ID, this.module !== undefined ? this.module.ID : undefined, this.contentType !== undefined ? this.contentType.ID : undefined);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Link",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			async _ => {
				await this.appFormsSvc.showLoadingAsync();
				this.links = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Link.instances
					.toArray(link => this.contentType !== undefined ? this.contentType.ID === link.RepositoryEntityID : this.organization.ID === link.SystemID)
					.map(link => link.ID)
					.forEach(id => Link.instances.remove(id));
				await this.startSearchAsync(async () => await this.appFormsSvc.showAlertAsync(
					"Excel",
					await this.configSvc.getResourceAsync("portals.common.excel.message.import"),
					undefined,
					undefined,
					await this.configSvc.getResourceAsync("common.buttons.close")
				));
			}
		);
	}

}
