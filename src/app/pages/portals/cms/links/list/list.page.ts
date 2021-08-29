import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
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

	title = {
		page: "Links",
		track: "Links"
	};
	parentLink: Link;
	links = new Array<Link>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
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

		this.searching = this.configSvc.currentURL.indexOf("/search") > 0;
		this.title.track = this.redordering
			? await this.configSvc.getResourceAsync("portals.cms.links.title.reorder")
			: AppUtility.format(await this.configSvc.getResourceAsync(`portals.cms.links.title.${(this.searching ? "search" : "list")}`), { info: "" });

		const contentTypeID = this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"];
		this.contentType = ContentType.get(contentTypeID);
		if (this.contentType === undefined && AppUtility.isNotEmpty(contentTypeID)) {
			await this.portalsCoreSvc.getContentTypeAsync(contentTypeID, _ => this.contentType = ContentType.get(contentTypeID), undefined, true);
		}

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | No Organization`, "Check");
			this.appFormsSvc.hideLoadingAsync(async () => this.back(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
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
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Type: "UpdateSidebar", Mode: "ContentTypes" });

		this.labels = {
			children: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.view"),
			edit: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.edit"),
			expression: await this.configSvc.getResourceAsync("portals.expressions.title.create"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			save: await this.configSvc.getResourceAsync("common.buttons.save"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.children = await this.configSvc.getResourceAsync("portals.cms.links.list.children");

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.links.list.search");
			this.prepareFilterBy(false);
			this.prepareTitleAsync().then(() => this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl)));
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.search"), "search", () => this.openSearch())
			];
			if (this.canUpdate) {
				this.actions.insert(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.reorder"), "swap-vertical", () => this.openReorder()), 1);
				this.actions.push(
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel())
				);
				this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll()));
			}

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentLink = Link.get(this.parentID);

			if (this.parentLink !== undefined) {
				this.contentType = this.parentLink.contentType;
				this.module = this.parentLink.module;
				this.organization = this.parentLink.organization;
				this.prepareLinks();
				this.prepareTitleAsync().then(() => this.appFormsSvc.hideLoadingAsync());
				AppEvents.on(this.portalsCoreSvc.name, info => {
					const args = info.args;
					if (args.Object === "CMS.Link" && ("Created" === args.Type || "Updated" === args.Type || "Deleted" === args.Type) && this.parentID === args.ParentID) {
						this.prepareLinks();
					}
				}, `CMS.Links:${this.parentLink.ID}:Refresh`);
			}
			else {
				this.prepareFilterBy();
				this.prepareTitleAsync().then(() => this.startSearch(() => this.appFormsSvc.hideLoadingAsync()));
				AppEvents.on(this.portalsCoreSvc.name, info => {
					const args = info.args;
					if (args.Object === "CMS.Link" && ("Created" === args.Type || "Updated" === args.Type || "Deleted" === args.Type)) {
						this.prepareResults();
					}
				}, "CMS.Links:Refresh");
			}
		}
	}

	private async prepareTitleAsync() {
		if (this.redordering) {
			this.configSvc.appTitle = this.title.page = await this.configSvc.getResourceAsync("portals.cms.links.title.reorder");
		}
		else {
			const title = await this.configSvc.getResourceAsync(`portals.cms.links.title.${(this.searching ? "search" : "list")}`);
			this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: this.parentLink !== undefined ? `[${this.parentLink.FullTitle}]` : this.contentType === undefined && this.organization === undefined ? "" : `[${(this.contentType === undefined ? this.organization.Title : this.organization.Title + " :: " + this.contentType.Title)}]` });
		}
	}

	private prepareFilterBy(addParentID: boolean = true) {
		this.filterBy.And = this.contentType !== undefined
			? [
					{ SystemID: { Equals: this.contentType.SystemID } },
					{ RepositoryID: { Equals: this.contentType.RepositoryID } },
					{ RepositoryEntityID: { Equals: this.contentType.ID } }
				]
			: this.module !== undefined
				? [
						{ SystemID: { Equals: this.module.SystemID } },
						{ RepositoryID: { Equals: this.module.ID } }
					]
				: [{ SystemID: { Equals: this.organization.ID } }];
		if (addParentID) {
			this.filterBy.And.push({ ParentID: this.parentLink !== undefined ? { Equals: this.parentLink.ID } : "IsNull" });
		}
	}

	private prepareLinks() {
		this.links = this.parentLink.Children;
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
				this.search(() => this.infiniteScrollCtrl.disabled = false);
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

	onCancel() {
		this.configSvc.navigateBackAsync();
	}

	onInfiniteScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.search(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : undefined);
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("cms.link");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title.track);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchLink(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
		else {
			this.portalsCmsSvc.searchLinkAsync(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
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
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "search")));
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, Link.getParams(this.filterBy))));
	}

	view(event: Event, link: Link) {
		this.do(() => this.configSvc.navigateForwardAsync(link.routerURI), event);
	}

	edit(event: Event, link: Link) {
		this.do(this.canUpdate ? () => this.configSvc.navigateForwardAsync(link.routerURI.replace("/view/", "/update/")) : () => {}, event);
	}

	showChildren(event: Event, link: Link) {
		this.do(() => this.configSvc.navigateForwardAsync(link.listURI), event);
	}

	doRefresh(links: Link[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title.track, "Refresh");
			if (index < links.length - 1) {
				AppUtility.invoke(() => this.doRefresh(links, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0 && links.length > 1) {
			this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug ? () => console.log(`--- Start to refresh ${links.length} CMS links -----------------`) : () => {});
		}
		this.portalsCmsSvc.refreshLinkAsync(links[index].ID, refreshNext, refreshNext, undefined, useXHR);
	}

	refresh(event: Event, link: Link) {
		this.do(() => this.doRefresh([link], 0, true, () => this.appFormsSvc.showToastAsync("The link was freshen-up")), event);
	}

	refreshAll() {
		const links = Link.instances.toArray(link => link.SystemID === this.organization.ID);
		if (links.length > 0) {
			this.doRefresh(links, 0, false, () => Promise.all(this.organization.modules.map(module => this.portalsCmsSvc.getContentTypesOfLink(module))
				.flatMap(contentypes => contentypes)
				.map(contentType => this.portalsCmsSvc.searchLinksAsync(contentType, undefined, undefined, true))).then(() => this.appFormsSvc.showToastAsync("All links was freshen-up"))
			);
		}
	}

	createExpression(event: Event, link: Link) {
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
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "create", link.ansiTitle, params, "expression", "core")), event);
	}

	private back(message: string, url?: string) {
		this.appFormsSvc.showConfirmAsync(message, () => this.configSvc.navigateBackAsync(url));
	}

	private openReorder() {
		this.reorderItems = this.links.sortBy("OrderIndex", "Title").map(c => ({
			ID: c.ID,
			Title: c.Title,
			OrderIndex: c.OrderIndex
		} as NestedObject));
		this.ordered = this.reorderItems.map(c => ({
			ID: c.ID,
			Title: c.Title,
			OrderIndex: c.OrderIndex
		} as NestedObject));
		this.hash = AppCrypto.hash(this.ordered);
		this.redordering = true;
		this.prepareTitleAsync();
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

	doReorder() {
		if (this.hash !== AppCrypto.hash(this.ordered)) {
			this.processing = true;
			const reordered = this.ordered.toList().Select(category => ({
				ID: category.ID,
				OrderIndex: category.OrderIndex
			})).ToArray();
			this.appFormsSvc.showLoadingAsync(this.title.page).then(() => this.portalsCmsSvc.updateLinkAsync(
				{
					LinkID: this.parentLink === undefined ? undefined : this.parentLink.ID,
					SystemID: this.organization === undefined ? undefined : this.organization.ID,
					RepositoryID: this.module === undefined ? undefined : this.module.ID,
					RepositoryEntityID: this.contentType === undefined ? undefined : this.contentType.ID,
					Links: reordered
				},
				() => {
					this.links.forEach(link => link.OrderIndex = reordered.find(i => i.ID === link.ID).OrderIndex);
					if (this.parentLink !== undefined) {
						this.prepareLinks();
					}
					this.trackAsync(this.title.track, "ReOrder").then(() => this.cancelReorder(() => this.processing = false));
				},
				error => this.trackAsync(this.title.track, "ReOrder").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false),
				{
					"x-update": "order-index"
				}
			));
		}
		else {
			this.cancelReorder();
		}
	}

	cancelReorder(onNext?: () => void) {
		this.redordering = false;
		this.prepareTitleAsync().then(() => this.appFormsSvc.hideLoadingAsync(onNext));
	}

	exportToExcel() {
		this.portalsCoreSvc.exportToExcelAsync(
			"CMS.Link",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined
		).then(() => this.trackAsync(this.actions[2].text, "Export"));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Link",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			() => this.appFormsSvc.showLoadingAsync().then(() => this.trackAsync(this.actions[3].text, "Import")).then(() => {
				this.links = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Link.instances
					.toArray(link => this.contentType !== undefined ? this.contentType.ID === link.RepositoryEntityID : this.organization.ID === link.SystemID)
					.map(link => link.ID)
					.forEach(id => Link.instances.remove(id));
				this.startSearch(async () => this.appFormsSvc.showConfirmAsync(await this.configSvc.getResourceAsync("portals.common.excel.message.import"), undefined, await this.configSvc.getResourceAsync("common.buttons.close")));
			})
		);
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Link", action: action || (this.searching ? "Search" : "Browse") });
	}

}
