import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "../../../../../components/app.events";
import { AppUtility } from "../../../../../components/app.utility";
import { TrackingUtility } from "../../../../../components/app.utility.trackings";
import { PlatformUtility } from "../../../../../components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "../../../../../components/app.pagination";
import { AppFormsService } from "../../../../../components/forms.service";
import { ConfigurationService } from "../../../../../services/configuration.service";
import { AuthenticationService } from "../../../../../services/authentication.service";
import { PortalsCoreService } from "../../../../../services/portals.core.service";
import { Organization } from "../../../../../models/portals.core.organization";
import { Role } from "../../../../../models/portals.core.role";

@Component({
	selector: "page-portals-core-roles-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class RolesListPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

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

	private organization = this.portalsCoreSvc.activeOrganization || new Organization();
	private subscription: Subscription;
	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	get locale() {
		return this.configSvc.locale;
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	ngOnInit() {
		if (this.organization.ID === "") {
			Promise.all([async () => {
				await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.roles.list.noinfo"));
				await this.configSvc.navigateHomeAsync();
			}]);
		}
		else {
			if (this.authSvc.isServiceModerator(this.portalsCoreSvc.name, this.organization.Privileges)) {
				this.initializeAsync();
				AppEvents.on("Portals", info => {
					if (!this.searching && info.args.Object === "Role" && (info.args.Type === "Updated" || info.args.Type === "Deleted")) {
						this.prepareResults();
					}
				}, "RefreshListOfRolesEventHandler");
			}
			else {
				Promise.all([
					this.appFormsSvc.showToastAsync("Hmmmmmm...."),
					this.configSvc.navigateHomeAsync()
				]);
			}
		}
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
		AppEvents.off("Portals", "RefreshListOfRolesEventHandler");
	}

	private async initializeAsync() {
		this.searching = this.configSvc.currentUrl.startsWith("/portals/core/roles/search");
		this.configSvc.appTitle = this.title = this.searching
			? await this.configSvc.getResourceAsync("portals.roles.title.search")
			: await this.configSvc.getResourceAsync("portals.roles.title.list");
		if (this.searching) {
			PlatformUtility.focus(this.searchCtrl);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.roles.list.searchbar");
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.create"), "create", () => this.openCreateAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.search"), "search", () => this.openSearchAsync())
			];
			this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `role@${this.portalsCoreSvc.name}`) || AppPagination.getDefault();
			this.pagination.PageNumber = this.pageNumber;
			await this.searchAsync();
		}
	}

	track(index: number, role: Role) {
		return `${role.ID}@${index}`;
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	openCreateAsync() {
		return this.configSvc.navigateForwardAsync("/portals/core/roles/create");
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

	onClearSearch(event: any) {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		this.roles = [];
	}

	onCancelSearch(event: any) {
		this.onClearSearch(event);
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
			(results || []).forEach(o => this.roles.push(Role.get(o.ID)));
		}
		else {
			const objects = new List(results === undefined ? Role.instances.values().filter(o => o.SystemID === this.organization.ID) : results.map(o => Role.get(o.ID))).OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
			this.roles = results === undefined
				? objects.Take(this.pageNumber * this.pagination.PageSize).ToArray()
				: this.roles.concat(objects.ToArray());
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

}