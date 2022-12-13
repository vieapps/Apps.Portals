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

	title = {
		page: "Categories",
		track: "Categories"
	};
	parentCategory: Category;
	categories = new Array<Category>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy: { [key: string]: string } = { OrderIndex: "Ascending", Title: "Ascending" };
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
		versions: "versions",
		save: "Save",
		cancel: "Cancel",
		move: "Move contents to other category"
	};
	processing = false;
	redordering = false;
	redorderingItems: Array<NestedObject>;
	private orderedItems: Array<NestedObject>;
	private hash = "";

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

		this.searching = this.configSvc.currentURL.indexOf("/search") > 0;
		this.title.track = this.redordering
			? await this.configSvc.getResourceAsync("portals.cms.categories.title.reorder")
			: AppUtility.format(await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(this.searching ? "search" : "list")}`), { info: "" });

		this.parentID = this.configSvc.requestParams["ParentID"];
		this.parentCategory = this.searching
			? undefined
			: Category.get(this.parentID);

		const contentTypeID = this.parentCategory !== undefined
			? this.parentCategory.RepositoryEntityID
			: this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"];
		this.contentType = this.parentCategory !== undefined
			? this.parentCategory.contentType
			: ContentType.get(contentTypeID);
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

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfCategory(this.module);

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canUpdate = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", this.module === undefined ? undefined : this.module.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Category", this.module === undefined ? undefined : this.module.Privileges);
		if (!this.canContribute) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Type: "UpdateSidebar", Mode: "Categories" });

		this.labels = {
			edit: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.edit"),
			children: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.children"),
			view: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.view"),
			expression: await this.configSvc.getResourceAsync("portals.expressions.title.create"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			save: await this.configSvc.getResourceAsync("common.buttons.save"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			move: await this.configSvc.getResourceAsync("portals.cms.categories.list.labels.move"),
		};

		this.children = await this.configSvc.getResourceAsync("portals.cms.categories.list.children");
		this.alias = await this.configSvc.getResourceAsync("portals.cms.categories.controls.Alias.label");

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.categories.list.searchbar");
			this.prepareFilterBy(false);
			this.prepareTitleAsync().then(() => this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl)));
		}
		else {
			this.prepareFilterBy();
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.search"), "search", () => this.openSearch())
			];
			if (this.canUpdate) {
				this.actions.insert(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.categories.title.reorder"), "swap-vertical", () => this.openReorder()), 1);
				this.actions.push(
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel())
				);
			}
			this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll()));

			if (this.parentCategory !== undefined) {
				this.contentType = this.parentCategory.contentType;
				this.module = this.parentCategory.module;
				this.organization = this.parentCategory.organization;
				this.prepareCategories();
				this.prepareTitleAsync().then(() => this.appFormsSvc.hideLoadingAsync());
				AppEvents.on(this.portalsCoreSvc.name, info => {
					const args = info.args;
					if (args.Object === "CMS.Category" && ("Created" === args.Type || "Updated" === args.Type || "Deleted" === args.Type) && this.parentID === args.ParentID) {
						this.prepareCategories();
					}
				}, `CMS.Categories:${this.parentCategory.ID}:Refresh`);
			}
			else {
				this.prepareTitleAsync().then(() => this.startSearch(() => this.appFormsSvc.hideLoadingAsync()));
				AppEvents.on(this.portalsCoreSvc.name, info => {
					if (info.args.Object === "CMS.Category" && info.args.RepositoryEntityID === this.contentType.ID) {
						if (info.args.Type === "Created" && info.args.ParentID === undefined) {
							AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy), this.paginationPrefix);
						}
						else if (info.args.Type === "Deleted") {
							AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy), this.paginationPrefix);
							Category.instances.remove(info.args.ID);
							this.categories.removeAt(this.categories.findIndex(category => category.ID === info.args.ID));
						}
						this.prepareResults();
					}
				}, "CMS.Categories:Refresh");
			}
		}
	}

	private async prepareTitleAsync() {
		if (this.redordering) {
			this.configSvc.appTitle = this.title.page = await this.configSvc.getResourceAsync("portals.cms.categories.title.reorder");
		}
		else {
			const title = await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(this.searching ? "search" : "list")}`);
			this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: this.parentCategory !== undefined ? `[${this.parentCategory.FullTitle}]` : this.module === undefined && this.organization === undefined ? "" : `[${(this.module === undefined ? this.organization.Title : this.organization.Title + " :: " + this.module.Title)}]` });
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
			this.filterBy.And.push({ ParentID: this.parentCategory !== undefined ? { Equals: this.parentCategory.ID } : "IsNull" });
		}
	}

	private prepareCategories() {
		this.categories = this.parentCategory.Children;
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
		this.categories = [];
	}

	onCancel() {
		this.configSvc.navigateBackAsync();
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
		return this.portalsCoreSvc.getPaginationPrefix("cms.category");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			if (this.pagination !== undefined) {
				this.pageNumber++;
				this.pagination.PageNumber = this.pageNumber;
			}
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title.track);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchCategories(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
		else {
			this.portalsCmsSvc.searchCategoriesAsync(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
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
			this.categories.merge((results || []).map(object => Category.get(object.ID) || Category.deserialize(object, Category.get(object.ID))), true, (object, array) => array.findIndex(item => item.ID === object.ID));
		}
		else {
			const predicate: (category: Category) => boolean = obj => obj.SystemID === this.organization.ID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true) && obj.ParentID === this.parentID;
			const objects: Category[] = (results === undefined ? Category.instances.toArray(predicate) : Category.toArray(results).filter(predicate)).sortBy("OrderIndex", "Title");
			this.categories.merge(results === undefined && this.pagination !== undefined ? objects.take(this.pageNumber * this.pagination.PageSize) : objects, true, (object, array) => array.findIndex(item => item.ID === object.ID));
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
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, Category.getParams(this.filterBy))));
	}

	open(event: Event, category: Category) {
		this.do(this.canUpdate ? () => {
			if (category.childrenIDs === undefined) {
				this.doRefresh([category], 0, false, () => this.configSvc.navigateForwardAsync(category.routerURI));
			}
			else {
				this.configSvc.navigateForwardAsync(category.routerURI);
			}
		} : () => {}, event);
	}

	showChildren(event: Event, category: Category) {
		this.do(() => this.configSvc.navigateForwardAsync(category.showChildrenLink), event);
	}

	view(event: Event, category: Category) {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.portalsCmsSvc.getDefaultContentTypeOfContent(category.module), "list", category.Title, { CategoryID: category.ID })), event);
	}

	doRefresh(categories: Category[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title.track, "Refresh");
			if (index < categories.length - 1) {
				AppUtility.invoke(() => this.doRefresh(categories, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0 && categories.length > 1) {
			this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug ? () => console.log(`--- Start to refresh ${categories.length} CMS categories -----------------`) : () => {});
		}
		this.portalsCmsSvc.refreshCategoryAsync(categories[index].ID, refreshNext, refreshNext, undefined, useXHR);
	}

	refresh(event: Event, category: Category) {
		this.do(() => this.doRefresh([category], 0, true, () => this.appFormsSvc.showToastAsync("The category was freshen-up")), event);
	}

	refreshAll() {
		const categories = Category.instances.toArray(category => category.SystemID === this.organization.ID);
		if (categories.length > 0) {
			this.doRefresh(categories, 0, false, () => Promise.all(this.organization.modules.map(module => this.portalsCmsSvc.getContentTypesOfCategory(module))
				.flatMap(contentypes => contentypes)
				.map(contentType => this.portalsCmsSvc.searchSpecifiedCategoriesAsync(contentType, undefined, undefined, true, true))).then(() => this.appFormsSvc.showToastAsync("All the categories were freshen-up"))
			);
		}
	}

	createExpression(event: Event, category: Category) {
		const contentType = ContentType.get(category.PrimaryContentID) || this.portalsCmsSvc.getDefaultContentTypeOfContent(category.module);
		const params = {
			Title: `Contents of ${category.Title}`,
			RepositoryID: contentType === undefined ? undefined : contentType.RepositoryID,
			RepositoryEntityID: contentType === undefined ? undefined : contentType.ID,
			ParentID: category.ID
		};
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "create", category.ansiTitle, params, "expression", "core")), event);
	}

	viewVersions(event: Event, category: Category) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(category.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "CMS.Category", id: category.ID })), event);
	}

	private back(message: string, url?: string) {
		this.appFormsSvc.showConfirmAsync(message, () => this.configSvc.navigateBackAsync(url));
	}

	private openReorder() {
		this.redorderingItems = this.categories.sortBy("OrderIndex", "Title").map(category => ({
			ID: category.ID,
			Title: category.Title,
			OrderIndex: category.OrderIndex
		} as NestedObject));
		this.orderedItems = this.redorderingItems.map(category => ({
			ID: category.ID,
			Title: category.Title,
			OrderIndex: category.OrderIndex
		} as NestedObject));
		this.hash = AppCrypto.hash(this.orderedItems);
		this.prepareTitleAsync().then(() => this.redordering = true);
	}

	onReordered(event: any) {
		try {
			this.orderedItems.move(event.detail.from as number, event.detail.to as number).forEach((category, orderIndex) => category.OrderIndex = orderIndex);
		}
		catch (error) {
			console.error("Error occurred while reordering", error);
		}
		event.detail.complete();
	}

	doReorder() {
		if (this.hash !== AppCrypto.hash(this.orderedItems)) {
			const orderedItems = this.orderedItems.map(category => ({
				ID: category.ID,
				OrderIndex: category.OrderIndex
			}));
			this.processing = true;
			this.appFormsSvc.showLoadingAsync(this.title.page).then(() => this.portalsCmsSvc.updateCategoryAsync(
				{
					CategoryID: this.parentCategory === undefined ? undefined : this.parentCategory.ID,
					SystemID: this.organization === undefined ? undefined : this.organization.ID,
					RepositoryID: this.module === undefined ? undefined : this.module.ID,
					RepositoryEntityID: this.contentType === undefined ? undefined : this.contentType.ID,
					Categories: orderedItems
				},
				() => {
					this.categories.forEach(category => category.OrderIndex = orderedItems.find(item => item.ID === category.ID).OrderIndex);
					if (this.parentCategory !== undefined) {
						this.prepareCategories();
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
		this.prepareTitleAsync().then(() => {
			this.redorderingItems = [];
			this.orderedItems = [];
			this.appFormsSvc.hideLoadingAsync(onNext);
		});
	}

	move(event: Event, category: Category) {
		this.do(async () => this.portalsCoreSvc.moveAsync(
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
		), event);
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("CMS.Category", this.organization.ID, this.module !== undefined ? this.module.ID : undefined, this.contentType !== undefined ? this.contentType.ID : undefined);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Category",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			() => this.appFormsSvc.showLoadingAsync().then(() => this.trackAsync(this.actions[4].text, "Import")).then(() => {
				this.categories = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Category.instances
					.toArray(category => this.contentType !== undefined ? this.contentType.ID === category.RepositoryEntityID : this.organization.ID === category.SystemID)
					.map(category => category.ID)
					.forEach(id => Category.instances.remove(id));
				this.startSearch(async () => this.appFormsSvc.showConfirmAsync(await this.configSvc.getResourceAsync("portals.common.excel.message.import"), undefined, await this.configSvc.getResourceAsync("common.buttons.close")));
			})
		);
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Category", action: action || (this.searching ? "Search" : "Browse") });
	}

}
