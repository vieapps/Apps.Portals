import { Subscription } from "rxjs";
import { List } from "linqts";
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, NgZone } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppUtility } from "../../../../components/app.utility";
import { TrackingUtility } from "../../../../components/app.utility.trackings";
import { PlatformUtility } from "../../../../components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "../../../../components/app.pagination";
import { AppFormsService } from "../../../../components/forms.service";
import { ConfigurationService } from "../../../../services/configuration.service";
import { AuthenticationService } from "../../../../services/authentication.service";
import { PortalsService } from "../../../../services/portals.service";
import { Organization } from "../../../../models/portals.organization";

@Component({
	selector: "page-organizations-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class OrganizationsListPage implements OnInit, OnDestroy, AfterViewInit {

	constructor(
		public zone: NgZone,
		public appFormsSvc: AppFormsService,
		public configSvc: ConfigurationService,
		public authSvc: AuthenticationService,
		public portalsSvc: PortalsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "Organizations";
	organizations = new Array<Organization>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	actions: Array<{
		text: string,
		role: string,
		icon: string,
		handler: () => void
	}>;
	subscription: Subscription;
	@ViewChild(IonSearchbar, { static: false }) searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: false }) scrollCtrl: IonInfiniteScroll;

	ngOnInit() {
		if (!this.authSvc.isServiceAdministrator()) {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateHomeAsync()
			]);
		}
		else {
			this.initializeAsync();
		}
	}

	ngAfterViewInit() {
		this.initializeSearchbarAsync();
		this.prepareActionsAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	get locale() {
		return this.configSvc.locale;
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get sortBy() {
		return { Name: "Ascending" };
	}

	async initializeAsync() {
		this.searching = this.configSvc.currentUrl.startsWith("/portals/organizations/search");
		this.configSvc.appTitle = this.title = this.searching
			? await this.configSvc.getResourceAsync("portals.organizations.title.search")
			: await this.configSvc.getResourceAsync("portals.organizations.title.list");
		if (!this.searching) {
			this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.portalsSvc.name) || AppPagination.getDefault();
			this.pagination.PageNumber = this.pageNumber;
			await this.searchAsync();
		}
	}

	async initializeSearchbarAsync() {
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync(`portals.organizations.list.searchbar.${(this.searching ? "search" : "filter")}`);
		if (this.searching) {
			PlatformUtility.focus(this.searchCtrl);
		}
	}

	async prepareActionsAsync() {
		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.organizations.title.create"), "create", () => this.openCreateAsync())
		];
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	track(index: number, organization: Organization) {
		return `${organization.ID}@${index}`;
	}

	openCreateAsync() {
		return this.zone.run(async () => await this.configSvc.navigateForwardAsync("/portals/organizations/create"));
	}

	openSearchAsync() {
		return this.zone.run(async () => await this.configSvc.navigateForwardAsync("/portals/organizations/search"));
	}

	onStartSearch($event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty($event.detail.value)) {
			this.filterBy.Query = $event.detail.value;
			if (this.searching) {
				this.organizations = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.searchAsync(() => this.scrollCtrl.disabled = false);
			}
			else {
				this.prepareResults();
			}
		}
	}

	onCancelSearch() {
		this.cancelSearch();
		this.filterBy.Query = undefined;
		if (this.searching) {
			this.organizations = [];
		}
		else {
			this.prepareResults();
		}
	}

	onScroll() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
			this.searchAsync(() => {
				if (this.scrollCtrl !== undefined) {
					this.scrollCtrl.complete();
				}
			});
		}
		else if (this.scrollCtrl !== undefined) {
			this.scrollCtrl.complete();
			this.scrollCtrl.disabled = true;
		}
	}

	async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.portalsSvc.name);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
		};
		if (this.searching) {
			this.subscription = this.portalsSvc.searchOrganization(this.request, onNextAsync);
		}
		else {
			await this.portalsSvc.searchOrganizationAsync(this.request, onNextAsync);
		}
	}

	cancelSearch(dontDisableInfiniteScroll?: boolean) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isFalse(dontDisableInfiniteScroll)) {
			this.scrollCtrl.disabled = true;
		}
	}

	prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.organizations.push(Organization.get(o.ID)));
		}
		else {
			let objects = new List(results === undefined ? Organization.instances.values() : results.map(o => Organization.get(o.ID)));
			objects = objects.OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
			this.organizations = results === undefined
				? objects.Take(this.pageNumber * this.pagination.PageSize).ToArray()
				: this.organizations.concat(objects.ToArray());
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

}
