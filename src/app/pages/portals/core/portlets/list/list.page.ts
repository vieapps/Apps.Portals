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
import { Organization } from "@models/portals.core.organization";
import { Desktop } from "@models/portals.core.desktop";
import { Portlet } from "@models/portals.core.portlet";

@Component({
	selector: "page-portals-core-portlets-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsPortletsListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;

	private subscription: Subscription;
	private isSystemAdministrator = false;
	private canModerateOrganization = false;
	private organization: Organization;
	private desktop: Desktop;

	title = "Portlets";
	portlets = new Array<Portlet>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { Zone: "Ascending", OrderIndex: "Ascending" };
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;
	labels = {
		edit: "Update this portlet",
		advancedEdit: "Update this portlet in advanced mode"
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
			AppEvents.off(this.portalsCoreSvc.name, "Portlets:Refresh");
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		this.desktop = Desktop.get(this.configSvc.requestParams["DesktopID"]);

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		if (!this.isSystemAdministrator && this.organization === undefined) {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.canModerateOrganization || this.organization === undefined) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		this.filterBy.And.push({ SystemID: { Equals: this.organization.ID } });
		if (this.desktop !== undefined) {
			this.filterBy.And.push({ DesktopID: { Equals: this.desktop.ID } });
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			advancedEdit: await this.configSvc.getResourceAsync("portals.portlets.update.buttons.edit")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.portlets.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: this.desktop !== undefined ? `[${this.desktop.FullTitle}]` : "" });

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.portlets.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.portlets.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.portlets.title.search"), "search", () => this.openSearchAsync())
			];
			if (this.desktop !== undefined && this.desktop.portlets !== undefined && this.desktop.portlets.length > 0) {
				this.portlets = this.desktop.portlets.sort(AppUtility.getCompareFunction("Zone", "OrderIndex"));
				await this.appFormsSvc.hideLoadingAsync();
			}
			else {
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
			}
			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "Portlet") {
					if (this.desktop !== undefined && this.desktop.ID === info.args.DesktopID) {
						this.portlets = this.desktop.portlets.sort(AppUtility.getCompareFunction("Zone", "OrderIndex"));
					}
					else {
						this.prepareResults();
					}
				}
			}, "Portlets:Refresh");
		}

		if (this.configSvc.isDebug) {
			console.log("<Portlets>: show the list", this.organization, this.desktop, this.filterBy, this.sortBy, this.configSvc.requestParams);
		}
	}

	track(index: number, portlet: Portlet) {
		return `${portlet.ID}@${index}`;
	}

	getInfo(portlet: Portlet) {
		const contentType = portlet.contentType;
		const originalPortlet = portlet.originalPortlet;
		const originalDesktop = portlet.originalDesktop;
		return `Zone: ${portlet.Zone} #${portlet.OrderIndex} - Type: `
			+ (contentType !== undefined ? `${contentType.Title}` : "Static")
			+ (AppUtility.isNotEmpty(portlet.OriginalPortletID) ? ` (${(originalPortlet !== undefined ? originalPortlet.Title + (originalDesktop !== undefined ? ` @ ${originalDesktop.FullTitle}` : "") : "unknown")})` : "");
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.portlets = [];
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
		this.portlets = [];
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
		return this.portalsCoreSvc.getPaginationPrefix("portlet");
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
			this.subscription = this.portalsCoreSvc.searchPortlet(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCoreSvc.searchPortletAsync(this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error));
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
			(results || []).forEach(o => this.portlets.push(Portlet.get(o.ID)));
		}
		else {
			let objects = new List(results === undefined ? Portlet.all : results.map(o => Portlet.get(o.ID)));
			if (this.desktop !== undefined) {
				objects = objects.Where(o => o.DesktopID === this.desktop.ID);
			}
			else {
				objects = objects.Where(o => o.SystemID === this.organization.ID).OrderBy(o => o.DesktopID);
			}
			objects = objects.OrderBy(o => o.Zone).ThenBy(o => o.OrderIndex);
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.portlets = results === undefined
				? objects.ToArray()
				: this.portlets.concat(objects.ToArray());
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
		await this.configSvc.navigateForwardAsync("/portals/core/portlets/search");
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		if (this.desktop !== undefined) {
			await this.configSvc.navigateForwardAsync(`/portals/core/portlets/create?x-request=${AppUtility.toBase64Url({ DesktopID: this.desktop.ID })}`);
		}
	}

	async editAsync(event: Event, portlet: Portlet) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(portlet.getRouterURI({ ID: portlet.ID, DesktopID: portlet.DesktopID }));
	}

	async editInAdvancedModeAsync(event: Event, portlet: Portlet) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(portlet.getRouterURI({ ID: portlet.ID, DesktopID: portlet.DesktopID, Advanced: true }));
	}

}
