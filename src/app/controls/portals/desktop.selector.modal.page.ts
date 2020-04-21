import { Subscription } from "rxjs";
import { List } from "linqts";
import { Set } from "typescript-collections";
import { Component, OnInit, OnDestroy, Input, ViewChild } from "@angular/core";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@components/app.pagination";
import { AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { Desktop } from "@models/portals.core.desktop";

@Component({
	selector: "page-desktops-selector",
	templateUrl: "./desktop.selector.modal.page.html",
	styleUrls: ["./desktop.selector.modal.page.scss"]
})

export class DesktopsSelectorModalPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	/** Set to 'true' to allow select multiple desktops */
	@Input() multiple: boolean;

	/** The identity of organization */
	@Input() organizationID: string;

	/** The identity of parent desktop */
	@Input() parentID: string;

	/** The excluded identities */
	@Input() excludedIDs: Array<string>;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private organization: Organization;
	private children = "{{number}} children: {{children}}";

	desktops = new Array<Desktop>();
	results = new Array<Desktop>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { Title: "Ascending" };
	labels = {
		select: "Select",
		cancel: "Cancel",
		search: "Search"
	};
	selected = new Set<string>();
	parentDesktop: Desktop;

	ngOnInit() {
		this.multiple = this.multiple === undefined ? true : AppUtility.isTrue(this.multiple);
		this.organization = Organization.get(this.organizationID) || new Organization();
		this.excludedIDs = AppUtility.isArray(this.excludedIDs, true) ? this.excludedIDs.map(id => id.toString().trim()) : [];
		this.parentDesktop = Desktop.get(this.parentID);
		this.filterBy.And = [
			{ SystemID: { Equals: this.organization.ID } },
			{ ParentID: "IsNull" }
		];
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.children = await this.configSvc.getResourceAsync("portals.desktops.list.children");
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.desktops.list.searchbar");
		this.labels = {
			select: await this.configSvc.getResourceAsync("common.buttons.select"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			search: await this.configSvc.getResourceAsync("common.buttons.search")
		};
		await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
	}

	track(index: number, desktop: Desktop) {
		return `${desktop.ID}@${index}`;
	}

	getInfo(desktop: Desktop) {
		return desktop.childrenIDs === undefined || desktop.childrenIDs.length < 1
			? ""
			: AppUtility.format(this.children, { number: desktop.childrenIDs.length, children: `${desktop.Children[0].Title}, ...` });
	}

	openSearch() {
		this.filterBy.And = [{ SystemID: { Equals: this.organization.ID} }];
		this.results = [];
		this.searching = true;
		PlatformUtility.focus(this.searchCtrl);
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			this.results = [];
			this.selected.clear();
			this.startSearchAsync(() => this.infiniteScrollCtrl.disabled = false, AppPagination.getDefault());
		}
	}

	onClearSearch() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.results = [];
		this.selected.clear();
	}

	onCancelSearch() {
		this.onClearSearch();
		this.searching = false;
		this.filterBy.And = [
			{ SystemID: { Equals: this.organization.ID } },
			{ ParentID: "IsNull" }
		];
	}

	async onInfiniteScrollAsync() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchAsync(async () => await (this.infiniteScrollCtrl !== undefined ? this.infiniteScrollCtrl.complete() : new Promise<void>(() => {})));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		if (this.organization === undefined || this.organization.ID === "") {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `desktop@${this.portalsCoreSvc.name}`.toLowerCase()) || AppPagination.getDefault();
			this.pagination.PageNumber = this.pageNumber = 0;
			await this.searchAsync(onNext);
		}
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, `desktop@${this.portalsCoreSvc.name}`.toLowerCase());
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				(data !== undefined ? data.Objects as Array<any> : []).filter(d => this.excludedIDs.indexOf(d.ID) < 0).forEach(o => this.results.push(Desktop.get(o.ID)));
			}
			else {
				const objects = new List(data !== undefined ? (data.Objects as Array<any>).map(d => Desktop.get(d.ID)) : Desktop.all.filter(d => d.SystemID === this.organization.ID && d.ParentID === this.parentID))
					.Where(d => this.excludedIDs.indexOf(d.ID) < 0)
					.OrderBy(d => d.Title).ThenByDescending(d => d.LastModified);
				this.desktops = data !== undefined
					? this.desktops.concat(objects.ToArray())
					: objects.Take(this.pageNumber * this.pagination.PageSize).ToArray();
			}
			if (onNext !== undefined) {
				onNext();
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchDesktop(this.request, onNextAsync);
		}
		else {
			await this.portalsCoreSvc.searchDesktopAsync(this.request, onNextAsync);
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

	select(id: string, event: any) {
		if (event.detail.checked) {
			if (!this.multiple) {
				this.selected.clear();
			}
			this.selected.add(id);
		}
		else {
			this.selected.remove(id);
		}
	}

	closeAsync(ids?: Array<string>) {
		return ids === undefined || ids.length > 0
			? this.appFormsSvc.hideModalAsync(ids)
			: new Promise<void>(() => {});
	}

	back() {
		this.parentDesktop = this.parentDesktop.Parent;
		this.desktops = this.parentDesktop !== undefined
			? this.parentDesktop.Children.filter(d => this.excludedIDs.indexOf(d.ID) < 0)
			: Desktop.all.filter(d => d.SystemID === this.organization.ID && d.ParentID === undefined).sort(AppUtility.getCompareFunction("Title"));
	}

	async showChildrenAsync(event: Event, desktop: Desktop) {
		event.stopPropagation();
		this.parentDesktop = desktop;
		this.desktops = this.parentDesktop.Children.filter(d => this.excludedIDs.indexOf(d.ID) < 0);
	}

}
