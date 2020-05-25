import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { PlatformUtility } from "@components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@components/app.pagination";
import { AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Link } from "@models/portals.cms.link";

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

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;

	private subscription: Subscription;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private parentID: string;
	private parentLink: Link;
	private children = "{{number}} children: {{children}}";

	canUpdate = false;
	canContribute = false;

	title = "Categories";
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
		view: "View this link",
		children: "View the children"
	};
	buttons = {
		edit: "Edit",
		view: "View",
		children: "Children"
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
		this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			await this.backAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all");
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
		}

		this.module = this.contentType !== undefined
			? Module.get(this.contentType.RepositoryID)
			: await this.portalsCmsSvc.getActiveModuleAsync();

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfLink(this.module);

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Link", this.contentType === undefined ? undefined : this.contentType.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Link", this.contentType === undefined ? undefined : this.contentType.Privileges);
		if (!this.canContribute) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateHomeAsync();
			return;
		}

		this.labels = {
			children: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.links.list.labels.view")
		};

		this.buttons = {
			children: await this.configSvc.getResourceAsync("portals.cms.links.list.buttons.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.links.list.buttons.view"),
			edit: await this.configSvc.getResourceAsync("portals.cms.links.list.buttons.edit")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.cms.links.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: "" });
		this.children = await this.configSvc.getResourceAsync("portals.cms.links.list.children");

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.links.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.links.title.search"), "search", () => this.openSearchAsync())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentLink = Link.get(this.parentID);

			if (this.parentLink !== undefined) {
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Link" && (this.parentLink.ID === info.args.ID || this.parentLink.ID === info.args.ParentID)) {
						this.links = this.parentLink.Children;
					}
				}, `CMS.Links:${this.parentLink.ID}:Refresh`);
				this.links = this.parentLink.Children;
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.parentLink.FullTitle}]` });
			}
			else {
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Link") {
						this.prepareResults();
					}
				}, "CMS.Links:Refresh");
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${(this.contentType === undefined ? this.organization.Title : this.organization.Title + " :: " + this.contentType.Title)}]` });
				this.prepareFilterBy();
				await this.startSearchAsync();
			}
		}

		if (this.configSvc.isDebug) {
			console.log("<Links>: show the list", this.organization, this.module, this.contentType, this.filterBy, this.sortBy, this.configSvc.requestParams);
		}
	}

	private prepareFilterBy() {
		this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
		if (this.module !== undefined) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.module.ID } });
		}
		if (this.contentType !== undefined) {
			this.filterBy.And.push({ RepositoryEntityID: { Equals: this.contentType.ID } });
		}
		this.filterBy.And.push({ ParentID: "IsNull" });
	}

	track(index: number, link: Link) {
		return `${link.ID}@${index}`;
	}

	getInfo(link: Link) {
		return link.childrenIDs === undefined || link.childrenIDs.length < 1
			? link.URL
			: AppUtility.format(this.children, { number: link.childrenIDs.length, children: `${link.Children[0].Title}${(link.childrenIDs.length > 1 ? `, ${link.Children[1].Title}` : "")}, ...` });
	}

	onStartSearch(event: any) {
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

	onClearSearch() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.links = [];
	}

	onCancelSearch() {
		this.onClearSearch();
		this.startSearchAsync();
	}

	async onInfiniteScrollAsync() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
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
			(results || []).forEach(o => this.links.push(Link.get(o.ID)));
		}
		else {
			let objects = new List(results === undefined ? Link.all : results.map(o => Link.get(o.ID)));
			objects = objects.Where(o => o.SystemID === this.organization.ID && o.ParentID === this.parentID);
			objects = objects.OrderBy(o => o.OrderIndex).ThenByDescending(o => o.Title);
			if (results === undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.links = results === undefined
				? objects.ToArray()
				: this.links.concat(objects.ToArray());
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
			await this.configSvc.navigateForwardAsync(`/portals/cms/links/create?x-request=${AppUtility.toBase64Url(params)}`);
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

	private async backAsync(message: string, url?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message,
			undefined,
			async () => await this.configSvc.navigateHomeAsync(url),
			await this.configSvc.getResourceAsync("common.buttons.ok")
		);
	}

}
