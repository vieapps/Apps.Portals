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
import { Category } from "@models/portals.cms.category";

@Component({
	selector: "page-portals-cms-categories-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CmsCategoriesListPage implements OnInit, OnDestroy {

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
	private children = "{{number}} children: {{children}}";
	private alias = "Alias";

	canUpdate = false;
	canContribute = false;

	title = "Categories";
	parentCategory: Category;
	categories = new Array<Category>();
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
		edit: "Update this category",
		children: "View the children",
		view: "View the list of contents"
	};
	buttons = {
		edit: "Update",
		children: "Children",
		view: "Contents"
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
		return this.pagination !== undefined || this.parentCategory !== undefined;
	}

	get totalDisplays() {
		return this.parentCategory !== undefined
			? this.parentCategory.childrenIDs.length
			: AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.parentCategory !== undefined
			? this.parentCategory.childrenIDs.length
			: this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			if (this.parentCategory !== undefined) {
				AppEvents.off(this.portalsCoreSvc.name, `CMS.Categories:${this.parentCategory.ID}:Refresh`);
			}
			else {
				AppEvents.off(this.portalsCoreSvc.name, "CMS.Categories:Refresh");
			}
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.backAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
		}

		this.module = this.contentType !== undefined
			? Module.get(this.contentType.RepositoryID)
			: await this.portalsCmsSvc.getActiveModuleAsync();

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfCategory(this.module);

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", this.module === undefined ? undefined : this.module.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Category", this.module === undefined ? undefined : this.module.Privileges);
		if (!this.canContribute) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.edit"),
			children: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.view")
		};

		this.buttons = {
			edit: await this.configSvc.getResourceAsync("portals.cms.categories.list.buttons.edit"),
			children: await this.configSvc.getResourceAsync("portals.cms.categories.list.buttons.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.categories.list.buttons.view")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: "" });
		this.children = await this.configSvc.getResourceAsync("portals.cms.categories.list.children");
		this.alias = await this.configSvc.getResourceAsync("portals.cms.categories.controls.Alias.label");

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.categories.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.search"), "search", () => this.openSearchAsync())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentCategory = Category.get(this.parentID);

			if (this.parentCategory !== undefined) {
				this.categories = this.parentCategory.Children;
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.parentCategory.FullTitle}]` });
				await this.appFormsSvc.hideLoadingAsync();
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Category" && (this.parentCategory.ID === info.args.ID || this.parentCategory.ID === info.args.ParentID)) {
						this.categories = this.parentCategory.Children;
					}
				}, `CMS.Categoriess:${this.parentCategory.ID}:Refresh`);
			}
			else {
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${(this.module === undefined ? this.organization.Title : this.organization.Title + " :: " + this.module.Title)}]` });
				this.prepareFilterBy();
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Category") {
						this.prepareResults();
					}
				}, "CMS.Categories:Refresh");
			}
		}

		if (this.configSvc.isDebug) {
			console.log("<Categories>: show the list", this.organization, this.module, this.contentType, this.filterBy, this.sortBy, this.configSvc.requestParams);
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

	track(index: number, category: Category) {
		return `${category.ID}@${index}`;
	}

	getInfo(category: Category) {
		return category.childrenIDs === undefined || category.childrenIDs.length < 1
			? `${this.alias}: ${category.Alias}`
			: AppUtility.format(this.children, { number: category.childrenIDs.length, children: `${category.Children[0].Title}${(category.childrenIDs.length > 1 ? `, ${category.Children[1].Title}` : "")}, ...` });
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.categories = [];
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
		this.categories = [];
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
		return this.portalsCoreSvc.getPaginationPrefix("cms.category");
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
			this.subscription = this.portalsCmsSvc.searchCategory(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCmsSvc.searchCategoryAsync(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
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
			(results || []).forEach(o => this.categories.push(Category.get(o.ID)));
		}
		else {
			let objects = new List(results === undefined ? Category.all : results.map(o => Category.get(o.ID)));
			objects = objects.Where(o => o.SystemID === this.organization.ID && o.ParentID === this.parentID);
			objects = objects.OrderBy(o => o.OrderIndex).ThenByDescending(o => o.Title);
			if (results === undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.categories = results === undefined
				? objects.ToArray()
				: this.categories.concat(objects.ToArray());
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
		await this.configSvc.navigateForwardAsync("/portals/cms/categories/search");
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		const params: { [key: string]: string } = {};
		if (AppUtility.isNotEmpty(this.parentID)) {
			params["ParentID"] = this.parentID;
		}
		if (this.contentType !== undefined) {
			params["RepositoryEntityID"] = this.contentType.ID;
			await this.configSvc.navigateForwardAsync(`/portals/cms/categories/create?x-request=${AppUtility.toBase64Url(params)}`);
		}
	}

	async openAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		if (this.canUpdate) {
			await this.configSvc.navigateForwardAsync(category.routerURI);
		}
	}

	async showChildrenAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(category.listURI);
	}

	async viewAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppUrl(this.portalsCmsSvc.getDefaultContentTypeOfContent(category.module), "list", category.Title, { CategoryID: category.ID }));
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
