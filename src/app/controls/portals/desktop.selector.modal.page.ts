import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, Input, ViewChild } from "@angular/core";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { HashSet } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization } from "@app/models/portals.core.organization";
import { Desktop } from "@app/models/portals.core.desktop";

@Component({
	selector: "page-desktops-selector",
	templateUrl: "./desktop.selector.modal.page.html",
	styleUrls: ["./desktop.selector.modal.page.scss"]
})

export class DesktopsSelectorModalPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	/** Set to 'true' to allow select multiple desktops */
	@Input() private multiple: boolean;

	/** The identity of organization */
	@Input() private organizationID: string;

	/** The identity of parent desktop */
	@Input() private parentID: string;

	/** The excluded identities */
	@Input() private excludedIDs: Array<string>;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	get color() {
		return this.configSvc.color;
	}

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
	selected = new HashSet<string>();
	parentDesktop: Desktop;

	ngOnInit() {
		this.multiple = this.multiple === undefined ? true : AppUtility.isTrue(this.multiple);
		this.excludedIDs = AppUtility.isArray(this.excludedIDs, true) ? this.excludedIDs.filter(id => AppUtility.isNotEmpty(id)).map(id => id.trim()) : [];
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.organization = Organization.get(this.organizationID) || await this.portalsCoreSvc.getActiveOrganizationAsync();
		this.parentDesktop = Desktop.get(this.parentID);
		this.filterBy.And = [
			{ SystemID: { Equals: this.organization.ID } },
			{ ParentID: "IsNull" }
		];
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
		return AppUtility.isArray(desktop.childrenIDs, true) && desktop.childrenIDs.length > 0
			? AppUtility.format(this.children, { number: desktop.childrenIDs.length, children: `${desktop.Children[0].Title}, ...` })
			: "";
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
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchAsync(async () => await (this.infiniteScrollCtrl !== undefined ? this.infiniteScrollCtrl.complete() : AppUtility.promise));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("desktop");
	}

	private sort(desktops: Desktop[]) {
		return desktops.sortBy("Title", { name: "LastModified", reverse: true });
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		if (this.organization !== undefined && AppUtility.isNotEmpty(this.organization.ID)) {
			this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
			this.pagination.PageNumber = this.pageNumber = 0;
			await this.searchAsync(onNext);
		}
		else if (onNext !== undefined) {
			onNext();
		}
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				(data !== undefined ? data.Objects as Array<any> : []).filter(o => this.excludedIDs.indexOf(o.ID) < 0).forEach(o => this.results.push(Desktop.get(o.ID)));
			}
			else {
				const objects = this.sort((data !== undefined ? (data.Objects as Array<any>).map(o => Desktop.get(o.ID)) : Desktop.instances.toArray(o => o.SystemID === this.organization.ID && o.ParentID === this.parentID)).filter(o => this.excludedIDs.indexOf(o.ID) < 0));
				this.desktops = data !== undefined
					? this.desktops.concat(objects)
					: objects.take(this.pagination === undefined ? 0 : this.pageNumber * this.pagination.PageSize);
			}
			if (onNext !== undefined) {
				onNext();
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchDesktop(this.request, onSuccess);
		}
		else {
			await this.portalsCoreSvc.searchDesktopAsync(this.request, onSuccess);
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

	select(event: any, id: string) {
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
			: AppUtility.promise;
	}

	back(event: Event) {
		event.stopPropagation();
		this.parentDesktop = this.parentDesktop.Parent;
		this.desktops = this.sort((this.parentDesktop !== undefined ? this.parentDesktop.Children : Desktop.instances.toArray(o => o.SystemID === this.organization.ID && o.ParentID === undefined)).filter(o => this.excludedIDs.indexOf(o.ID) < 0));
	}

	show(event: Event, desktop: Desktop) {
		event.stopPropagation();
		this.parentDesktop = desktop;
		this.desktops = this.sort(this.parentDesktop.Children.filter(o => this.excludedIDs.indexOf(o.ID) < 0));
	}

}
