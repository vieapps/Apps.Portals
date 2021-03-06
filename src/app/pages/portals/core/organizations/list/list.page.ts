import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization } from "@app/models/portals.core.organization";
import { UserProfile } from "@app/models/user";

@Component({
	selector: "page-portals-core-organizations-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsOrganizationsListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private owner: string;
	private objects = new Array<Organization>();

	isSystemAdministrator = false;
	title = "Organizations";
	organizations = new Array<Organization>();
	searching = false;
	filtering = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { Title: "Ascending" };
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;
	labels = {
		edit: "Update this module",
		active: "Set active",
		sites: "View the list of sites",
		cache: "Clear cache",
		filter: "Quick filter",
		cancel: "Cancel"
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

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			AppEvents.off(this.portalsCoreSvc.name, "Organizations:Refresh");
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);

		if (!this.isSystemAdministrator) {
			this.organizations = [];
			await Promise.all(this.portalsCoreSvc.activeOrganizations.map(async id => {
				await this.portalsCoreSvc.getOrganizationAsync(id);
				const organization = Organization.get(id);
				if (organization !== undefined && this.portalsCoreSvc.canModerateOrganization(organization)) {
					this.organizations.push(organization);
				}
			}));
			if (this.organizations.length < 1) {
				await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync("Hmmmmmm...."));
				await this.configSvc.navigateHomeAsync();
				return;
			}
			else {
				this.fetchOwners();
			}
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			active: await this.configSvc.getResourceAsync("portals.organizations.list.active"),
			sites: await this.configSvc.getResourceAsync("portals.sites.title.list", { info: "" }),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title"),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.organizations.title.${(this.searching ? "search" : "list")}`);
		this.owner = await this.configSvc.getResourceAsync("portals.organizations.list.owner");

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.organizations.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else if (this.isSystemAdministrator) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.organizations.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.organizations.title.search"), "search", () => this.openSearchAsync(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
			];
			await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
			AppEvents.on("Portals", info => {
				if (info.args.Object === "Organization" && (info.args.Type === "Created" || info.args.Type === "Deleted")) {
					this.prepareResults();
				}
			}, "Organizations:Refresh");
			if (this.configSvc.isDebug) {
				console.log("<Portals>: Organizations", this.configSvc.requestParams, this.filterBy, this.sortBy);
			}
		}
		else {
			await this.appFormsSvc.hideLoadingAsync();
		}
	}

	track(index: number, organization: Organization) {
		return `${organization.ID}@${index}`;
	}

	getInfo(organization: Organization) {
		return AppUtility.format(this.owner, { owner: organization.owner })
			+ (this.configSvc.screenWidth < 1024 ? "" : (AppUtility.isNotEmpty(organization.Description) ? ` - ${(organization.Description.length > 30 ? organization.Description.substr(0, 30) + " ..." : organization.Description)}` : ""));
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
				this.organizations = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				await this.searchAsync(async () => {
					this.infiniteScrollCtrl.disabled = false;
					await this.appFormsSvc.hideLoadingAsync();
				});
			}
			else {
				this.organizations = this.objects.filter(Organization.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear() {
		this.filterBy.Query = undefined;
		this.organizations = this.filtering ? this.objects.map(obj => obj) : [];
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
		return this.portalsCoreSvc.getPaginationPrefix("organization");
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
			this.subscription = this.portalsCoreSvc.searchOrganization(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCoreSvc.searchOrganizationAsync(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.organizations.push(Organization.get(o.ID) || Organization.deserialize(o, Organization.get(o.ID))));
		}
		else {
			let objects = results === undefined
				? Organization.instances.toList()
				: Organization.toList(results);
			objects = objects.OrderBy(obj => obj.Title).ThenByDescending(obj => obj.LastModified);
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.organizations = results === undefined
				? objects.ToArray()
				: this.organizations.concat(objects.ToArray());
		}
		this.fetchOwners();
		if (onNext !== undefined) {
			onNext();
		}
	}

	private fetchOwners() {
		this.organizations.forEach(async organization => {
			if (AppUtility.isEmpty(organization.owner) && AppUtility.isNotEmpty(organization.OwnerID)) {
				await this.usersSvc.getProfileAsync(organization.OwnerID, _ => organization.owner = (UserProfile.get(organization.OwnerID) || new UserProfile("Unknonwn")).Name);
			}
		});
	}

	async showActionsAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		if (this.isSystemAdministrator) {
			await this.configSvc.navigateForwardAsync("/portals/core/organizations/create");
		}
	}

	async openSearchAsync(filtering: boolean = true) {
		await this.listCtrl.closeSlidingItems();
		if (filtering) {
			this.filtering = true;
			PlatformUtility.focus(this.searchCtrl);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
			this.objects = this.organizations.map(obj => obj);
		}
		else {
			await this.configSvc.navigateForwardAsync("/portals/core/organizations/search");
		}
	}

	async openAsync(event: Event, organization: Organization) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		if (this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(organization)) {
			await this.configSvc.navigateForwardAsync(organization.routerURI);
		}
	}

	async setActiveAsync(event: Event, organization: Organization) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.setActiveOrganizationAsync(organization);
	}

	isActive(organization: Organization) {
		return organization !== undefined && Organization.active !== undefined && AppUtility.isEquals(organization.ID, Organization.active.ID);
	}

	async viewSitesAsync(event: Event, organization: Organization) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateHomeAsync(this.portalsCoreSvc.getAppURL(undefined, "list", organization.ansiTitle, { SystemID: organization.ID }, "site", "core"));
	}

	async clearCacheAsync(event: Event, organization: Organization) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.clearCacheAsync("organization", organization.ID);
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("Organization", this.portalsCoreSvc.activeOrganization.ID);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync("Organization", this.portalsCoreSvc.activeOrganization.ID);
	}

}
