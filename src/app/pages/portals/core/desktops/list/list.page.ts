import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Desktop } from "@app/models/portals.core.all";

@Component({
	selector: "page-portals-core-desktops-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsDesktopsListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;

	private organization: Organization;
	private parentID: string;
	private subscription: Subscription;

	title = {
		track: "Desktops",
		page: "Desktops"
	};
	desktops = new Array<Desktop>();
	parentDesktop: Desktop;
	searching = false;
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
		children: "{{number}} children: {{children}}",
		alias: "Alias",
		edit: "Update this desktop",
		refresh: "Refresh",
		versions: "Versions",
		view: "View the list of child desktops",
		portlets: "Portlets",
		filter: "Quick filter",
		cancel: "Cancel",
		cache: "Clear cache"
	};
	filtering = false;
	private objects = new Array<Desktop>();

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
		return this.pagination !== undefined || this.parentDesktop !== undefined;
	}

	get totalDisplays() {
		return this.parentDesktop !== undefined
			? this.parentDesktop.childrenIDs.length
			: AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.parentDesktop !== undefined
			? this.parentDesktop.childrenIDs.length
			: this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			if (this.parentDesktop !== undefined) {
				AppEvents.off(this.portalsCoreSvc.name, `Desktops:${this.parentDesktop.ID}:Refresh`);
			}
			else {
				AppEvents.off(this.portalsCoreSvc.name, "Desktops:Refresh");
			}
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		if (this.organization === undefined) {
			this.appFormsSvc.showConfirmAsync(
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				() => this.configSvc.navigateRootAsync("/portals/core/organizations/list/all")
			);
			return;
		}

		this.searching = this.configSvc.currentURL.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.desktops.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title.track = AppUtility.format(title, { info: "" });

		if (!this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.labels = {
			children: await this.configSvc.getResourceAsync("portals.desktops.list.children"),
			alias: await this.configSvc.getResourceAsync("portals.desktops.controls.Alias.label"),
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			view: await this.configSvc.getResourceAsync("portals.desktops.list.view"),
			portlets: await this.configSvc.getResourceAsync("portals.portlets.title.list", { info: "" }),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title")
		};

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.desktops.list.searchbar");
			await this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl));
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.desktops.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.desktops.title.search"), "search", () => this.openSearch(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel()),
				this.appFormsSvc.getActionSheetButton(this.labels.cache, "dice", () => this.clearAllCache()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll())
			];

			this.filterBy.And = [
				{ SystemID: { Equals: this.organization.ID } },
				{ ParentID: "IsNull" }
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentDesktop = Desktop.get(this.parentID);

			if (this.parentDesktop !== undefined) {
				this.desktops = this.parentDesktop.Children;
				this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${this.parentDesktop.FullTitle}]` });
				await this.appFormsSvc.hideLoadingAsync();
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Desktop" && (this.parentDesktop.ID === info.args.ID || this.parentDesktop.ID === info.args.ParentID)) {
						this.desktops = this.parentDesktop.Children;
					}
				}, `Desktops:${this.parentDesktop.ID}:Refresh`);
			}
			else {
				this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${this.organization.Title}]` });
				this.startSearch(() => this.appFormsSvc.hideLoadingAsync());
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Desktop") {
						this.prepareResults();
					}
				}, "Desktops:Refresh");
			}
		}
	}

	track(index: number, desktop: Desktop) {
		return `${desktop.ID}@${index}`;
	}

	getInfo(desktop: Desktop) {
		return desktop.childrenIDs === undefined || desktop.childrenIDs.length < 1
			? `${this.labels.alias}: ${desktop.Alias}`
			: AppUtility.format(this.labels.children, { number: desktop.childrenIDs.length, children: `${desktop.Children[0].Title}${(desktop.childrenIDs.length > 1 ? `, ${desktop.Children[1].Title}` : "")}, ...` });
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
				this.desktops = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.search(() => this.appFormsSvc.hideLoadingAsync(() => this.infiniteScrollCtrl.disabled = false));
			}
			else {
				this.desktops = this.objects.filter(Desktop.getFilterBy(this.filterBy.Query));
			}
		}
		else if (this.searching) {
			this.onClear();
		}
	}

	onClear(isOnCanceled?: boolean) {
		if (this.searching || this.filtering) {
			this.filterBy.Query = undefined;
			this.desktops = this.filtering ? this.objects.map(object => object) : [];
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
		return this.portalsCoreSvc.getPaginationPrefix("desktop");
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
			this.trackAsync(this.title.track);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchDesktops(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
		else {
			this.portalsCoreSvc.searchDesktopsAsync(this.request, onSuccess, error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.title.track)));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			this.desktops.merge((results || []).map(object => Desktop.get(object.ID) || Desktop.deserialize(object, Desktop.get(object.ID))));
		}
		else {
			const predicate: (dekstop: Desktop) => boolean = obj => obj.SystemID === this.organization.ID && obj.ParentID === this.parentID;
			const objects = (results === undefined ? Desktop.instances.toArray(predicate) : Desktop.toArray(results).filter(predicate))
				.sortBy("Title", { name: "LastModified", reverse: true })
				.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
			this.desktops = results === undefined ? objects : this.desktops.concat(objects);
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	private doRefresh(desktops: Desktop[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title.track, "Refresh");
			if (index < desktops.length - 1) {
				AppUtility.invoke(() => this.doRefresh(desktops, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0) {
			this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug && desktops.length > 1 ? () => console.log(`--- Start to refresh ${desktops.length} desktops -----------------`) : () => {});
		}
		this.portalsCoreSvc.refreshDesktopAsync(desktops[index].ID, refreshNext, refreshNext, undefined, useXHR);
	}

	private doClearCache(desktops: Desktop[], index: number, useXHR: boolean = false, onClean?: () => void) {
		const clearNext: () => void = () => {
			this.trackAsync(this.title.track, "Cache");
			if (index < desktops.length - 1) {
				AppUtility.invoke(() => this.doClearCache(desktops, index + 1, useXHR, onClean));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onClean !== undefined ? () => onClean() : undefined));
			}
		};
		this.portalsCoreSvc.clearCacheAsync("desktop", desktops[index].ID, clearNext, index === 0, useXHR && index === 0);
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
				this.objects = this.desktops.map(obj => obj);
				this.infiniteScrollCtrl.disabled = true;
				AppUtility.invoke(async () => this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter")).then(() => PlatformUtility.focus(this.searchCtrl));
			}
			else {
				this.configSvc.navigateForwardAsync("/portals/core/desktops/search");
			}
		});
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync(`/portals/core/desktops/create${(this.parentID === undefined ? "" : "?x-request=" + AppCrypto.jsonEncode({ ParentID: this.parentID }))}`));
	}

	open(event: Event, desktop: Desktop) {
		this.do(() => {
			if (desktop.childrenIDs === undefined) {
				this.doRefresh([desktop], 0, false, () => this.configSvc.navigateForwardAsync(desktop.routerURI));
			}
			else {
				this.configSvc.navigateForwardAsync(desktop.routerURI);
			}
		}, event);
	}

	showChildren(event: Event, desktop: Desktop) {
		this.do(() => this.configSvc.navigateForwardAsync(desktop.listURI), event);
	}

	showPortlets(event: Event, desktop: Desktop) {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "list", desktop.ansiTitle, { SystemID: desktop.SystemID, DesktopID: desktop.ID }, "portlet", "core")), event);
	}

	refresh(event: Event, desktop: Desktop) {
		this.do(() => this.doRefresh([desktop], 0, true, () => this.appFormsSvc.showToastAsync("The desktop was freshen-up")), event);
	}

	refreshAll() {
		const desktops = Desktop.instances.toArray(desktop => desktop.SystemID === this.organization.ID);
		this.do(desktops.length > 0 ? () => this.doRefresh(desktops, 0, false, () => this.portalsCoreSvc.searchDesktopsAsync(
			AppPagination.buildRequest(this.filterBy, this.sortBy, { TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 0 }),
			() => this.prepareResults(() => this.appFormsSvc.showToastAsync("All the desktops were freshen-up")),
			undefined,
			true,
			{ "x-no-cache": "x" },
			true
		)) : () => {});
	}

	clearAllCache() {
		this.doClearCache(this.parentDesktop !== undefined ? [this.parentDesktop].merge(this.parentDesktop.getChildren(true)) : Desktop.instances.toArray(desktop => desktop.SystemID === this.organization.ID), 0, false, () => console.log("Cache of all the desktops were clean"));
	}

	clearCache(event: Event, desktop: Desktop) {
		this.do(desktop !== undefined ? () => this.doClearCache([desktop].merge(desktop.getChildren(true)), 0, true) : () => {}, event);
	}

	viewVersions(event: Event, desktop: Desktop) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(desktop.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "Desktop", id: desktop.ID })), event);
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("Desktop", this.organization.ID);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync("Desktop", this.organization.ID).then(() => this.trackAsync(this.actions[3].text, "Import"));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Desktop", action: action || "Browse" });
	}

}
