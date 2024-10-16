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
import { NestedObject } from "@app/models/portals.base";
import { Organization, Desktop, Portlet } from "@app/models/portals.core.all";

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

	title = {
		track: "Portlets",
		page: "Portlets"
	};
	zones = new Array<string>();
	portlets = new Array<Portlet>();
	filtering = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
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
		advancedEdit: "Update this portlet in advanced mode",
		filter: "Quick filter",
		versions: "Versions",
		refresh: "Refresh",
		cancel: "Cancel"
	};
	processing = false;
	redordering = false;
	reorderingPortlets = new Array<NestedObject>();
	orderedPortlets = new Array<NestedObject>();
	buttons = {
		save: "Save",
		cancel: "Cancel"
	};
	private hash = "";
	private objects = new Array<Portlet>();

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
		AppEvents.off(this.portalsCoreSvc.name, "Portlets:Refresh");
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		const title = await this.configSvc.getResourceAsync("portals.portlets.title.list");
		this.title.track = AppUtility.format(title, { info: "" });

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		this.desktop = Desktop.get(this.configSvc.requestParams["DesktopID"]);

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		if (!this.isSystemAdministrator && this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check").then(async () => this.appFormsSvc.showConfirmAsync(
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				() => this.configSvc.navigateRootAsync("/portals/core/organizations/list/all")
			));
			return;
		}

		if (!this.canModerateOrganization || this.organization === undefined) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.filterBy.And.push({ SystemID: { Equals: this.organization.ID } });
		if (this.desktop !== undefined) {
			this.filterBy.And.push({ DesktopID: { Equals: this.desktop.ID } });
			this.zones = await this.portalsCoreSvc.getTemplateZonesAsync(this.desktop.ID);
		}
		this.prepareTitleAsync();

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			advancedEdit: await this.configSvc.getResourceAsync("portals.common.advancedEdit"),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.buttons = {
			save: await this.configSvc.getResourceAsync("common.buttons.save"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.portlets.title.create"), "create", () => this.create())
		];

		if (this.desktop !== undefined && this.desktop.portlets !== undefined && !!this.desktop.portlets.length) {
			this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.portlets.title.reorder"), "swap-vertical", () => this.openReorder()));
			this.preparePortlets();
			this.trackAsync(this.title.track).then(() => this.appFormsSvc.hideLoadingAsync());
		}
		else {
			this.startSearch(() => this.appFormsSvc.hideLoadingAsync());
		}

		AppEvents.on(this.portalsCoreSvc.name, info => {
			const args = info.args;
			if (args.Object === "Portlet") {
				if (info.args.Type === "Deleted") {
					Portlet.instances.remove(info.args.ID);
					this.portlets.removeAt(this.portlets.findIndex(portlet => portlet.ID === info.args.ID));
				}
				this.do(this.desktop !== undefined && this.desktop.ID === args.DesktopID ? () => this.preparePortlets() : () => this.prepareResults());
				if (this.desktop === undefined && (info.args.Type === "Created" || info.args.Type === "Deleted")) {
					AppPagination.remove(AppPagination.buildRequest(this.filterBy, this.sortBy), this.paginationPrefix);
				}
			}
		}, "Portlets:Refresh");
	}

	private async prepareTitleAsync() {
		if (this.redordering) {
			this.configSvc.appTitle = this.title.page = await this.configSvc.getResourceAsync("portals.portlets.title.reorder");
		}
		else {
			const title = await this.configSvc.getResourceAsync("portals.portlets.title.list");
			this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: this.desktop !== undefined ? `[${this.desktop.FullTitle}]` : "" });
		}
	}

	private preparePortlets() {
		const portlets = (this.desktop.portlets || []).sortBy("Zone", "OrderIndex");
		this.portlets.clear();
		this.zones.forEach(zone => this.portlets.merge(portlets.filter(portlet => portlet.Zone === zone)));
		this.portlets.merge(portlets.except(this.portlets)).filter(portlet => portlet.Versions === undefined).forEach(portlet => this.portalsCoreSvc.findVersions("Portlet", portlet.ID));
	}

	track(index: number, portlet: Portlet) {
		return `${portlet.ID}@${index}`;
	}

	onSearch(event: any) {
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			this.portlets = this.objects.filter(Portlet.getFilterBy(this.filterBy.Query));
		}
		else {
			this.onClear();
		}
	}

	onClear(isOnCanceled?: boolean) {
		if (this.filtering) {
			this.filterBy.Query = undefined;
			this.portlets = this.objects.map(obj => obj);
			if (isOnCanceled) {
				this.filtering = false;
				this.objects = [];
			}
		}
	}

	onCancel() {
		this.onClear(true);
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
		return this.portalsCoreSvc.getPaginationPrefix("portlet");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title.track);
		};
		this.portalsCoreSvc.searchPortletsAsync(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		const predicate: (portlet: Portlet) => boolean = this.desktop !== undefined
			? object => object.DesktopID === this.desktop.ID
			: object => object.SystemID === this.organization.ID;
		let objects = results === undefined ? Portlet.instances.toArray(predicate) : Portlet.toArray(results).filter(predicate);
		objects = this.desktop === undefined ? objects.sortBy("DesktopID", "Zone", "OrderIndex") : objects.sortBy("Zone", "OrderIndex");
		objects = results === undefined && this.pagination !== undefined ? objects.take(this.pageNumber * this.pagination.PageSize) : objects;
		this.portlets = results === undefined ? objects : this.portlets.concat(objects);
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
		this.do(async () => {
			this.filtering = true;
			this.objects = this.portlets.map(obj => obj);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
			PlatformUtility.focus(this.searchCtrl);
		});
	}

	create() {
		this.do(this.desktop !== undefined ? () => this.configSvc.navigateForwardAsync(`/portals/core/portlets/create?x-request=${AppCrypto.jsonEncode({ DesktopID: this.desktop.ID })}`) : () => {});
	}

	edit(event: Event, portlet: Portlet, isAdvancedMode: boolean = false) {
		this.do(() => this.configSvc.navigateForwardAsync(portlet.getRouterURI({ ID: portlet.ID, DesktopID: portlet.DesktopID, Advanced: isAdvancedMode })), event);
	}

	refresh(event: Event, portlet: Portlet) {
		this.do(() => this.portalsCoreSvc.refreshPortletAsync(portlet.ID, () => this.appFormsSvc.showToastAsync("The portlet was freshen-up")), event);
	}

	viewVersions(event: Event, portlet: Portlet) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(portlet.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "Portlet", id: portlet.ID })), event);
	}

	private openReorder() {
		AppUtility.invoke(async () => {
			let zoneName = "";
			let zoneItems = new Array<NestedObject>();
			let zoneIndex = -1;
			let itemIndex = 0;
			const zoneTitle = await this.configSvc.getResourceAsync("portals.portlets.update.reorder");
			this.reorderingPortlets = [];
			this.portlets.forEach(portlet => {
				if (zoneName !== portlet.Zone) {
					if (zoneName !== "" ) {
						this.updateReorderSegment(zoneName, zoneItems, AppUtility.format(zoneTitle, { zone: zoneName }), zoneIndex);
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
			this.updateReorderSegment(zoneName, zoneItems, AppUtility.format(zoneTitle, { zone: zoneName }), zoneIndex);
			this.zones.filter(name => this.reorderingPortlets.findIndex(zone => zone.ID === name) > -1).forEach((name, orderIndex) => this.reorderingPortlets.find(zone => zone.ID === name).OrderIndex = orderIndex);
			this.orderedPortlets = this.reorderingPortlets.map(zone => ({
				ID: zone.ID,
				Title: zone.Title,
				OrderIndex: zone.OrderIndex,
				Children: zone.Children.map(portlet => ({
					ID: portlet.ID,
					Title: portlet.Title,
					OrderIndex: portlet.OrderIndex
				} as NestedObject))
			} as NestedObject));
			this.hash = AppCrypto.hash(this.orderedPortlets);
			this.redordering = true;
			this.processing = false;
			await this.prepareTitleAsync();
		});
	}

	private updateReorderSegment(zoneName: string, zoneItems: Array<NestedObject>, zoneTitle: string, zoneIndex: number) {
		this.reorderingPortlets.push({
			ID: zoneName,
			Title: zoneTitle,
			OrderIndex: zoneIndex,
			Children: zoneItems.map(zoneItem => zoneItem)
		} as NestedObject);
	}

	onReordered(event: any, zoneName: string) {
		try {
			this.orderedPortlets.find(zone => zone.ID === zoneName).Children.move(event.detail.from as number, event.detail.to as number).forEach((portlet, orderIndex) => portlet.OrderIndex = orderIndex);
		}
		catch (error) {
			console.error("Error occurred while reordering", error);
		}
		event.detail.complete();
	}

	doReorder() {
		if (this.hash !== AppCrypto.hash(this.orderedPortlets)) {
			this.processing = true;
			const orderedPortlets = this.orderedPortlets.map(zone => zone.Children).flatMap(portlets => portlets).map(portlet => ({
				ID: portlet.ID,
				OrderIndex: portlet.OrderIndex
			}));
			this.appFormsSvc.showLoadingAsync(this.title.track).then(() => this.portalsCoreSvc.updateDesktopAsync(
				{
					ID: this.desktop.ID,
					Portlets: orderedPortlets
				},
				data => {
					this.desktop.portlets.forEach(portlet => portlet.OrderIndex = orderedPortlets.find(p => p.ID === portlet.ID).OrderIndex);
					AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Desktop", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
					this.trackAsync(this.title.track, "ReOrder").then(() => this.cancelReorder());
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
		this.processing = false;
		this.redordering = false;
		this.reorderingPortlets = [];
		this.orderedPortlets = [];
		this.preparePortlets();
		this.prepareTitleAsync().then(() => this.appFormsSvc.hideLoadingAsync(onNext));
	}

	trackReorderingItem(index: number, item: NestedObject) {
		return `${item.ID}@${index}`;
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Portlet", action: action || "Browse" });
	}

}
