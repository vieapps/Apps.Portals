import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, Input, ViewChild } from "@angular/core";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppUtility, HashSet } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization } from "@app/models/portals.core.organization";
import { Role } from "@app/models/portals.core.role";

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

	/** Set to 'true' to allow select multiple roles */
	@Input() private multiple: boolean;

	/** Set to 'true' to allow system roles (Authorized and All) */
	@Input() private allowSystemRoles: boolean;

	/** Set to 'true' to allow visitor role to show in 'Contributive' section */
	@Input() private allowVisitorInContributiveSection: boolean;

	/** The working section */
	@Input() private section: string;

	/** The identity of organization */
	@Input() private organizationID: string;

	/** The identity of parent role */
	@Input() private parentID: string;

	/** The excluded identities */
	@Input() private excludedIDs: Array<string>;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private organization: Organization;
	private children = "{{number}} children: {{children}}";
	private roleOfAll = new Role();
	private roleOfAuthorized = new Role();

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
	selected = new HashSet<string>();
	parentRole: Role;

	ngOnInit() {
		this.multiple = this.multiple === undefined ? true : AppUtility.isTrue(this.multiple);
		this.allowSystemRoles = this.allowSystemRoles === undefined ? true : AppUtility.isTrue(this.allowSystemRoles);
		this.allowVisitorInContributiveSection = this.allowVisitorInContributiveSection === undefined ? false : AppUtility.isTrue(this.allowVisitorInContributiveSection);
		this.section = AppUtility.isNotEmpty(this.section) ? this.section : "Viewable";
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
		this.parentRole = Role.get(this.parentID);
		this.filterBy.And = [
			{ SystemID: { Equals: this.organization.ID } },
			{ ParentID: "IsNull" }
		];
		this.children = await this.configSvc.getResourceAsync("portals.roles.list.children");
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.roles.list.searchbar");
		this.labels = {
			select: await this.configSvc.getResourceAsync("common.buttons.select"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel"),
			search: await this.configSvc.getResourceAsync("common.buttons.search")
		};

		if (this.allowSystemRoles) {
			this.roleOfAll.ID = "All";
			this.roleOfAll.Title = await this.appFormsSvc.getResourceAsync("privileges.roles.systems.All");
			this.roleOfAuthorized.ID = "Authorized";
			this.roleOfAuthorized.Title = await this.appFormsSvc.getResourceAsync("privileges.roles.systems.Authorized");
		}

		await this.startSearchAsync(async () => {
			if (this.allowSystemRoles) {
				if (this.section === "Contributive" || this.section === "Viewable" || this.section === "Downloadable") {
					AppUtility.insertAt(this.roles, this.roleOfAll, 0);
					AppUtility.insertAt(this.roles, this.roleOfAuthorized, 1);
					if (this.section === "Contributive" && !this.allowVisitorInContributiveSection) {
						AppUtility.removeAt(this.roles, 0);
					}
				}
				else if (this.section === "Editable") {
					AppUtility.insertAt(this.roles, this.roleOfAuthorized, 0);
				}
			}
			await this.appFormsSvc.hideLoadingAsync();
		});
	}

	track(index: number, role: Role) {
		return `${role.ID}@${index}`;
	}

	getInfo(role: Role) {
		return role.childrenIDs === undefined || role.childrenIDs.length < 1
			? ""
			: AppUtility.format(this.children, { number: role.childrenIDs.length, children: `${role.Children[0].Title}, ...` });
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

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("role");
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
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			if (this.searching) {
				(data !== undefined ? data.Objects as Array<any> : []).filter(o => this.excludedIDs.indexOf(o.ID) < 0).forEach(o => this.results.push(Role.get(o.ID)));
			}
			else {
				const objects = new List(data !== undefined ? (data.Objects as Array<any>).map(o => Role.get(o.ID)) : Role.instances.toArray(o => o.SystemID === this.organization.ID && o.ParentID === this.parentID))
					.Where(o => this.excludedIDs.indexOf(o.ID) < 0)
					.OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
				this.roles = data !== undefined
					? this.roles.concat(objects.ToArray())
					: objects.Take(this.pageNumber * this.pagination.PageSize).ToArray();
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
		this.parentRole = this.parentRole.Parent;
		this.roles = (this.parentRole !== undefined ? this.parentRole.Children : Role.instances.toArray(o => o.SystemID === this.organization.ID && o.ParentID === undefined)).filter(o => this.excludedIDs.indexOf(o.ID) < 0).sort(AppUtility.getCompareFunction("Title"));
	}

	show(event: Event, role: Role) {
		event.stopPropagation();
		this.parentRole = role;
		this.roles = this.parentRole.Children.filter(o => this.excludedIDs.indexOf(o.ID) < 0);
	}

}
