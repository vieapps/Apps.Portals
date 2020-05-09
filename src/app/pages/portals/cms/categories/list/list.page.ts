import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { PlatformUtility } from "@components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@components/app.pagination";
import { AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Organization } from "@models/portals.core.organization";
import { ContentType } from "@models/portals.core.content.type";
import { Category } from "@models/portals.cms.category";

@Component({
	selector: "page-portals-cms-categories-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CategoriesListPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private organization: Organization;
	private contentType: ContentType;
	private parentID: string;
	private parentCategory: Category;
	private subscription: Subscription;
	private children = "{{number}} children: {{children}}";
	private alias = "Alias";

	title = "Categories";
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

	get locale() {
		return this.configSvc.locale;
	}

	get gotPagination() {
		return this.pagination !== undefined || this.parentCategory !== undefined;
	}

	get totalDisplays() {
		return this.parentID !== undefined
			? this.parentCategory.childrenIDs.length
			: AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.parentID !== undefined
			? this.parentCategory.childrenIDs.length
			: this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			if (this.parentCategory !== undefined) {
				AppEvents.off("Portals", `Categories:${this.parentCategory.ID}:Refresh`);
			}
			else {
				AppEvents.off("Portals", "Categories:Refresh");
			}
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"]);
		this.organization = this.contentType !== undefined
			? this.contentType.Organization
			: this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);

		if (this.organization === undefined) {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateHomeAsync();
			return;
		}

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: "" });
		this.children = await this.configSvc.getResourceAsync("portals.cms.categories.list.children");
		this.alias = await this.configSvc.getResourceAsync("portals.cms.categories.controls.Alias.label");

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.categories.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.create"), "create", () => this.openCreateAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.search"), "search", () => this.openSearchAsync())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentCategory = Category.get(this.parentID);

			if (this.parentCategory !== undefined) {
				this.categories = this.parentCategory.Children;
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.parentCategory.FullTitle}]` });
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Category" && (this.parentCategory.ID === info.args.ID || this.parentCategory.ID === info.args.ParentID)) {
						this.categories = this.parentCategory.Children;
					}
				}, `Categorys:${this.parentCategory.ID}:Refresh`);
			}
			else {
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.organization.Title}]` });
				this.filterBy.And = [
					{ SystemID: { Equals: this.organization.ID } },
					{ ParentID: "IsNull" }
				];
				this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `cms.category@${this.portalsCmsSvc.name}`) || AppPagination.getDefault();
				this.pagination.PageNumber = this.pageNumber;
				await this.searchAsync();
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Category") {
						this.prepareResults();
					}
				}, "Categorys:Refresh");
			}
		}
	}

	track(index: number, category: Category) {
		return `${category.ID}@${index}`;
	}

	getInfo(category: Category) {
		return category.childrenIDs === undefined || category.childrenIDs.length < 1
			? `${this.alias}: ${category.Alias}`
			: AppUtility.format(this.children, { number: category.childrenIDs.length, children: `${category.Children[0].Title}${(category.childrenIDs.length > 1 ? `, ${category.Children[1].Title}` : "")}, ...` });
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	openCreateAsync() {
		return this.configSvc.navigateForwardAsync(`/portals/cms/categories/create${(this.parentID === undefined ? "" : "?x-request=" + AppUtility.toBase64Url({ ParentID: this.parentID }))}`);
	}

	openSearchAsync() {
		return this.configSvc.navigateForwardAsync("/portals/cms/categories/search");
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

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `cms.category@${this.portalsCmsSvc.name}`.toLowerCase()) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, `cms.category@${this.portalsCmsSvc.name}`.toLowerCase());
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchCategory(this.request, onNextAsync);
		}
		else {
			await this.portalsCmsSvc.searchCategoryAsync(this.request, onNextAsync);
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
			objects = objects.OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
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

	async openAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.configSvc.navigateForwardAsync(category.routerURI);
	}

	async showChildrenAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.configSvc.navigateForwardAsync(category.listURI);
	}

}
