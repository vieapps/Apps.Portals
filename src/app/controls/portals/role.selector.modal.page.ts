import { Subscription } from "rxjs";
import { List } from "linqts";
import { Set } from "typescript-collections";
import { Component, OnInit, OnDestroy, Input, ViewChild } from "@angular/core";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppUtility } from "../../components/app.utility";
import { PlatformUtility } from "../../components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "../../components/app.pagination";
import { AppFormsService } from "../../components/forms.service";
import { ConfigurationService } from "../../services/configuration.service";
import { PortalsCoreService } from "../../services/portals.core.service";
import { Organization } from "../../models/portals.core.organization";
import { Role } from "../../models/portals.core.role";

@Component({
	selector: "page-roles-selector",
	templateUrl: "./role.selector.modal.page.html",
	styleUrls: ["./role.selector.modal.page.scss"]
})

export class RolesSelectorModalPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	/** Set to 'true' to allow select multiple roles */
	@Input() multiple: boolean;

	/** Set to 'true' to allow system roles (Authorized and All) */
	@Input() allowSystemRoles: boolean;

	/** The working section */
	@Input() section: string;

	/** The identity of organization */
	@Input() organizationID: string;

	/** The identity of parent role */
	@Input() parentID: string;

	/** The excluded identities */
	@Input() excludedIDs: Array<string>;

	roles = new Array<Role>();
	results = new Array<Role>();
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

	private subscription: Subscription;
	private organization: Organization;
	private roleOfAll = new Role();
	private roleOfAuthorized = new Role();

	ngOnInit() {
		this.multiple = this.multiple === undefined ? true : AppUtility.isTrue(this.multiple);
		this.allowSystemRoles = this.allowSystemRoles === undefined ? true : AppUtility.isTrue(this.allowSystemRoles);
		this.section = AppUtility.isNotEmpty(this.section) ? this.section : "Viewable";
		this.organization = Organization.get(this.organizationID) || new Organization();
		this.resetFilter();
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.roles.list.searchbar");
		this.labels = {
			select: await this.configSvc.getResourceAsync("common.buttons.select"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			search: await this.configSvc.getResourceAsync("common.buttons.search")
		};
		this.roleOfAll.ID = "All";
		this.roleOfAll.Title = await this.appFormsSvc.getResourceAsync("privileges.roles.systems.All");
		this.roleOfAuthorized.ID = "Authorized";
		this.roleOfAuthorized.Title = await this.appFormsSvc.getResourceAsync("privileges.roles.systems.Authorized");
		await this.startSearchAsync(async () => {
			if (this.allowSystemRoles) {
				if (this.section === "Contributive" || this.section === "Viewable" || this.section === "Downloadable") {
					AppUtility.insertAt(this.roles, this.roleOfAll, 0);
					AppUtility.insertAt(this.roles, this.roleOfAuthorized, 1);
				}
				else if (this.section === "Editable") {
					AppUtility.insertAt(this.roles, this.roleOfAuthorized, 0);
				}
			}
			await this.appFormsSvc.hideLoadingAsync();
		});
	}

	private resetFilter() {
		this.filterBy.And = [
			{
				SystemID: { Equals: this.organization.ID}
			},
			{
				ParentID: AppUtility.isNotEmpty(this.parentID) ? { Equals: this.parentID.trim() } : "IsNull"
			}
		];
	}

	track(index: number, role: Role) {
		return `${role.ID}@${index}`;
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
		this.resetFilter();
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

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		if (this.organization === undefined || this.organization.ID === "") {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `role@${this.portalsCoreSvc.name}`.toLowerCase()) || AppPagination.getDefault();
			this.pagination.PageNumber = this.pageNumber = 0;
			await this.searchAsync(onNext);
		}
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, `role@${this.portalsCoreSvc.name}`.toLowerCase());
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				(data !== undefined ? data.Objects as Array<any> : []).forEach(o => this.results.push(Role.get(o.ID)));
			}
			else {
				const objects = new List(data === undefined ? Role.filter(this.parentID, this.organization.ID) : (data.Objects as Array<any>).map(o => Role.get(o.ID))).OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
				this.roles = data === undefined
					? objects.Take(this.pageNumber * this.pagination.PageSize).ToArray()
					: this.roles.concat(objects.ToArray());
			}
			if (onNext !== undefined) {
				onNext();
			}
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchRole(this.request, onNextAsync);
		}
		else {
			await this.portalsCoreSvc.searchRoleAsync(this.request, onNextAsync);
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

}
