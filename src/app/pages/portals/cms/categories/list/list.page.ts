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
import { Organization } from "@app/models/portals.core.organization";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";
import { Category } from "@app/models/portals.cms.category";

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

	@ViewChild(IonSearchbar, { static: false }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: false }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild("originalItems", { static: false }) private listCtrl: IonList;

	private subscription: Subscription;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private parentID: string;
	private children = "{{number}} children: {{children}}";
	private alias = "Alias";

	isSystemAdministrator = false;
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
		view: "View the list of contents",
		refresh: "Refresh",
		expression: "Create new expression",
		save: "Save",
		cancel: "Cancel",
		move: "Move contents to other category"
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

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfCategory(this.module);

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canUpdate = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", this.module === undefined ? undefined : this.module.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Category", this.module === undefined ? undefined : this.module.Privileges);
		if (!this.canContribute) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Mode: "UpdateSidebarWithCategories" });

		this.labels = {
			edit: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.edit"),
			children: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.view"),
			expression: await this.configSvc.getResourceAsync("portals.expressions.title.create"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			save: await this.configSvc.getResourceAsync("common.buttons.save"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			move: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.move"),
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		await this.prepareTitleAsync();
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
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.reorder"), "swap-vertical", () => this.openReorderAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.search"), "search", () => this.openSearchAsync())
			];
			if (this.canUpdate) {
				this.actions.push(
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
				);
			}

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentCategory = Category.get(this.parentID);

			if (this.parentCategory !== undefined) {
				this.prepareCategories();
				this.contentType = this.parentCategory.contentType;
				this.module = this.parentCategory.module;
				this.organization = this.parentCategory.organization;
				await this.prepareTitleAsync();
				await this.appFormsSvc.hideLoadingAsync();
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Category" && (this.parentCategory.ID === info.args.ID || this.parentCategory.ID === info.args.ParentID)) {
						this.prepareCategories();
					}
				}, `CMS.Categoriess:${this.parentCategory.ID}:Refresh`);
			}
			else {
				await this.prepareTitleAsync();
				this.prepareFilterBy();
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Category") {
						this.prepareResults();
					}
				}, "CMS.Categories:Refresh");
			}
			if (this.configSvc.isDebug) {
				console.log("<CMS Portals>: Categories (request info)", this.configSvc.requestParams, this.filterBy, this.sortBy);
				console.log("<CMS Portals>: Categories (management info)", `\n- Organization:`, this.organization, `\n- Module:`, this.module, `\n- Content Type:`, this.contentType);
			}
		}
	}

	private async prepareTitleAsync() {
		if (this.redordering) {
			this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("portals.cms.categories.title.reorder");
		}
		else {
			const title = await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(this.searching ? "search" : "list")}`);
			this.configSvc.appTitle = this.title = AppUtility.format(title, { info: this.parentCategory !== undefined ? `[${this.parentCategory.FullTitle}]` : this.module === undefined && this.organization === undefined ? "" : `[${(this.module === undefined ? this.organization.Title : this.organization.Title + " :: " + this.module.Title)}]` });
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

	private prepareCategories() {
		this.categories = this.parentCategory.Children.toList().OrderBy(o => o.OrderIndex).ThenByDescending(o => o.Title).ToArray();
	}

	track(index: number, item: any) {
		return `${item.ID}@${index}`;
	}

	getInfo(category: Category) {
		return category.childrenIDs === undefined || category.childrenIDs.length < 1
			? `${this.alias}: ${category.Alias}`
			: AppUtility.format(this.children, { number: category.childrenIDs.length, children: `${category.Children[0].Title}${(category.childrenIDs.length > 1 ? `, ${category.Children[1].Title}` : "")}, ...` });
	}

	onSearch(event: any) {
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

	onClear() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.categories = [];
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
			(results || []).forEach(o => this.categories.push(Category.get(o.ID) || Category.deserialize(o, Category.get(o.ID))));
		}
		else {
			const predicate: (category: Category) => boolean = obj => obj.SystemID === this.organization.ID && obj.ParentID === this.parentID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true);
			let objects = results === undefined
				? Category.instances.toList(predicate)
				: Category.toList(results).Where(predicate);
			objects = objects.OrderBy(obj => obj.OrderIndex).ThenBy(obj => obj.Title);
			if (results === undefined && this.pagination !== undefined) {
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
			await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, params));
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
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.portalsCmsSvc.getDefaultContentTypeOfContent(category.module), "list", category.Title, { CategoryID: category.ID }));
	}

	async refreshAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCmsSvc.refreshCategoryAsync(category.ID, async _ => await this.appFormsSvc.showToastAsync("The category was freshen-up"));
	}

	async createExpressionAsync(event: Event, category: Category) {
		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfContent(category.module);
		const params = AppUtility.isObject(contentType, true)
			? {
				Title: `Contents of ${category.Title}`,
				RepositoryID: contentType.RepositoryID,
				RepositoryEntityID: contentType.ID,
				ContentTypeDefinitionID: contentType.ContentTypeDefinitionID,
				Filter: {
					Operator: "And",
					Children: [{
						Attribute: "CategoryID",
						Operator: "Equals",
						Value: category.ID
					}]
				}
			}
			: undefined;
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "create", category.ansiTitle, params, "expression", "core"));
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
		this.reorderItems = this.categories.sortBy("OrderIndex", "Title").map(c => {
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
			await this.portalsCmsSvc.updateCategoryAsync(
				{
					CategoryID: this.parentCategory === undefined ? undefined : this.parentCategory.ID,
					SystemID: this.organization === undefined ? undefined : this.organization.ID,
					RepositoryID: this.module === undefined ? undefined : this.module.ID,
					RepositoryEntityID: this.contentType === undefined ? undefined : this.contentType.ID,
					Categories: reordered
				},
				async _ => {
					this.categories.forEach(category => category.OrderIndex = reordered.find(i => i.ID === category.ID).OrderIndex);
					if (this.parentCategory !== undefined) {
						this.prepareCategories();
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

	async moveAsync(event: Event, category: Category) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.moveAsync(
			"Category",
			category.ID,
			{
				firstConfirm: await this.appFormsSvc.getResourceAsync("portals.cms.categories.list.labels.moveFirstConfirm"),
				lastConfirm: await this.appFormsSvc.getResourceAsync("portals.cms.categories.list.labels.moveLastConfirm"),
				explanation: await this.appFormsSvc.getResourceAsync("portals.cms.categories.list.labels.moveExplanation"),
				noData: await this.appFormsSvc.getResourceAsync("portals.cms.categories.list.labels.moveNoCategory"),
				invalidData: await this.appFormsSvc.getResourceAsync("portals.cms.categories.list.labels.moveInvalidCategory"),
				done: await this.appFormsSvc.getResourceAsync("portals.cms.categories.list.labels.moveDone")
			},
			(data: any, previousData?: any) => previousData !== undefined ? data.contentTypeID === previousData.contentTypeID && data.categoryID === previousData.categoryID : AppUtility.isNotEmpty(data.contentTypeID) && AppUtility.isNotEmpty(data.categoryID),
			[
				{
					type: "text",
					name: "contentTypeID",
					placeholder: "Content Type ID"
				},
				{
					type: "text",
					name: "categoryID",
					placeholder: "Category ID"
				}
			],
			data => {
				return {
					"x-content-type-id": data.contentTypeID,
					"x-category-id": data.categoryID
				};
			}
		);
		if (this.configSvc.isDebug) {
			console.log("<Portals>: move contents to other category", category);
		}
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("CMS.Category", this.organization.ID, this.module !== undefined ? this.module.ID : undefined, this.contentType !== undefined ? this.contentType.ID : undefined);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Category",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			async _ => {
				await this.appFormsSvc.showLoadingAsync();
				this.categories = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Category.instances
					.toArray(category => this.contentType !== undefined ? this.contentType.ID === category.RepositoryEntityID : this.organization.ID === category.SystemID)
					.map(category => category.ID)
					.forEach(id => Category.instances.remove(id));
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
