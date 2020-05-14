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
import { PortalsCmsService } from "@services/portals.cms.service";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";

@Component({
	selector: "page-data-lookup",
	templateUrl: "./data.lookup.modal.page.html",
	styleUrls: ["./data.lookup.modal.page.scss"]
})

export class DataLookupModalPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	/** The identity of organization */
	@Input() private organizationID: string;

	/** The identity of module */
	@Input() private moduleID: string;

	/** The identity of content-type */
	@Input() private contentTypeID: string;

	/** The object name */
	@Input() private objectName: string;

	/** Set to 'true' to act like nestest items */
	@Input() private nested: boolean;

	/** Set to 'true' to allow select multiple items */
	@Input() private multiple: boolean;

	/** The excluded identities */
	@Input() private excludedIDs: Array<string>;

	/** The sorting expression */
	@Input() private sortBy: { [key: string]: string };

	/** The function to pre-process items */
	@Input() private preProcess: (items: Array<any>) => void;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private children = "{{number}} children: {{children}}";
	private rootItems = new Array<DataItem>();

	parent: DataItem;
	items = new Array<DataItem>();
	results = new Array<DataItem>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: undefined as Array<{ [key: string]: any }>
	};
	labels = {
		select: "Select",
		cancel: "Cancel",
		search: "Search"
	};
	selected = new Set<string>();

	ngOnInit() {
		this.nested = this.nested === undefined ? false : AppUtility.isTrue(this.nested);
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
		this.module = Module.get(this.moduleID);
		this.contentType = ContentType.get(this.contentTypeID);
		this.prepareFilterBy(true);
		this.children = await this.configSvc.getResourceAsync("portals.common.lookup.children");
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.common.lookup.searchbar");
		this.labels = {
			select: await this.configSvc.getResourceAsync("common.buttons.select"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			search: await this.configSvc.getResourceAsync("common.buttons.search")
		};
		await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
	}

	track(index: number, item: DataItem) {
		return `${item.ID}@${index}`;
	}

	getInfo(item: DataItem) {
		return item.Children === undefined || item.Children.length < 1
			? ""
			: AppUtility.format(this.children, { number: item.Children.length, children: `${item.Children[0].Title}, ...` });
	}

	openSearch() {
		this.prepareFilterBy(false);
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
		this.prepareFilterBy(true);
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

	private prepareFilterBy(allowParent: boolean) {
		this.filterBy.And = [
			{ SystemID: { Equals: this.organization.ID } },
			{ RepositoryID: { Equals: this.module.ID } },
			{ RepositoryEntityID: { Equals: this.contentType.ID } }
		];
		if (this.nested && allowParent) {
			this.filterBy.And.push({ ParentID: "IsNull" });
		}
	}

	private prepareSortBy() {
		return this.nested
			? { OrderIndex: "Ascending", Title: "Ascending" }
			: this.sortBy || { LastModified: "Descending" };
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.prepareSortBy() }) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.prepareSortBy(), this.pagination);
		const onNextAsync = async (data: any) => {
			if (this.preProcess !== undefined) {
				this.preProcess(data.Objects);
			}
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request);
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				(data.Objects as Array<DataItem>).filter(o => this.excludedIDs.indexOf(o.ID) < 0).forEach(o => this.results.push(o));
			}
			else {
				let objects = (data.Objects as Array<DataItem>).filter(o => this.excludedIDs.indexOf(o.ID) < 0);
				if (this.nested) {
					objects = objects.sort(AppUtility.getCompareFunction("OrderIndex", "Title"));
				}
				else {
					const sortBy = this.prepareSortBy();
					const sorts = Object.keys(sortBy).map(key => {
						return { name: key, reverse: "Descending" === sortBy[key] };
					});
					objects.sort(AppUtility.getSortFunction(sorts));
				}
				this.items = data !== undefined
					? this.items.concat(objects)
					: new List(objects).Take(this.pageNumber * this.pagination.PageSize).ToArray();
				if (this.nested) {
					this.items.forEach(item => this.updateParent(item));
					this.rootItems = this.items.map(item => item);
				}
			}
			if (onNext !== undefined) {
				onNext();
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.lookup(this.objectName, this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error), this.nested ? { "x-children": "true" } : undefined);
		}
		else {
			await this.portalsCmsSvc.lookupAsync(this.objectName, this.request, onNextAsync, async error => await this.appFormsSvc.showErrorAsync(error), this.nested ? { "x-children": "true" } : undefined);
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

	private updateParent(item: DataItem) {
		if (item.Children !== undefined && item.Children.length > 0) {
			item.Children.forEach(child => {
				child.Parent = item;
				this.updateParent(child);
			});
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
			: new Promise<void>(() => {});
	}

	back(event: Event) {
		event.stopPropagation();
		this.parent = this.parent.Parent;
		this.items = (this.parent !== undefined ? this.parent.Children : this.rootItems).filter(o => this.excludedIDs.indexOf(o.ID) < 0);
	}

	show(event: Event, item: DataItem) {
		event.stopPropagation();
		this.parent = item;
		this.items = this.parent.Children.filter(o => this.excludedIDs.indexOf(o.ID) < 0);
	}
}

interface DataItem {
	ID: string;
	Title: string;
	ParentID?: string;
	OrderIndex?: number;
	Parent?: DataItem;
	Children?: DataItem[];
	LastModified: Date;
}
