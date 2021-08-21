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
import { Category, Content } from "@app/models/portals.cms.all";

@Component({
	selector: "page-portals-cms-contents-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CmsContentListPage implements OnInit, OnDestroy, ViewDidEnter {

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
	private categoryID: string;
	private category: Category;
	private subscription: Subscription;

	canUpdate = false;
	canContribute = false;

	title = {
		page: "Contents",
		track: "Contents",
		search: "Searching"
	};
	contents = new Array<Content>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { StartDate: "Descending", PublishedTime: "Descending" };
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
	private objects = new Array<Content>();

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
			AppEvents.off(this.portalsCoreSvc.name, `CMS.Contents:${(this.category !== undefined ? ":" + this.category.ID : "")}:Refresh`);
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	ionViewDidEnter() {
		this.configSvc.appTitle = this.searching ? this.title.search : this.title.page;
		this.trackAsync(this.searching ? this.title.search : this.title.track, this.searching ? "Search" : "Browse");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.searching = this.configSvc.currentURL.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.cms.contents.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title.page = this.title.track = AppUtility.format(title, { info: "" });

		this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
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

		this.categoryID = this.configSvc.requestParams["CategoryID"];
		this.category = Category.get(this.categoryID);

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Content", this.module === undefined ? undefined : this.module.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Content", this.module === undefined ? undefined : this.module.Privileges);
		if (!this.canContribute) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check");
			this.appFormsSvc.showToastAsync("Hmmmmmm...."),
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
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

		this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
		if (this.module !== undefined) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.module.ID } });
		}
		if (this.contentType !== undefined) {
			this.filterBy.And.push({ RepositoryEntityID: { Equals: this.contentType.ID } });
		}
		if (this.category !== undefined) {
			this.filterBy.And.push({ CategoryID: { Equals: this.category.ID } });
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Type: "UpdateSidebar", Mode: "Categories" });
		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.search");
			this.configSvc.appTitle = this.title.search = await this.configSvc.getResourceAsync("common.messages.searching");
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

			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "CMS.Content") {
					this.prepareResults();
				}
			}, `CMS.Contents:${(this.category !== undefined ? ":" + this.category.ID : "")}:Refresh`);

			this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${(this.category === undefined ? this.organization.Title : this.organization.Title + " :: " + this.category.FullTitle)}]` });
			this.startSearch(() => {
				if (this.category !== undefined && this.category.childrenIDs === undefined) {
					this.portalsCmsSvc.refreshCategoryAsync(this.category.ID, () => this.appFormsSvc.showToastAsync("The category was freshen-up"));
				}
			});
		}
	}

	track(index: number, content: Content) {
		return `${content.ID}@${index}`;
	}

	onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.appFormsSvc.showLoadingAsync(this.title.search).then(() => {
					this.contents = [];
					this.pageNumber = 0;
					this.pagination = AppPagination.getDefault();
					this.search(() => {
						this.infiniteScrollCtrl.disabled = false;
						if (this.contents.length < 1) {
							PlatformUtility.focus(this.searchCtrl);
						}
					});
				});
			}
			else {
				this.contents = this.objects.filter(Content.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear() {
		this.filterBy.Query = undefined;
		this.contents = this.filtering ? this.objects.map(obj => obj) : [];
	}

	onCancel() {
		if (this.searching) {
			this.configSvc.navigateBackAsync();
		}
		else {
			this.onClear();
			this.filtering = false;
		}
	}

	onInfiniteScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.search(() => {
				if (this.infiniteScrollCtrl !== undefined) {
					this.infiniteScrollCtrl.complete();
				}
			});
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("cms.content");
	}

	startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.trackAsync(this.title.track);
			this.appFormsSvc.hideLoadingAsync();
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchContent(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
		else {
			this.portalsCmsSvc.searchContentAsync(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
	}

	prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.contents.push(Content.get(o.ID) || Content.deserialize(o, Content.get(o.ID))));
		}
		else {
			const predicate: (content: Content) => boolean = obj => obj.SystemID === this.organization.ID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true) && (this.category !== undefined ? obj.CategoryID === this.category.ID || (obj.OtherCategories !== undefined && obj.OtherCategories.indexOf(this.category.ID) > -1) : true);
			let objects = results === undefined ? Content.instances.toArray(predicate) : Content.toArray(results).filter(predicate);
			objects = objects.sortBy({ name: "StartDate", reverse: true }, { name: "PublishedTime", reverse: true }, { name: "LastModified", reverse: true });
			objects = results === undefined && this.pagination !== undefined ? objects.take(this.pageNumber * this.pagination.PageSize) : objects;
			this.contents = results === undefined ? objects : this.contents.concat(objects);
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	showActions() {
		this.listCtrl.closeSlidingItems().then(() => this.appFormsSvc.showActionSheetAsync(this.actions));
	}

	openSearch(filtering: boolean = true) {
		this.listCtrl.closeSlidingItems().then(async () => {
			if (filtering) {
				this.filtering = true;
				PlatformUtility.focus(this.searchCtrl);
				this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
				this.objects = this.contents.map(obj => obj);
			}
			else {
				this.configSvc.navigateForwardAsync("/portals/cms/contents/search");
			}
		});
	}

	create() {
		this.listCtrl.closeSlidingItems();
		const params: { [key: string]: string } = {};
		if (AppUtility.isNotEmpty(this.categoryID)) {
			params["CategoryID"] = this.categoryID;
		}
		if (this.contentType !== undefined) {
			params["RepositoryEntityID"] = this.contentType.ID;
			this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, params));
		}
	}

	view(event: Event, content: Content) {
		event.stopPropagation();
		this.listCtrl.closeSlidingItems().then(() => this.configSvc.navigateForwardAsync(content.routerURI));
	}

	edit(event: Event, content: Content) {
		event.stopPropagation();
		this.listCtrl.closeSlidingItems().then(() => {
			if (this.canUpdate) {
				this.configSvc.navigateForwardAsync(content.routerURI.replace("/view/", "/update/"));
			}
		});
	}

	back(message: string, url?: string) {
		this.listCtrl.closeSlidingItems().then(() => this.appFormsSvc.showAlertAsync(undefined, message, undefined, () => this.configSvc.navigateHomeAsync(url)));
	}

	exportToExcel() {
		this.trackAsync(this.actions[2].text, "Export").then(() => this.portalsCoreSvc.exportToExcelAsync("CMS.Content", this.organization.ID, this.module !== undefined ? this.module.ID : undefined, this.contentType !== undefined ? this.contentType.ID : undefined));
	}

	importFromExcel() {
		this.trackAsync(this.actions[3].text, "Import").then(() => this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Content",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			() => {
				this.appFormsSvc.showLoadingAsync();
				this.contents = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Content.instances
					.toArray(content => this.contentType !== undefined ? this.contentType.ID === content.RepositoryEntityID : this.organization.ID === content.SystemID)
					.map(content => content.ID)
					.forEach(id => Content.instances.remove(id));
				this.startSearch(async () => await this.appFormsSvc.showAlertAsync(
					"Excel",
					await this.configSvc.getResourceAsync("portals.common.excel.message.import"),
					undefined,
					undefined,
					await this.configSvc.getResourceAsync("common.buttons.close")
				));
			}
		));
	}

	private async trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Content", action: action || (this.searching ? "Search" : "Browse") });
	}

}
