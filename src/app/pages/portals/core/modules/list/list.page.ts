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
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { ModuleDefinition } from "@models/portals.base";
import { Module } from "@models/portals.core.module";

@Component({
	selector: "page-portals-core-modules-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class ModulesListPage implements OnInit, OnDestroy {

	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private organization: Organization;
	private subscription: Subscription;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private systemID: string;
	private definitionID: string;
	private definitions: Array<ModuleDefinition>;

	title = "Modules";
	modules = new Array<Module>();
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

	get totalDisplays() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
		AppEvents.off("Portals", "Modules:Refresh");
	}

	private async initializeAsync() {
		this.systemID = this.configSvc.requestParams["SystemID"];
		this.definitionID = this.configSvc.requestParams["DefinitionID"];

		this.organization = Organization.get(this.systemID) || this.portalsCoreSvc.activeOrganization || new Organization();
		this.isSystemModerator = this.authSvc.isSystemModerator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		if (!this.isSystemModerator && (this.organization === undefined || !AppUtility.isNotEmpty(this.organization.ID))) {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.canModerateOrganization) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateHomeAsync();
			return;
		}

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.modules.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.organization.Title}]` });
		this.definitions = await this.portalsCoreSvc.getDefinitionsAsync();

		if (!AppUtility.isNotEmpty(this.systemID) && !AppUtility.isNotEmpty(this.definitionID)) {
			this.systemID = this.organization.ID;
		}

		if (AppUtility.isNotEmpty(this.systemID)) {
			this.filterBy.And.push({ SystemID: { Equals: this.systemID } });
		}
		if (AppUtility.isNotEmpty(this.definitionID)) {
			this.filterBy.And.push({ ModuleDefinitionID: { Equals: this.definitionID } });
		}

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.modules.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.modules.title.create"), "create", () => this.openCreateAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.modules.title.search"), "search", () => this.openSearchAsync())
			];

			this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `module@${this.portalsCoreSvc.name}`) || AppPagination.getDefault();
			this.pagination.PageNumber = this.pageNumber;
			await this.searchAsync();
			AppEvents.on("Portals", info => {
				if (info.args.Object === "Module") {
					this.prepareResults();
				}
			}, "Modules:Refresh");
		}
	}

	track(index: number, modul: Module) {
		return `${modul.ID}@${index}`;
	}

	getInfo(modul: Module) {
		const moduleDefinition = this.definitions.find(definition => definition.ID === modul.ModuleDefinitionID);
		return `Definition: ${moduleDefinition.Title}${(AppUtility.isNotEmpty(modul.Description) ? " - " + modul.Description : "")}`;
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	openCreateAsync() {
		return this.configSvc.navigateForwardAsync("/portals/core/modules/create");
	}

	openSearchAsync() {
		return this.configSvc.navigateForwardAsync("/portals/core/modules/search");
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.modules = [];
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
		this.modules = [];
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
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, `module@${this.portalsCoreSvc.name}`.toLowerCase()) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onNextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, `module@${this.portalsCoreSvc.name}`.toLowerCase());
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchModule(this.request, onNextAsync);
		}
		else {
			await this.portalsCoreSvc.searchModuleAsync(this.request, onNextAsync);
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
			(results || []).forEach(o => this.modules.push(Module.get(o.ID)));
		}
		else {
			let filterFn: (value: Module) => boolean;
			if (AppUtility.isNotEmpty(this.systemID) && AppUtility.isNotEmpty(this.definitionID)) {
				filterFn = o => o.SystemID === this.systemID && o.ModuleDefinitionID === this.definitionID;
			}
			else if (AppUtility.isNotEmpty(this.definitionID)) {
				filterFn = this.isSystemModerator
					? o => o.ModuleDefinitionID === this.definitionID
					: o => o.SystemID === this.systemID && o.ModuleDefinitionID === this.definitionID;
			}
			else if (AppUtility.isNotEmpty(this.systemID)) {
				filterFn = o => o.SystemID === this.systemID;
			}
			else if (this.organization !== undefined) {
				filterFn = o => o.SystemID === this.organization.ID;
			}
			const objects = new List(results !== undefined
				? results.map(o => Module.get(o.ID))
				: filterFn !== undefined ? Module.all.filter(filterFn) : Module.all
			).OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
			this.modules = results !== undefined
				? this.modules.concat(objects.ToArray())
				: objects.Take(this.pageNumber * this.pagination.PageSize).ToArray();
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

}
