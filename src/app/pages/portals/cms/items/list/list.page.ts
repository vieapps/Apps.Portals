import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
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
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Item } from "@app/models/portals.cms.item";

@Component({
	selector: "page-portals-cms-items-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class CmsItemListPage implements OnInit, OnDestroy {

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

	title = "Items";
	items = new Array<Item>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
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
			: await this.portalsCoreSvc.getActiveModuleAsync();

		this.contentType = this.contentType || this.portalsCmsSvc.getDefaultContentTypeOfContent(this.module);

		this.canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Item", this.contentType === undefined ? undefined : this.contentType.Privileges);
		this.canContribute = this.canUpdate || this.authSvc.isContributor(this.portalsCoreSvc.name, "Item", this.contentType === undefined ? undefined : this.contentType.Privileges);
		if (!this.canContribute) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		AppEvents.broadcast(this.portalsCmsSvc.name, { Mode: "UpdateSidebarWithContentTypes" });

		this.buttons = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			view: await this.configSvc.getResourceAsync("common.buttons.view")
		};

		this.labels = {
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.cms.contents.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: "" });

		this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
		if (this.module !== undefined) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.module.ID } });
		}
		if (this.contentType !== undefined) {
			this.filterBy.And.push({ RepositoryEntityID: { Equals: this.contentType.ID } });
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

			this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${(this.contentType === undefined ? this.organization.Title : this.organization.Title + " :: " + this.contentType.Title)}]` });
			await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());

			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "CMS.Item") {
					this.prepareResults();
				}
			}, "CMS.Items:Refresh");
		}

		if (this.configSvc.isDebug) {
			console.log("<CMS Portals>: Items (request info)", this.configSvc.requestParams, this.filterBy, this.sortBy);
			console.log("<CMS Portals>: Items (management info)", `\n- Organization:`, this.organization, `\n- Module:`, this.module, `\n- Content Type:`, this.contentType);
		}
	}

	track(index: number, item: Item) {
		return `${item.ID}@${index}`;
	}

	async onSearch(event: any) {
		if (this.searching) {
			if (this.subscription !== undefined) {
				this.subscription.unsubscribe();
				this.subscription = undefined;
			}
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.messages.searching"));
				this.items = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				await this.searchAsync(async () => {
					this.infiniteScrollCtrl.disabled = false;
					await this.appFormsSvc.hideLoadingAsync();
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

	onClear() {
		this.filterBy.Query = undefined;
		this.items = this.filtering ? this.objects.map(obj => obj) : [];
	}

	async onCancel() {
		if (this.searching) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			PlatformUtility.invoke(() => {
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
		return this.portalsCoreSvc.getPaginationPrefix("cms.item");
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.searchItem(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCmsSvc.searchItemAsync(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.items.push(Item.get(o.ID) || Item.deserialize(o, Item.get(o.ID))));
		}
		else {
			const predicate: (item: Item) => boolean = obj => obj.SystemID === this.organization.ID && (this.module !== undefined ? obj.RepositoryID === this.module.ID : true) && (this.contentType !== undefined ? obj.RepositoryEntityID === this.contentType.ID : true);
			let objects = results === undefined
				? Item.instances.toList(predicate)
				: Item.toList(results).Where(predicate);
			objects = objects.OrderByDescending(obj => obj.Created);
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.items = results === undefined
				? objects.ToArray()
				: this.items.concat(objects.ToArray());
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
			this.objects = this.items.map(obj => obj);
		}
		else {
			await this.configSvc.navigateForwardAsync("/portals/cms/items/search");
		}
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		const params: { [key: string]: string } = {
			SystemID: this.organization.ID,
			RepositoryID: this.module.ID
		};
		if (this.contentType !== undefined) {
			params["RepositoryEntityID"] = this.contentType.ID;
			await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(this.contentType, "create", undefined, params));
		}
	}

	async viewAsync(event: Event, item: Item) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(item.routerURI);
	}

	async editAsync(event: Event, item: Item) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		if (this.canUpdate) {
			await this.configSvc.navigateForwardAsync(item.routerURI.replace("/view/", "/update/"));
		}
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

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("CMS.Item", this.organization.ID, this.module !== undefined ? this.module.ID : undefined, this.contentType !== undefined ? this.contentType.ID : undefined);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync(
			"CMS.Item",
			this.organization.ID,
			this.module !== undefined ? this.module.ID : undefined,
			this.contentType !== undefined ? this.contentType.ID : undefined,
			async _ => {
				await this.appFormsSvc.showLoadingAsync();
				this.items = [];
				this.pageNumber = 0;
				AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination), this.paginationPrefix);
				Item.instances
					.toArray(item => this.contentType !== undefined ? this.contentType.ID === item.RepositoryEntityID : this.organization.ID === item.SystemID)
					.map(item => item.ID)
					.forEach(id => Item.instances.remove(id));
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
