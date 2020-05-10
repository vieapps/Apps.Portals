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
	@Input() organizationID: string;

	/** The identity of module */
	@Input() moduleID: string;

	/** The identity of content-type */
	@Input() contentTypeID: string;

	/** The object name */
	@Input() objectName: string;

	/** Set to 'true' to act like nestest items */
	@Input() nested: boolean;

	/** The identity of parent item */
	@Input() parentID: string;

	/** Set to 'true' to allow select multiple items */
	@Input() multiple: boolean;

	/** The excluded identities */
	@Input() excludedIDs: Array<string>;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private children = "{{number}} children: {{children}}";

	items = new Array<DataItem>();
	rootItems = new Array<DataItem>();
	results = new Array<DataItem>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = undefined as { [key: string]: string };
	labels = {
		select: "Select",
		cancel: "Cancel",
		search: "Search"
	};
	selected = new Set<string>();
	parent: DataItem;

	ngOnInit() {
		this.nested = this.nested === undefined ? true : AppUtility.isTrue(this.nested);
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
		if (AppUtility.isNotEmpty(this.parentID)) {
			this.parent = await this.getParentAsync(this.parentID);
		}
		this.prepareFilter(true);
		this.sortBy = this.nested
			? { OrderIndex: "Ascending", Title: "Ascending" }
			: { Title: "Ascending" };
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
		this.prepareFilter(false);
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
		this.prepareFilter(true);
		this.results = [];
		this.selected.clear();
	}

	onCancelSearch() {
		this.onClearSearch();
		this.searching = false;
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

	private async getParentAsync(id: string) {
		let parent: DataItem;
		await this.portalsCmsSvc.getAsync(this.objectName, id, data => {
			if (this.nested) {
				parent = {
					ID: data.ID,
					Title: data.Title,
					ParentID: data.ParentID,
					OrderIndex: data.OrderIndex,
					Children: data.Children,
					Created: new Date(data.Created),
					CreatedID: data.CreatedID,
					LastModified: new Date(data.LastModified),
					LastModifiedID: data.LastModifiedID
				};
			}
			else {
				parent = {
					ID: data.ID,
					Title: data.Title,
					Created: new Date(data.Created),
					CreatedID: data.CreatedID,
					LastModified: new Date(data.LastModified),
					LastModifiedID: data.LastModifiedID
				};
			}
		}, this.nested ? { "x-children": "true" } : undefined);
		if (this.nested && AppUtility.isNotEmpty(parent.ParentID)) {
			parent.Parent = await this.getParentAsync(parent.ParentID);
		}
		return parent;
	}

	private prepareFilter(allowParent: boolean) {
		this.filterBy.And = [
			{ SystemID: { Equals: this.organization.ID } },
			{ RepositoryID: { Equals: this.module.ID } },
			{ RepositoryEntityID: { Equals: this.contentType.ID } }
		];
		if (this.nested && allowParent) {
			this.filterBy.And.push({ ParentID: "IsNull" });
		}
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request);
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				(data.Objects as Array<DataItem>).filter(o => this.excludedIDs.indexOf(o.ID) < 0).forEach(o => this.results.push(o));
			}
			else {
				let objects = new List(data.Objects as Array<DataItem>).Where(o => this.excludedIDs.indexOf(o.ID) < 0);
				objects = this.nested
					? objects.OrderBy(o => o.OrderIndex).ThenByDescending(o => o.Title)
					: objects.OrderBy(o => o.LastModified);
				this.items = data !== undefined
					? this.items.concat(objects.ToArray())
					: objects.Take(this.pageNumber * this.pagination.PageSize).ToArray();
				this.rootItems = this.items.map(item => item);
			}
			if (onNext !== undefined) {
				onNext();
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.lookup(this.objectName, this.request, onNextAsync);
		}
		else {
			await this.portalsCmsSvc.lookupAsync(this.objectName, this.request, onNextAsync, this.nested ? { "x-children": "true" } : undefined);
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
			: new Promise<void>(() => {});
	}

	back(event: Event) {
		event.stopPropagation();
		this.parent = this.parent.Parent;
		this.items = (this.parent !== undefined ? this.parent.Children : this.rootItems).filter(d => this.excludedIDs.indexOf(d.ID) < 0);
	}

	show(event: Event, item: DataItem) {
		event.stopPropagation();
		this.parent = item;
		this.items = this.parent.Children.filter(d => this.excludedIDs.indexOf(d.ID) < 0);
	}
}

interface DataItem {
	ID: string;
	Title: string;
	ParentID?: string;
	OrderIndex?: number;
	Parent?: DataItem;
	Children?: DataItem[];
	Created: Date;
	CreatedID: string;
	LastModified: Date;
	LastModifiedID: string;
}
