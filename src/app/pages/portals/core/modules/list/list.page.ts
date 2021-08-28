import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Module } from "@app/models/portals.core.all";
import { ModuleDefinition } from "@app/models/portals.base";

@Component({
	selector: "page-portals-core-modules-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsModulesListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonList, { static: true }) private listCtrl: IonList;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private isSystemAdministrator = false;
	private canModerateOrganization = false;
	private systemID: string;
	private organization: Organization;
	private definitionID: string;
	private definition: ModuleDefinition;
	private definitions: Array<ModuleDefinition>;

	title = {
		track: "Modules",
		page: "Modules"
	};
	modules = new Array<Module>();
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy: AppDataFilter = {
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
	labels = {
		edit: "Update this module",
		active: "Set active",
		contentTypes: "View the list of content-types",
		expressions: "Expressions",
		cache: "Clear cache"
	};

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
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
		AppEvents.off(this.portalsCoreSvc.name, this.definition !== undefined ? `Modules:${this.definitionID}:Refresh` : "Modules:Refresh");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.systemID = this.configSvc.requestParams["SystemID"];
		this.definitionID = this.configSvc.requestParams["DefinitionID"];

		this.definitions = this.portalsCoreSvc.moduleDefinitions;
		this.definition = AppUtility.isNotEmpty(this.definitionID) ? this.definitions.find(definition => definition.ID === this.definitionID) : undefined;

		this.organization = this.portalsCoreSvc.getOrganization(this.systemID);
		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		this.title.track = await this.configSvc.getResourceAsync("portals.modules.title.list", { info: "" });
		if (!this.isSystemAdministrator && this.organization === undefined) {
			await this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateRootAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.canModerateOrganization) {
			await this.trackAsync(`${this.title.track} | No Permission`, "Check");
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateRootAsync()
			]));
			return;
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			active: await this.configSvc.getResourceAsync("portals.module.list.active"),
			contentTypes: await this.configSvc.getResourceAsync("portals.contenttypes.title.list", { info: "" }),
			expressions: await this.configSvc.getResourceAsync("portals.expressions.title.list", { info: "" }),
			cache: await this.configSvc.getResourceAsync("portals.common.cache.title")
		};

		if (!AppUtility.isNotEmpty(this.systemID) && !AppUtility.isNotEmpty(this.definitionID)) {
			this.systemID = this.organization.ID;
		}

		if (AppUtility.isNotEmpty(this.systemID)) {
			this.filterBy.And.push({ SystemID: { Equals: this.systemID } });
		}
		if (this.definition !== undefined) {
			this.filterBy.And.push({ ModuleDefinitionID: { Equals: this.definitionID } });
		}

		this.configSvc.appTitle = this.title.page = await this.configSvc.getResourceAsync("portals.modules.title.list", { info: `[${this.organization.Title}]` });
		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.modules.title.create"), "create", () => this.createAsync()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
		];
		await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
		AppEvents.on("Portals", info => {
			if (info.args.Object === "Module" && (info.args.Type === "Created" || info.args.Type === "Deleted")) {
				this.prepareResults();
			}
		}, this.definition !== undefined ? `Modules:${this.definitionID}:Refresh` : "Modules:Refresh");
	}

	track(index: number, modul: Module) {
		return `${modul.ID}@${index}`;
	}

	getInfo(modul: Module) {
		const moduleDefinition = this.definitions.find(definition => definition.ID === modul.ModuleDefinitionID);
		return `Definition: ${moduleDefinition.Title}${(AppUtility.isNotEmpty(modul.Description) ? " - " + modul.Description : "")}`;
	}

	async showActionsAsync() {
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async createAsync() {
		await this.configSvc.navigateForwardAsync("/portals/core/modules/create");
	}

	async onInfiniteScrollAsync() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
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

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("module");
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination);
		const onSuccess = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await this.trackAsync(this.title.track);
		};
		await this.portalsCoreSvc.searchModuleAsync(this.request, onSuccess, async error => await Promise.all([
			this.appFormsSvc.showErrorAsync(error),
			this.trackAsync(this.title.track)
		]));
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		const predicate: (module: Module) => boolean = AppUtility.isNotEmpty(this.systemID) && AppUtility.isNotEmpty(this.definitionID)
			? obj => obj.SystemID === this.systemID && obj.ModuleDefinitionID === this.definitionID
			: AppUtility.isNotEmpty(this.definitionID)
				? this.isSystemAdministrator
					? obj => obj.ModuleDefinitionID === this.definitionID
					: obj => obj.SystemID === this.systemID && obj.ModuleDefinitionID === this.definitionID
				: obj => obj.SystemID === this.systemID;
		let objects = results === undefined
			? Module.instances.toList(predicate)
			: Module.toList(results).Where(predicate);
		objects = objects.OrderBy(obj => obj.Title).ThenByDescending(obj => obj.LastModified);
		if (results === undefined && this.pagination !== undefined) {
			objects = objects.Take(this.pageNumber * this.pagination.PageSize);
		}
		this.modules = results === undefined
			? objects.ToArray()
			: this.modules.concat(objects.ToArray());
		if (onNext !== undefined) {
			onNext();
		}
	}

	async openAsync(event: Event, module: Module) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(module.routerURI);
	}

	async showContentTypesAsync(event: Event, module: Module) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "list", module.ansiTitle, { SystemID: module.SystemID, RepositoryID: module.ID }, "content.type", "core"));
	}

	async showExpressionsAsync(event: Event, module: Module) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, undefined, undefined, { RepositoryID: module.ID }, "expression", "core"));
	}

	refresh(event: Event, module: Module) {
		event.stopPropagation();
		this.listCtrl.closeSlidingItems().then(() => this.portalsCoreSvc.refreshModuleAsync(module.ID, () => this.appFormsSvc.showToastAsync("The module was freshen-up")));
	}

	async clearCacheAsync(event: Event, module: Module) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.clearCacheAsync("module", module.ID);
	}

	async setActiveAsync(event: Event, module: Module) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems().then(() => this.portalsCoreSvc.setActiveModule(module));
	}

	isActive(module: Module) {
		return module !== undefined && Module.active !== undefined && AppUtility.isEquals(module.ID, Module.active.ID);
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("Module", this.organization.ID);
		await this.trackAsync(this.actions[2].text, "Export");
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync("Module", this.organization.ID);
		await this.trackAsync(this.actions[3].text, "Import");
	}

	private async trackAsync(title: string, action?: string) {
		await TrackingUtility.trackAsync({ title: title, category: "Module", action: action || "Browse" });
	}

}
