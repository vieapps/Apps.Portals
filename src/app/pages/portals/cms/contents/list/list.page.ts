import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
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

export class CmsContentListPage implements OnInit, OnDestroy {

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
		track: "Contents"
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
			await this.trackAsync(`${this.title.track} | No Organization`, "Check");
			await this.appFormsSvc.hideLoadingAsync(async () => await this.backAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
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
			await this.trackAsync(`${this.title.track} | No Permission`, "Check");
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Mode: "UpdateSidebarWithCategories" });

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

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.search");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.contents.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.cms.contents.title.search"), "search", () => this.openSearchAsync(false))
			];
			if (this.canUpdate) {
				this.actions.push(
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
					this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
				);
			}

			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "CMS.Content") {
					this.prepareResults();
				}
			}, `CMS.Contents:${(this.category !== undefined ? ":" + this.category.ID : "")}:Refresh`);

			this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${(this.category === undefined ? this.organization.Title : this.organization.Title + " :: " + this.category.FullTitle)}]` });
			await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync(async () => {
				if (this.category !== undefined && this.category.childrenIDs === undefined) {
					await this.portalsCmsSvc.refreshCategoryAsync(this.category.ID, async _ => await this.appFormsSvc.showToastAsync("The category was freshen-up"));
				}
			}));
		}
	}

	track(index: number, content: Content) {
		return `${content.ID}@${index}`;
	}

	async onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.messages.searching"));
				this.contents = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				await this.searchAsync(async () => {
					this.infiniteScrollCtrl.disabled = false;
					await this.appFormsSvc.hideLoadingAsync();
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

	async onCancel() {
		if (this.searching) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			AppUtility.invoke(() => {
				this.onClear();
				this.filtering = false;
			}, 123);
		}
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
		return this.portalsCoreSvc.getPaginationPrefix("cms.content");
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const nextAsync = async (data: any) => {
			try {
				this.pageNumber++;
				this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
				this.pagination.PageNumber = this.pageNumber;
				this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
				await this.trackAsync(`${this.title.track} | Success`);
			}
			catch (e) {
				console.error("Error occurred while searching CMS content", e);
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchContent(this.request, nextAsync, async error => await Promise.all([
				this.appFormsSvc.showErrorAsync(error),
				this.trackAsync(`${this.title.track} | Error`)
			]));
		}
		else {
			await this.portalsCmsSvc.searchContentAsync(this.request, nextAsync, async error => await Promise.all([
				this.appFormsSvc.showErrorAsync(error),
				this.trackAsync(`${this.title.track} | Error`)
			]));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.contents.push(Content.get(o.ID) || Content.deserialize(o, Content.get(o.ID))));
		}
		else {
			const predicate: (content: Content) => boolean = obj => obj.SystemID === this.organization.ID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true) && (this.category !== undefined ? obj.CategoryID === this.category.ID || (obj.OtherCategories !== undefined && obj.OtherCategories.indexOf(this.category.ID) > -1) : true);
			let objects = results === undefined
				? Content.instances.toList(predicate)
				: Content.toList(results).Where(predicate);
			objects = objects.OrderByDescending(obj => obj.StartDate).ThenByDescending(obj => obj.PublishedTime).ThenByDescending(obj => obj.LastModified);
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.contents = results === undefined
				? objects.ToArray()
				: this.contents.concat(objects.ToArray());
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	async showActionsAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async openSearchAsync(filtering: boolean = true) {
		await this.listCtrl.closeSlidingItems();
		if (filtering) {
			this.filtering = true;
			PlatformUtility.focus(this.searchCtrl);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
			this.objects = this.contents.map(obj => obj);
		}
		else {
			await this.configSvc.navigateForwardAsync("/portals/cms/contents/search");
		}
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		const params: { [key: string]: string } = {};
		if (AppUtility.isNotEmpty(this.categoryID)) {
			params["CategoryID"] = this.categoryID;
		}
		if (this.contentType !== undefined) {
			params["RepositoryEntityID"] = this.contentType.ID;
			await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, params));
		}
	}

	async viewAsync(event: Event, content: Content) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(content.routerURI);
	}

	async editAsync(event: Event, content: Content) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		if (this.canUpdate) {
			await this.configSvc.navigateForwardAsync(content.routerURI.replace("/view/", "/update/"));
		}
	}

	private async backAsync(message: string, url?: string) {
		await this.listCtrl.closeSlidingItems();
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message,
			undefined,
			async () => await this.configSvc.navigateHomeAsync(url),
			await this.configSvc.getResourceAsync("common.buttons.ok")
		);
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("CMS.Content", this.organization.ID, this.module !== undefined ? this.module.ID : undefined, this.contentType !== undefined ? this.contentType.ID : undefined);
		await this.trackAsync(this.actions[2].text, "Export");
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Content",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			async _ => {
				await this.appFormsSvc.showLoadingAsync();
				await this.trackAsync(this.actions[3].text, "Import");
				this.contents = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Content.instances
					.toArray(content => this.contentType !== undefined ? this.contentType.ID === content.RepositoryEntityID : this.organization.ID === content.SystemID)
					.map(content => content.ID)
					.forEach(id => Content.instances.remove(id));
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

	private async trackAsync(title: string, action?: string) {
		await TrackingUtility.trackAsync({ title: title, category: "Content", action: action || (this.searching ? "Search" : "Browse") });
	}

}
