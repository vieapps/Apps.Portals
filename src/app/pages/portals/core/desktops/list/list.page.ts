import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
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

	title = "Desktops";
	desktops = new Array<Desktop>();
	parentDesktop: Desktop;
	searching = false;
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
		children: "{{number}} children: {{children}}",
		alias: "Alias",
		edit: "Update this desktop",
		refresh: "Refresh",
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
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		this.searching = this.configSvc.currentURL.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.desktops.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: "" });

		this.labels = {
			children: await this.configSvc.getResourceAsync("portals.desktops.list.children"),
			alias: await this.configSvc.getResourceAsync("portals.desktops.controls.Alias.label"),
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			view: await this.configSvc.getResourceAsync("portals.desktops.list.view"),
			portlets: await this.configSvc.getResourceAsync("portals.portlets.title.list", { info: "" }),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title")
		};

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.desktops.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.desktops.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.desktops.title.search"), "search", () => this.openSearchAsync(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentDesktop = Desktop.get(this.parentID);

			if (this.parentDesktop !== undefined) {
				this.desktops = this.parentDesktop.Children;
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.parentDesktop.FullTitle}]` });
				await this.appFormsSvc.hideLoadingAsync();
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Desktop" && (this.parentDesktop.ID === info.args.ID || this.parentDesktop.ID === info.args.ParentID)) {
						this.desktops = this.parentDesktop.Children;
					}
				}, `Desktops:${this.parentDesktop.ID}:Refresh`);
			}
			else {
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.organization.Title}]` });
				this.filterBy.And = [
					{ SystemID: { Equals: this.organization.ID } },
					{ ParentID: "IsNull" }
				];
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
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

	async onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.messages.searching"));
				this.desktops = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				await this.searchAsync(async () => {
					this.infiniteScrollCtrl.disabled = false;
					await this.appFormsSvc.hideLoadingAsync();
				});
			}
			else {
				this.desktops = this.objects.filter(Desktop.getFilterBy(this.filterBy.Query));
			}
		}
		else if (this.searching) {
			this.onClear();
		}
	}

	onClear() {
		this.filterBy.Query = undefined;
		this.desktops = this.filtering ? this.objects.map(obj => obj) : [];
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
		return this.portalsCoreSvc.getPaginationPrefix("desktop");
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
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentURL);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchDesktop(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCoreSvc.searchDesktopAsync(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.desktops.push(Desktop.get(o.ID) || Desktop.deserialize(o, Desktop.get(o.ID))));
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
			this.objects = this.desktops.map(obj => obj);
		}
		else {
			await this.configSvc.navigateForwardAsync("/portals/core/desktops/search");
		}
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(`/portals/core/desktops/create${(this.parentID === undefined ? "" : "?x-request=" + AppCrypto.jsonEncode({ ParentID: this.parentID }))}`);
	}

	async openAsync(event: Event, desktop: Desktop) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(desktop.routerURI);
	}

	async showChildrenAsync(event: Event, desktop: Desktop) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(desktop.listURI);
	}

	async showPortletsAsync(event: Event, desktop: Desktop) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "list", desktop.ansiTitle, { SystemID: desktop.SystemID, DesktopID: desktop.ID }, "portlet", "core"));
	}

	async refreshAsync(event: Event, desktop: Desktop) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.refreshDesktopAsync(desktop.ID, async _ => await this.appFormsSvc.showToastAsync("The desktop was freshen-up"));
	}

	async clearCacheAsync(event: Event, desktop: Desktop) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.clearCacheAsync("desktop", desktop.ID);
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("Desktop", this.organization.ID);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync("Desktop", this.organization.ID);
	}

}
