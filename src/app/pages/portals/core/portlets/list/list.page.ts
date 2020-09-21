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
import { NestedObject } from "@app/models/portals.base";
import { Organization } from "@app/models/portals.core.organization";
import { Desktop } from "@app/models/portals.core.desktop";
import { Portlet } from "@app/models/portals.core.portlet";

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

	@ViewChild(IonSearchbar, { static: false }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: false }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild("originalItems", { static: false }) private listCtrl: IonList;

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
	sortBy = {
		Zone: "Ascending",
		OrderIndex: "Ascending"
	};
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
	processing = false;
	redordering = false;
	zones: Array<NestedObject>;
	buttons = {
		save: "Save",
		cancel: "Cancel"
	};
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

		if (this.desktop !== undefined) {
			this.filterBy.And.push({ DesktopID: { Equals: this.desktop.ID } });
		}
		else {
			this.filterBy.And.push({ SystemID: { Equals: this.organization.ID } });
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			advancedEdit: await this.configSvc.getResourceAsync("portals.common.advancedEdit")
		};

		this.buttons = {
			save: await this.configSvc.getResourceAsync("common.buttons.save"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		await this.prepareTitleAsync();

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
				this.actions.insert(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.portlets.title.reorder"), "swap-vertical", () => this.openReorderAsync()), 1);
				this.preparePortlets();
				await this.appFormsSvc.hideLoadingAsync();
			}
			else {
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
			}
			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "Portlet") {
					if (this.desktop !== undefined && this.desktop.ID === info.args.DesktopID) {
						this.preparePortlets();
					}
					else {
						this.prepareResults();
					}
				}
			}, "Portlets:Refresh");
		}

		if (this.configSvc.isDebug) {
			console.log("<Portals>: Portlets", this.configSvc.requestParams, this.filterBy, this.sortBy);
		}
	}

	private async prepareTitleAsync() {
		if (this.redordering) {
			this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("portals.portlets.title.reorder");
		}
		else {
			const title = await this.configSvc.getResourceAsync(`portals.portlets.title.${(this.searching ? "search" : "list")}`);
			this.configSvc.appTitle = this.title = AppUtility.format(title, { info: this.desktop !== undefined ? `[${this.desktop.FullTitle}]` : "" });
		}
	}

	private preparePortlets() {
		this.portlets = this.desktop.portlets.sortBy("Zone", "OrderIndex");
	}

	track(index: number, portlet: Portlet) {
		return `${portlet.ID}@${index}`;
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
			(results || []).forEach(o => this.portlets.push(Portlet.get(o.ID) || Portlet.deserialize(o, Portlet.get(o.ID))));
		}
		else {
			const predicate: (portlet: Portlet) => boolean = this.desktop !== undefined
				? obj => obj.DesktopID === this.desktop.ID
				: obj => obj.SystemID === this.organization.ID;
			let objects = results === undefined
				? Portlet.instances.toList(predicate)
				: Portlet.toList(results).Where(predicate);
			if (this.desktop === undefined) {
				objects = objects.OrderBy(obj => obj.DesktopID);
			}
			objects = objects.OrderBy(obj => obj.Zone).ThenBy(obj => obj.OrderIndex);
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

	async editAsync(event: Event, portlet: Portlet, isAdvancedMode: boolean = false) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(portlet.getRouterURI({ ID: portlet.ID, DesktopID: portlet.DesktopID, Advanced: isAdvancedMode }));
	}

	private updateReorderItems(zoneName: string, zoneItems: Array<NestedObject>, zoneTitle: string, zoneIndex: number) {
		this.zones.push({
			ID: zoneName,
			Title: zoneTitle,
			OrderIndex: zoneIndex,
			Children: zoneItems.map(zoneItem => zoneItem)
		} as NestedObject);
	}

	private async openReorderAsync() {
		let zoneName = "";
		let zoneItems = new Array<NestedObject>();
		let zoneIndex = -1;
		let itemIndex = 0;
		const zoneTitle = await this.configSvc.getResourceAsync("portals.portlets.update.reorder");
		this.zones = [];
		this.portlets.sortBy("Zone", "OrderIndex").forEach(portlet => {
			if (zoneName !== portlet.Zone) {
				if (zoneName !== "" ) {
					this.updateReorderItems(zoneName, zoneItems, AppUtility.format(zoneTitle, { zone: zoneName }), zoneIndex);
				}
				zoneName = portlet.Zone;
				zoneItems = [];
				zoneIndex++;
				itemIndex = -1;
			}
			const originalPortlet = portlet.originalPortlet;
			const originalDesktop = portlet.originalDesktop;
			const contentType = originalPortlet !== undefined ? originalPortlet.contentType : portlet.contentType;
			itemIndex++;
			zoneItems.push({
				ID: portlet.ID,
				Title: portlet.Title + " [" + (contentType !== undefined ? contentType.Title : "Static") + (AppUtility.isNotEmpty(portlet.OriginalPortletID) ? ` @ ${(originalDesktop !== undefined ? originalDesktop.FullTitle : "unknown")}` : "") + "]",
				OrderIndex: itemIndex
			} as NestedObject);
		});
		this.updateReorderItems(zoneName, zoneItems, AppUtility.format(zoneTitle, { zone: zoneName }), zoneIndex);
		this.ordered = this.zones.map(z => {
			return {
				ID: z.ID,
				Title: z.Title,
				OrderIndex: z.OrderIndex,
				Children: z.Children.map(i => {
					return {
						ID: i.ID,
						Title: i.Title,
						OrderIndex: i.OrderIndex
					} as NestedObject;
				})
			} as NestedObject;
		});
		this.hash = AppCrypto.hash(this.ordered);
		this.redordering = true;
		await this.prepareTitleAsync();
	}

	trackReorderItem(index: number, item: NestedObject) {
		return `${item.ID}@${index}`;
	}

	onReordered(event: any, zoneName: string) {
		try {
			this.ordered.find(zone => zone.ID === zoneName).Children.move(event.detail.from as number, event.detail.to as number).forEach((portlet, orderIndex) => portlet.OrderIndex = orderIndex);
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
			const reordered = this.ordered.toList().Select(zone => zone.Children).SelectMany(portlets => portlets.toList()).Select(portlet => {
				return {
					ID: portlet.ID,
					OrderIndex: portlet.OrderIndex
				};
			}).ToArray();
			await this.portalsCoreSvc.updateDesktopAsync(
				{
					ID: this.desktop.ID,
					Portlets: reordered
				},
				async data => {
					this.desktop.portlets.forEach(portlet => portlet.OrderIndex = reordered.find(p => p.ID === portlet.ID).OrderIndex);
					this.preparePortlets();
					await this.cancelReorderAsync(() => {
						this.processing = false;
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Desktop", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
					});
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

}
