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
import { Item } from "@app/models/portals.cms.item";

@Component({
	selector: "page-portals-cms-items-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CmsItemListPage implements OnInit, OnDestroy, ViewDidEnter {

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
	canContribute = false;

	title = {
		page: "Items",
		track: "Items",
		search: "Searching"
	};
	items = new Array<Item>();
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
	private objects = new Array<Item>();

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
			AppEvents.off(this.portalsCoreSvc.name, "CMS.Items:Refresh");
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
		AppEvents.broadcast(this.portalsCmsSvc.name, { Type: "UpdateSidebar", Mode: "ContentTypes" });

		this.searching = this.configSvc.currentURL.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.cms.contents.title.${(this.searching ? "search" : "list")}`);
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

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
		}

		this.module = this.contentType !== undefined
			? Module.get(this.contentType.RepositoryID)
			: await this.portalsCoreSvc.getActiveModuleAsync();

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfContent(this.module);

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Item", this.contentType === undefined ? undefined : this.contentType.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Item", this.contentType === undefined ? undefined : this.contentType.Privileges);
		if (!this.canContribute) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateHomeAsync());
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
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.search");
			this.title.search = await this.configSvc.getResourceAsync("common.messages.searching");
			this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl));
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.contents.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.contents.title.search"), "search", () => this.openSearch(false))
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
				if (info.args.Object === "CMS.Item" && info.args.SystemID === this.portalsCoreSvc.activeOrganization.ID) {
					this.prepareResults();
				}
			}, "CMS.Items:Refresh");
		}
	}

	track(index: number, item: Item) {
		return `${item.ID}@${index}`;
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
					this.items = [];
					this.pageNumber = 0;
					this.pagination = AppPagination.getDefault();
					this.search(() => this.trackAsync(this.title.search, "Search").then(() => this.appFormsSvc.hideLoadingAsync(() => {
						this.infiniteScrollCtrl.disabled = false;
						if (this.items.length < 1) {
							PlatformUtility.focus(this.searchCtrl);
						}
					})));
				});
			}
			else {
				this.items = this.objects.filter(Item.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear(isOnCanceled: boolean = false, onNext?: () => void) {
		if (this.searching || this.filtering) {
			this.filterBy.Query = undefined;
			this.items = this.filtering ? this.objects.map(obj => obj) : [];
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
			this.search(() => this.trackAsync(this.title.track).then(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : () => {}));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("cms.item");
	}

	startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data?: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchItem(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
		}
		else {
			this.portalsCmsSvc.searchItemAsync(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
		}
	}

	prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.items.push(Item.get(o.ID) || Item.deserialize(o, Item.get(o.ID))));
		}
		else {
			const predicate: (item: Item) => boolean = obj => obj.SystemID === this.organization.ID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true);
			let objects = results === undefined ? Item.instances.toArray(predicate) : Item.toArray(results).filter(predicate);
			objects = objects.sortBy({ name: "Created", reverse: true });
			objects = results === undefined && this.pagination !== undefined ? objects.take(this.pageNumber * this.pagination.PageSize) : objects;
			this.items = results === undefined ? objects : this.items.concat(objects);
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	showActions() {
		this.listCtrl.closeSlidingItems().then(() => this.appFormsSvc.showActionSheetAsync(this.actions));
	}

	openSearch(filtering: boolean = true) {
		this.listCtrl.closeSlidingItems().then(() => {
			if (filtering) {
				this.filtering = true;
				this.objects = this.items.map(obj => obj);
				this.infiniteScrollCtrl.disabled = true;
				AppUtility.invoke(async () => this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter")).then(() => PlatformUtility.focus(this.searchCtrl));
			}
			else {
				this.configSvc.navigateForwardAsync("/portals/cms/items/search");
			}
		});
	}

	create() {
		this.listCtrl.closeSlidingItems().then(() => {
			const params: { [key: string]: string } = {
				SystemID: this.organization.ID,
				RepositoryID: this.module.ID
			};
			if (this.contentType !== undefined) {
				params["RepositoryEntityID"] = this.contentType.ID;
				this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, params));
			}
		});
	}

	view(event: Event, item: Item) {
		event.stopPropagation();
		this.listCtrl.closeSlidingItems().then(() => this.configSvc.navigateForwardAsync(item.routerURI));
	}

	edit(event: Event, item: Item) {
		event.stopPropagation();
		this.listCtrl.closeSlidingItems().then(() => {
			if (this.canUpdate) {
				this.configSvc.navigateForwardAsync(item.routerURI.replace("/view/", "/update/"));
			}
		});
	}

	back(message: string, url?: string) {
		this.listCtrl.closeSlidingItems().then(() => this.appFormsSvc.showAlertAsync(undefined, message, undefined, () => this.configSvc.navigateHomeAsync(url)));
	}

	exportToExcel() {
		this.portalsCoreSvc.exportToExcelAsync(
			"CMS.Item",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			() => this.trackAsync(this.actions[2].text, "Export")
		);
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Item",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			() => this.appFormsSvc.showLoadingAsync().then(() => this.trackAsync(this.actions[3].text, "Import")).then(() => {
				this.items = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Item.instances
					.toArray(item => this.contentType !== undefined ? this.contentType.ID === item.RepositoryEntityID : this.organization.ID === item.SystemID)
					.map(item => item.ID)
					.forEach(id => Item.instances.remove(id));
				this.startSearch(async () => this.appFormsSvc.showAlertAsync(
					"Excel",
					await this.configSvc.getResourceAsync("portals.common.excel.message.import"),
					undefined,
					undefined,
					await this.configSvc.getResourceAsync("common.buttons.close")
				));
			})
		);
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Item", action: action || (this.searching ? "Search" : "Browse") });
	}

}
