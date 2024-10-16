import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList, ViewDidEnter } from "@ionic/angular";
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
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Crawler } from "@app/models/portals.cms.crawler";

@Component({
	selector: "page-portals-cms-crawlers-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CmsCrawlersListPage implements OnInit, OnDestroy, ViewDidEnter {

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

	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private subscription: Subscription;

	canUpdate = false;

	title = {
		page: "Crawlers",
		track: "Crawlers",
		search: "Searching"
	};
	crawlers = new Array<Crawler>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { Created: "Descending" };
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;
	buttons = {
		edit: "Update",
		view: "View"
	};
	filtering = false;
	labels = {
		filter: "Quick filter",
		cancel: "Cancel"
	};
	private objects = new Array<Crawler>();

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	get totalDisplays() {
		return this.pagination !== undefined ? AppPagination.computeTotal(this.pageNumber, this.pagination) : 0;
	}

	get totalRecords() {
		return this.pagination !== undefined ? this.pagination.TotalRecords : 0;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			AppEvents.off(this.portalsCoreSvc.name, "CMS.Crawlers:Refresh");
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	ionViewDidEnter() {
		this.configSvc.appTitle = this.searching ? this.title.search : this.title.page;
		this.trackAsync(this.searching ? this.title.search : this.title.track);
	}

	async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.searching = this.configSvc.currentURL.indexOf("/search") > 0;
		const title = await this.configSvc.getResourceAsync(`portals.cms.crawlers.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title.page = this.title.track = AppUtility.format(title, { info: "" });

		this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | No Organization`, "Check");
			this.appFormsSvc.hideLoadingAsync(async () => this.back(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		this.module = this.contentType !== undefined
			? Module.get(this.contentType.RepositoryID)
			: await this.portalsCoreSvc.getActiveModuleAsync();

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canUpdate) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.buttons = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			view: await this.configSvc.getResourceAsync("common.buttons.view")
		};

		this.labels = {
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

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

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.crawlers.list.search");
			this.title.search = await this.configSvc.getResourceAsync("common.messages.searching");
			this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl));
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.crawlers.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.crawlers.title.search"), "search", () => this.openSearch(false))
			];
			if (this.canUpdate) {
				this.actions.push(
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel())
				);
			}

			this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${(this.contentType === undefined ? this.organization.Title : this.organization.Title + " :: " + this.contentType.Title)}]` });
			this.startSearch(() => this.appFormsSvc.hideLoadingAsync());

			AppEvents.on(this.portalsCoreSvc.name, info => {
				const args = info.args;
				if (args.Object === "CMS.Crawler" && args.SystemID === this.portalsCoreSvc.activeOrganization.ID) {
					if (args.Type === "Deleted") {
						this.crawlers.removeAt(this.crawlers.findIndex(crawler => crawler.ID === args.ID));
					}
					else {
						this.prepareResults(() => this.crawlers = this.crawlers.sortBy({ name: "Created", reverse: true }));
					}
				}
			}, "CMS.Crawlers:Refresh");
		}
	}

	track(index: number, crawler: Crawler) {
		return `${crawler.ID}@${index}`;
	}

	onSearch(event: any) {
		if (this.searching) {
			if (this.subscription !== undefined) {
				this.subscription.unsubscribe();
				this.subscription = undefined;
			}
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.appFormsSvc.showLoadingAsync(this.title.search).then(() => {
					this.crawlers = [];
					this.pageNumber = 0;
					this.pagination = AppPagination.getDefault();
					this.search(() => this.trackAsync(this.title.search).then(() => this.appFormsSvc.hideLoadingAsync(() => {
						this.infiniteScrollCtrl.disabled = false;
						if (this.crawlers.length < 1) {
							PlatformUtility.focus(this.searchCtrl);
						}
					})));
				});
			}
			else {
				this.crawlers = this.objects.filter(Crawler.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear(isOnCanceled: boolean = false, onNext?: () => void) {
		if (this.searching || this.filtering) {
			this.filterBy.Query = undefined;
			this.crawlers = this.filtering ? this.objects.map(obj => obj) : [];
			if (isOnCanceled) {
				this.filtering = false;
				this.infiniteScrollCtrl.disabled = false;
				if (onNext !== undefined) {
					onNext();
				}
			}
		}
	}

	onCancel() {
		if (this.searching) {
			this.configSvc.navigateBackAsync();
		}
		else {
			this.onClear(true, () => this.objects = []);
		}
	}

	onInfiniteScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.search(() => this.trackAsync(this.searching ? this.title.search : this.title.track).then(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : () => {}));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("cms.crawler");
	}

	startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data?: any) => {
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			if (this.pagination !== undefined) {
				this.pageNumber++;
				this.pagination.PageNumber = this.pageNumber;
			}
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchCrawlers(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
		}
		else {
			this.portalsCmsSvc.searchCrawlersAsync(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
		}
	}

	prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			this.crawlers.merge((results || []).map(object => Crawler.get(object.ID) || Crawler.deserialize(object, Crawler.get(object.ID))), true, (object, array) => array.findIndex(crawler => crawler.ID === object.ID));
		}
		else {
			const predicate: (crawler: Crawler) => boolean = object => object.SystemID === this.organization.ID && (this.module !== undefined ? object.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? object.RepositoryEntityID === this.contentType.ID : true);
			const objects: Crawler[] = (results === undefined ? Crawler.instances.toArray(predicate) : Crawler.toArray(results).filter(predicate)).sortBy({ name: "Created", reverse: true });
			this.crawlers.merge(results === undefined && this.pagination !== undefined ? objects.take(this.pageNumber * this.pagination.PageSize) : objects, true, (object, array) => array.findIndex(crawler => crawler.ID === object.ID));
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

	openSearch(filtering: boolean = true) {
		this.do(() => {
			if (filtering) {
				this.filtering = true;
				this.objects = this.crawlers.map(obj => obj);
				this.infiniteScrollCtrl.disabled = true;
				AppUtility.invoke(async () => this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter")).then(() => PlatformUtility.focus(this.searchCtrl));
			}
			else {
				this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "search", undefined, Crawler.getParams(this.filterBy)));
			}
		});
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "create", this.organization.Title, Crawler.getParams(this.filterBy), "crawler")));
	}

	view(event: Event, crawler: Crawler) {
		this.do(() => this.configSvc.navigateForwardAsync(crawler.routerURI), event);
	}

	edit(event: Event, crawler: Crawler) {
		this.do(this.canUpdate ? () => this.configSvc.navigateForwardAsync(crawler.routerURI.replace("/view/", "/update/")) : () => {}, event);
	}

	back(message: string, url?: string) {
		this.do(() => this.appFormsSvc.showConfirmAsync(message, () => this.configSvc.navigateBackAsync(url)));
	}

	exportToExcel() {
		this.do(async () => this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.all"),
			() => this.exportToExcelAsync(this.filterBy, this.sortBy),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.no"),
			() => this.exportToExcelAsync()
		));
	}

	private async exportToExcelAsync(filterBy?: any, sortBy?: any) {
		await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("CMS.Crawler", this.organization.ID, undefined, undefined, filterBy, sortBy);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		);
	}

	importFromExcel() {
		this.do(() => this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Crawler",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			() => this.appFormsSvc.showLoadingAsync().then(() => this.trackAsync(this.actions[3].text, "Import")).then(() => {
				this.crawlers = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Crawler.instances
					.toArray(crawler => this.contentType !== undefined ? this.contentType.ID === crawler.RepositoryEntityID : this.organization.ID === crawler.SystemID)
					.map(crawler => crawler.ID)
					.forEach(id => Crawler.instances.remove(id));
				this.startSearch(async () => this.appFormsSvc.showConfirmAsync(await this.configSvc.getResourceAsync("portals.common.excel.message.import"), undefined, await this.configSvc.getResourceAsync("common.buttons.close")));
			})
		));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Crawler", action: action || (this.searching ? "Search" : "Browse") });
	}

}
