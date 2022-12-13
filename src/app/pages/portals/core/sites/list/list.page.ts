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
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Site } from "@app/models/portals.core.all";

@Component({
	selector: "page-portals-core-sites-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsSitesListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private organization: Organization;
	private subscription: Subscription;
	private objects = new Array<Site>();

	isSystemAdministrator = false;
	canModerateOrganization = false;

	title = {
		track: "Sites",
		page: "Sites"
	};
	sites = new Array<Site>();
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
		filter: "Quick filter",
		cancel: "Cancel",
		edit: "Update this site",
		open: "Open  this site",
		versions: "Versions",
		refresh: "Refresh",
		cache: "Clear cache"
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

	get totalDisplays() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			AppEvents.off(this.portalsCoreSvc.name, "Sites:Refresh");
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.searching = this.configSvc.currentURL.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.sites.title.${(this.searching ? "search" : "list")}`);
		this.title.track = AppUtility.format(title, { info: ""});

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		if (!this.isSystemAdministrator && this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check").then(async () => this.appFormsSvc.showConfirmAsync(
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				() => this.configSvc.navigateRootAsync("/portals/core/organizations/list/all")
			));
			return;
		}

		if (!this.canModerateOrganization) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.labels = {
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			open: await this.configSvc.getResourceAsync("portals.sites.list.open"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title")
		};

		this.searching = this.configSvc.currentURL.endsWith("/search");
		this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: this.isSystemAdministrator ? "" : `[${this.organization.Title}]` });

		const systemID = this.configSvc.requestParams["SystemID"];
		if (!this.isSystemAdministrator) {
			if (systemID !== undefined) {
				this.sites = Site.instances.filter(site => site.SystemID === systemID).toArray();
				if (this.sites.length < 1) {
					await this.portalsCoreSvc.searchSitesAsync(AppPagination.buildRequest({ And: [{ SystemID: { Equals: systemID } }] }, { Title: "Ascending" }), () => this.sites = Site.instances.filter(site => site.SystemID === systemID).toArray(), undefined, true, true);
				}
			}
			else if (this.portalsCoreSvc.activeOrganizations.length <= 100) {
				this.configSvc.appTitle = this.title.page = this.title.track;
				const organizations = new Array<Organization>();
				await Promise.all(this.portalsCoreSvc.activeOrganizations.map(async id => {
					await this.portalsCoreSvc.getOrganizationAsync(id);
					const organization = Organization.get(id);
					if (organization !== undefined && this.portalsCoreSvc.canModerateOrganization(organization)) {
						organizations.push(organization);
						if (Site.instances.find(site => site.SystemID === organization.ID) === undefined) {
							await this.portalsCoreSvc.searchSitesAsync(AppPagination.buildRequest({ And: [{ SystemID: { Equals: organization.ID } }] }, { Title: "Ascending" }), undefined, undefined, true, true);
						}
					}
				}));
				this.sites = organizations.flatMap(organization => Site.instances.toArray(site => site.SystemID === organization.ID));
			}
			await this.appFormsSvc.hideLoadingAsync();
		}

		this.filterBy.And = this.isSystemAdministrator && systemID === undefined
			? []
			: [{ SystemID: { Equals: systemID } }];

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.sites.list.search");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else if (this.isSystemAdministrator) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.sites.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.sites.title.search"), "search", () => this.openSearch(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel())
			];
			this.startSearch(() => this.appFormsSvc.hideLoadingAsync());
			AppEvents.on("Portals", info => {
				if (info.args.Object === "Site") {
					if (info.args.Type === "Created" || info.args.Type === "Deleted") {
						AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy), this.paginationPrefix);
					}
					if (info.args.Type === "Deleted") {
						Site.instances.remove(info.args.ID);
						this.sites.removeAt(this.sites.findIndex(site => site.ID === info.args.ID));
					}
					this.prepareResults();
				}
			}, "Sites:Refresh");
		}
	}

	track(index: number, site: Site) {
		return `${site.ID}@${index}`;
	}

	getInfo(site: Site) {
		return `${site.SubDomain}.${site.PrimaryDomain}` + (AppUtility.isNotEmpty(site.OtherDomains) ? `;${site.OtherDomains}` : "");
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
				this.sites = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.search(() => this.appFormsSvc.hideLoadingAsync().then(() => this.infiniteScrollCtrl.disabled = false));
			}
			else {
				this.sites = this.objects.filter(Site.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear() {
		this.filterBy.Query = undefined;
		this.sites = this.filtering ? this.objects.map(obj => obj) : [];
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
			this.search(() => AppUtility.invoke(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : undefined));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("site");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.trackAsync(this.title.track);
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchSites(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
		else {
			this.portalsCoreSvc.searchSitesAsync(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.sites.push(Site.get(o.ID) || Site.deserialize(o, Site.get(o.ID))));
		}
		else {
			const predicate: (site: Site) => boolean = this.isSystemAdministrator
				? this.configSvc.requestParams["SystemID"] !== undefined
					? obj => obj.SystemID === this.organization.ID
					: _ => true
				: obj => obj.SystemID === this.organization.ID;
			const objects = (results === undefined ? Site.instances.toArray(predicate) : Site.toArray(results).filter(predicate))
				.sortBy("Title", { name: "LastModified", reverse: true })
				.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
			this.sites = results === undefined ? objects : this.sites.concat(objects);
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

	create() {
		this.do(() => this.configSvc.navigateForwardAsync("/portals/core/sites/create"));
	}

	openSearch(filtering: boolean = true) {
		this.do(() => {
			if (filtering) {
				this.filtering = true;
				AppUtility.invoke(async () => this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter")).then(() => PlatformUtility.focus(this.searchCtrl));
				this.objects = this.sites.map(obj => obj);
			}
			else {
				this.configSvc.navigateForwardAsync("/portals/core/sites/search");
			}
		});
	}

	edit(event: Event, site: Site) {
		this.do(() => this.configSvc.navigateForwardAsync(site.routerURI), event);
	}

	open(event: Event, site: Site) {
		this.do(() => PlatformUtility.openURL(this.portalsCoreSvc.getSiteURL(site)), event);
	}

	clearCache(event: Event, site: Site) {
		this.do(() => this.portalsCoreSvc.clearCacheAsync("site", site.ID), event);
	}

	refresh(event: Event, site: Site) {
		this.do(() => this.portalsCoreSvc.refreshSiteAsync(site.ID, () => this.appFormsSvc.showToastAsync("The site was freshen-up")), event);
	}

	viewVersions(event: Event, site: Site) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(site.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "Site", id: site.ID })), event);
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => await Promise.all([
				this.portalsCoreSvc.exportToExcelAsync("Site", this.organization.ID),
				this.trackAsync(this.actions[2].text, "Export")
			]),
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync("Site", this.organization.ID).then(() => this.trackAsync(this.actions[3].text, "Import"));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Site", action: action || "Browse" });
	}

}
