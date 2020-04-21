import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { PlatformUtility } from "@components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@components/app.pagination";
import { AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { Role } from "@models/portals.core.role";

@Component({
	selector: "page-portals-core-roles-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class RolesListPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private organization: Organization;
	private parentID: string;
	private parentRole: Role;
	private subscription: Subscription;
	private children = "{{number}} children: {{children}}";

	title = "Roles";
	roles = new Array<Role>();
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

	get locale() {
		return this.configSvc.locale;
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
		if (this.parentID === undefined) {
			AppEvents.off("Portals", "Roles:RefreshList");
		}
		else {
			AppEvents.off("Portals", `Roles:RefreshChildren:${this.parentID}`);
		}
	}

	private async initializeAsync() {
		this.organization = Organization.get(this.configSvc.requestParams["SystemID"]) || this.portalsCoreSvc.activeOrganization || new Organization();
		if (this.organization === undefined || this.organization.ID === "") {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				undefined,
				await this.configSvc.getResourceAsync("portals.roles.list.invalid"),
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateHomeAsync();
			return;
		}

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.roles.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { title: "" });
		this.children = await this.configSvc.getResourceAsync("portals.roles.list.children");

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.roles.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.create"), "create", () => this.openCreateAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.search"), "search", () => this.openSearchAsync())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentRole = Role.get(this.parentID);

			if (this.parentRole !== undefined) {
				this.roles = this.parentRole.Children;
				this.configSvc.appTitle = this.title = AppUtility.format(title, { title: `[${this.parentRole.FullTitle}]` });
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Role" && (this.parentRole.ID === info.args.ID || this.parentRole.ID === info.args.ParentID)) {
						this.roles = this.parentRole.Children;
					}
				}, `Roles:RefreshChildren:${this.parentID}`);
			}
			else {
				this.filterBy.And = [
					{ SystemID: { Equals: this.organization.ID } },
					{ ParentID: "IsNull" }
				];
				this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `role@${this.portalsCoreSvc.name}`) || AppPagination.getDefault();
				this.pagination.PageNumber = this.pageNumber;
				await this.searchAsync();
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Role" && !info.args.ParentID) {
						this.roles = Role.all.filter(role => role.SystemID === this.organization.ID && role.ParentID === undefined).sort(AppUtility.getCompareFunction("Title"));
					}
				}, "Roles:RefreshList");
			}
		}
	}

	track(index: number, role: Role) {
		return `${role.ID}@${index}`;
	}

	getInfo(role: Role) {
		return role.childrenIDs === undefined || role.childrenIDs.length < 1
			? role.Description
			: AppUtility.format(this.children, { number: role.childrenIDs.length, children: `${role.Children[0].Title}${(role.childrenIDs.length > 1 ? `, ${role.Children[1].Title}` : "")}, ...` });
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	openCreateAsync() {
		return this.configSvc.navigateForwardAsync(`/portals/core/roles/create${(this.parentID === undefined ? "" : "?x-request=" + AppUtility.toBase64Url({ ParentID: this.parentID }))}`);
	}

	openSearchAsync() {
		return this.configSvc.navigateForwardAsync("/portals/core/roles/search");
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.roles = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.searchAsync(() => this.infiniteScrollCtrl.disabled = false);
			}
			else {
				this.prepareResults();
			}
		}
	}

	onClearSearch() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.roles = [];
	}

	onCancelSearch() {
		this.onClearSearch();
		this.startSearchAsync();
	}

	async onInfiniteScrollAsync() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
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

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `role@${this.portalsCoreSvc.name}`.toLowerCase()) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, `role@${this.portalsCoreSvc.name}`.toLowerCase());
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
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

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(r => this.roles.push(Role.get(r.ID)));
		}
		else {
			const objects = new List(results !== undefined ? results.map(r => Role.get(r.ID)) : Role.all.filter(r => r.SystemID === this.organization.ID && r.ParentID === this.parentID)).OrderBy(r => r.Title).ThenByDescending(r => r.LastModified);
			this.roles = results !== undefined
				? this.roles.concat(objects.ToArray())
				: objects.Take(this.pageNumber * this.pagination.PageSize).ToArray();
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	async openAsync(event: Event, role: Role) {
		event.stopPropagation();
		await this.configSvc.navigateForwardAsync(role.routerURI);
	}

	async showChildrenAsync(event: Event, role: Role) {
		event.stopPropagation();
		await this.configSvc.navigateForwardAsync(role.listURI);
	}

}
