import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, Input, ViewChild } from "@angular/core";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";

@Component({
	selector: "page-data-lookup",
	templateUrl: "./data.lookup.modal.page.html",
	styleUrls: ["./data.lookup.modal.page.scss"]
})

export class DataLookupModalPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
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

	/** The additional filtering expression */
	@Input() private filters: Array<{ [key: string]: any }> | { [key: string]: any };

	/** The function to pre-process items */
	@Input() private preProcess: (items: Array<any>) => void;

	/** The labels for processing items */
	@Input() labels: { [key: string]: string };

	/** The pre-defined items */
	@Input() predefinedItems: Array<DataItem>;
	@Input() private preselectedID: string | Array<string>;

	/** Set to 'true' to allow select multiple items */
	@Input() private allowEmpty: boolean;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	get color() {
		return this.configSvc.color;
	}

	get isLookupOrganization() {
		return "Organization" === this.objectName;
	}

	private subscription: Subscription;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private children = "{{number}} children: {{children}}";
	private rootItems = new Array<DataItem>();

	private pageNumber = 0;
	private pagination: AppDataPagination;
	private request: AppDataRequest;
	private filterBy = {
		Query: undefined as string,
		And: undefined as Array<{ [key: string]: any }>
	};

	parent: DataItem;
	items = new Array<DataItem>();
	results = new Array<DataItem>();
	searching = false;
	selected = new Dictionary<string, DataItem>();

	ngOnInit() {
		if (this.objectName !== undefined) {
			AppUtility.invoke(async () => await TrackingUtility.trackAsync({ title: `Lookup - ${this.objectName}`, category: this.objectName.split(".").last(), action: "Lookup" }));
		}
		this.nested = this.nested === undefined ? false : AppUtility.isTrue(this.nested);
		this.multiple = this.multiple === undefined ? true : AppUtility.isTrue(this.multiple);
		this.excludedIDs = AppUtility.isArray(this.excludedIDs, true) ? this.excludedIDs.filter(id => AppUtility.isNotEmpty(id)).map(id => id.trim()) : [];
		this.labels = this.labels || {};
		this.allowEmpty = this.multiple === undefined ? false : AppUtility.isTrue(this.allowEmpty);
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.organization = this.isLookupOrganization ? undefined : Organization.get(this.organizationID) || await this.portalsCoreSvc.getActiveOrganizationAsync();
		this.module = this.isLookupOrganization ? undefined : Module.get(this.moduleID) || await this.portalsCoreSvc.getActiveModuleAsync();
		this.contentType = this.isLookupOrganization ? undefined : ContentType.get(this.contentTypeID);
		this.prepareFilterBy(true);
		this.children = await this.configSvc.getResourceAsync("portals.common.lookup.children");
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.common.lookup.searchbar");
		this.labels.select = this.labels.select || await this.configSvc.getResourceAsync("common.buttons.select");
		this.labels.cancel = this.labels.cancel || await this.configSvc.getResourceAsync("common.buttons.cancel");
		this.labels.search = this.labels.search || await this.configSvc.getResourceAsync("common.buttons.search");
		if (AppUtility.isArray(this.predefinedItems, true)) {
			if (this.preselectedID !== undefined) {
				const preselectedIDs = AppUtility.isArray(this.preselectedID, true) ? this.preselectedID as Array<string> : [this.preselectedID as string];
				preselectedIDs.forEach(preselectedID => {
					const selected = this.predefinedItems.firstOrDefault(o => o.ID === preselectedID);
					if (selected !== undefined) {
						this.selected.set(selected.ID, selected);
					}
				});
			}
			this.items = this.prepareItems(this.predefinedItems);
			if (this.nested) {
				this.items.forEach(item => this.updateParent(item));
				this.rootItems = this.items.map(item => item);
			}
			this.infiniteScrollCtrl.disabled = true;
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			if (this.configSvc.isDebug) {
				console.log(`[DataLookup]: lookup portal data (${this.objectName})`, `\n- Organization: ${this.organizationID}`, this.organization, `\n- Module: ${this.moduleID}`, this.module, `\n- Content Type: ${this.contentTypeID}`, this.contentType, "\n- Multiple & Nested:", this.multiple, this.nested, "\n- Filter:", this.filterBy);
			}
			await this.startSearchAsync(() => this.appFormsSvc.hideLoadingAsync());
		}
	}

	track(index: number, item: DataItem) {
		return `${item.ID}@${index}`;
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
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchAsync(async () => await (this.infiniteScrollCtrl !== undefined ? this.infiniteScrollCtrl.complete() : AppUtility.promise));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private prepareFilterBy(allowParent: boolean) {
		this.filterBy.And = [];
		if (this.organization !== undefined) {
			this.filterBy.And.push({ SystemID: { Equals: this.organization.ID } });
		}
		if (this.module !== undefined) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.module.ID } });
		}
		if (this.contentType !== undefined) {
			this.filterBy.And.push({ RepositoryEntityID: { Equals: this.contentType.ID } });
		}
		if (this.nested && allowParent) {
			this.filterBy.And.push({ ParentID: "IsNull" });
		}
		if (this.filters !== undefined) {
			if (AppUtility.isArray(this.filters)) {
				(this.filters as Array<{ [key: string]: any }>).forEach(filter => this.filterBy.And.push(filter));
			}
			else {
				this.filterBy.And.push(this.filters);
			}
		}
	}

	private prepareSortBy() {
		return this.nested
			? { OrderIndex: "Ascending", Title: "Ascending" }
			: this.sortBy || { LastModified: "Descending" };
	}

	private prepareItems(items: DataItem[], doSort: boolean = true) {
		items.forEach(item => item.Info = AppUtility.isArray(item.Children, true) && item.Children.length > 0 ? AppUtility.format(this.children, { number: item.Children.length, children: `${item.Children[0].Title}, ...` }) : item.Info);
		const orderBy = this.prepareSortBy();
		return doSort
			? items.orderBy(Object.keys(orderBy).map(key => ({ name: key, reverse: AppUtility.isEquals("Descending", orderBy[key]) })))
			: items;
	}

	private startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.prepareSortBy() }) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		return this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.prepareSortBy(), this.pagination);
		const onSuccess = async (data: any) => {
			if (this.preProcess !== undefined) {
				this.preProcess(data.Objects);
			}
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request);
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				this.results = this.results.concat(this.prepareItems((data.Objects as Array<DataItem>).filter(o => this.excludedIDs.indexOf(o.ID) < 0), false));
			}
			else {
				const objects = this.prepareItems(data.Objects as Array<DataItem>).filter(o => this.excludedIDs.indexOf(o.ID) < 0);
				this.items = data !== undefined
					? this.items.concat(objects)
					: objects.take(this.pagination === undefined ? 0 : this.pageNumber * this.pagination.PageSize);
				if (this.nested) {
					this.items.forEach(item => this.updateParent(item));
					this.rootItems = this.items.map(item => item);
				}
			}
			if (this.preselectedID !== undefined) {
				const preselectedID = AppUtility.isArray(this.preselectedID, true) ? (this.preselectedID as Array<string>).first() : this.preselectedID as string;
				const selected = (this.searching ? this.results : this.items).first(o => o.ID === preselectedID);
				if (selected !== undefined) {
					this.selected.set(selected.ID, selected);
				}
			}
			if (onNext !== undefined) {
				onNext();
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCmsSvc.lookup(this.objectName, this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error), { "x-children": `${this.nested}`, "x-lookup" : "true" });
		}
		else {
			await this.portalsCmsSvc.lookupAsync(this.objectName, this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error), { "x-children": `${this.nested}`, "x-lookup" : "true" });
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
		if (AppUtility.isArray(item.Children, true) && item.Children.length > 0) {
			item.Children.forEach(child => {
				child.Parent = item;
				this.updateParent(child);
			});
		}
	}

	select(event: any, item: DataItem) {
		if (event.detail.checked) {
			if (!this.multiple) {
				this.selected.clear();
			}
			this.selected.set(item.ID, item);
		}
		else {
			this.selected.remove(item.ID);
		}
	}

	closeAsync(items?: Array<DataItem>) {
		return items === undefined
			? this.appFormsSvc.hideModalAsync()
			: items.length > 0 || (items.length < 1 && this.allowEmpty)
				? this.appFormsSvc.hideModalAsync(items)
				: AppUtility.promise;
	}

	back(event: Event) {
		event.stopPropagation();
		this.parent = this.parent.Parent;
		this.items = this.prepareItems((this.parent !== undefined ? this.parent.Children : this.rootItems).filter(o => this.excludedIDs.indexOf(o.ID) < 0));
	}

	show(event: Event, item: DataItem) {
		event.stopPropagation();
		this.parent = item;
		this.items = this.prepareItems(this.parent.Children.filter(o => this.excludedIDs.indexOf(o.ID) < 0));
	}

}

interface DataItem {
	ID: string;
	Title: string;
	Info?: string;
	ParentID?: string;
	OrderIndex?: number;
	Parent?: DataItem;
	Children?: DataItem[];
}
