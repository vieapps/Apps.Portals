import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization } from "@app/models/portals.core.organization";

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
	filterBy: AppDataFilter = {
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
		versions: "Versions",
		refresh: "Refresh",
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

		this.searching = this.configSvc.currentURL.endsWith("/search");
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.organizations.title.${(this.searching ? "search" : "list")}`);
		this.owner = await this.configSvc.getResourceAsync("portals.organizations.list.owner");

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
				this.trackAsync(`${this.title} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
				this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
				return;
			}
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			active: await this.configSvc.getResourceAsync("portals.organizations.list.active"),
			sites: await this.configSvc.getResourceAsync("portals.sites.title.list", { info: "" }),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.organizations.list.searchbar");
			this.appFormsSvc.hideLoadingAsync().then(() => PlatformUtility.focus(this.searchCtrl));
		}
		else if (this.isSystemAdministrator) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.organizations.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.organizations.title.search"), "search", () => this.openSearch(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll())
			];
			this.startSearch(() => this.appFormsSvc.hideLoadingAsync());
			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "Organization") {
					if (info.args.Type === "Created" || info.args.Type === "Deleted") {
						AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy), this.paginationPrefix);
					}
					if (info.args.Type === "Deleted") {
						Organization.instances.remove(info.args.ID);
						this.organizations.removeAt(this.organizations.findIndex(organization => organization.ID === info.args.ID));
					}
					this.prepareResults();
				}
			}, "Organizations:Refresh");
		}
		else {
			this.organizations.forEach((organization, index) => this.fetchInfo(organization, index));
			this.appFormsSvc.hideLoadingAsync().then(() => this.trackAsync(this.title));
		}
	}

	track(index: number, organization: Organization) {
		return `${organization.ID}@${index}`;
	}

	getInfo(organization: Organization) {
		return AppUtility.format(this.owner, { owner: organization.owner })
			+ (this.configSvc.screenWidth < 1024 ? "" : (AppUtility.isNotEmpty(organization.Description) ? ` - ${(organization.Description.length > 30 ? organization.Description.substr(0, 30) + " ..." : organization.Description)}` : ""));
	}

	onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				AppUtility.invoke(async () => this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.messages.searching")));
				this.organizations = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.search(() => this.appFormsSvc.hideLoadingAsync().then(() => this.infiniteScrollCtrl.disabled = false));
			}
			else {
				this.organizations = this.objects.filter(Organization.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear(isOnCanceled?: boolean) {
		if (this.searching || this.filtering) {
			this.filterBy.Query = undefined;
			this.organizations = this.filtering ? this.objects.map(object => object) : [];
			if (isOnCanceled) {
				this.filtering = false;
				this.objects = [];
				this.infiniteScrollCtrl.disabled = false;
			}
		}
	}

	onCancel() {
		if (this.searching) {
			this.configSvc.navigateBackAsync();
		}
		else {
			this.onClear(true);
		}
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
		return this.portalsCoreSvc.getPaginationPrefix("organization");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchOrganizations(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title)));
		}
		else {
			this.portalsCoreSvc.searchOrganizationsAsync(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title)));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			this.organizations.merge(results || []).map(organization => Organization.get(organization.ID) || Organization.deserialize(organization, Organization.get(organization.ID)));
		}
		else {
			const objects = (results === undefined ? Organization.instances.toArray() : Organization.toArray(results))
				.sortBy("Title", { name: "LastModified", reverse: true })
				.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
			this.organizations = results === undefined ? objects : this.organizations.concat(objects);
		}
		this.organizations.forEach((organization, index) => this.fetchInfo(organization, index));
		if (onNext !== undefined) {
			onNext();
		}
	}

	private doFetch(organization: Organization) {
		AppUtility.invoke(() => {
			if (AppUtility.isNotEmpty(organization.OwnerID)) {
				this.usersSvc.getProfileAsync(organization.OwnerID);
			}
		}, 123, true);
	}

	private fetchInfo(organization: Organization, defer: number = 1) {
		if (AppUtility.isEmpty(organization.owner) && AppUtility.isNotEmpty(organization.OwnerID)) {
			AppUtility.invoke(() => this.doFetch(organization), 234 + (13 * defer), true);
		}
	}

	private doRefresh(organizations: Organization[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title, "Refresh").then(() => this.fetchInfo(organizations[index], index));
			if (index < organizations.length - 1) {
				AppUtility.invoke(() => this.doRefresh(organizations, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0) {
			if (organizations.length > 1) {
				this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug ? () => console.log(`--- Start to refresh ${organizations.length} organizations -----------------`) : () => {});
			}
			else {
				this.portalsCoreSvc.fetchSchedulingTasks();
			}
		}
		this.portalsCoreSvc.refreshOrganizationAsync(organizations[index].ID, refreshNext, refreshNext, undefined, useXHR);
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
				this.objects = this.organizations.map(object => object);
				this.infiniteScrollCtrl.disabled = true;
				AppUtility.invoke(async () => this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter")).then(() => PlatformUtility.focus(this.searchCtrl));
			}
			else {
				this.configSvc.navigateForwardAsync("/portals/core/organizations/search");
			}
		});
	}

	create() {
		this.do(this.isSystemAdministrator ? () => this.configSvc.navigateForwardAsync("/portals/core/organizations/create") : () => {});
	}

	open(event: Event, organization: Organization) {
		this.do(this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(organization) ? () => this.configSvc.navigateForwardAsync(organization.routerURI) : () => {}, event);
	}

	setActive(event: Event, organization: Organization) {
		this.do(() => this.portalsCoreSvc.setActiveOrganization(organization), event);
	}

	isActive(organization: Organization) {
		return organization !== undefined && Organization.active !== undefined && AppUtility.isEquals(organization.ID, Organization.active.ID);
	}

	viewSites(event: Event, organization: Organization) {
		this.do(() => this.configSvc.navigateRootAsync(this.portalsCoreSvc.getAppURL(undefined, "list", organization.ansiTitle, { SystemID: organization.ID }, "site", "core")), event);
	}

	refresh(event: Event, organization: Organization) {
		this.do(() => this.doRefresh([organization], 0, true, () => this.appFormsSvc.showToastAsync("The organization was freshen-up")), event);
	}

	refreshAll() {
		this.doRefresh(Organization.instances.toArray(), 0, false, () => this.appFormsSvc.showToastAsync("All the organizatios were freshen-up"));
	}

	clearCache(event: Event, organization: Organization) {
		this.do(() => this.portalsCoreSvc.clearCacheAsync("organization", organization.ID), event);
	}

	viewVersions(event: Event, organization: Organization) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(organization.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "Organization", id: organization.ID })), event);
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("Organization", this.portalsCoreSvc.activeOrganization.ID);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync("Organization", this.portalsCoreSvc.activeOrganization.ID).then(() => this.trackAsync(this.actions[3].text, "Import"));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Organization", action: action || "Browse" });
	}

}
