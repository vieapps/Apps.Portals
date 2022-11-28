import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
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
		versions: "Versions",
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
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			this.appFormsSvc.showConfirmAsync(
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				() => this.configSvc.navigateRootAsync("/portals/core/organizations/list/all")
			);
			return;
		}

		if (!this.canModerateOrganization) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			active: await this.configSvc.getResourceAsync("portals.module.list.active"),
			contentTypes: await this.configSvc.getResourceAsync("portals.contenttypes.title.list", { info: "" }),
			expressions: await this.configSvc.getResourceAsync("portals.expressions.title.list", { info: "" }),
			versions: await this.configSvc.getResourceAsync("versions.view"),
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
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.modules.title.create"), "create", () => this.create()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll())
		];

		this.startSearch(() => this.appFormsSvc.hideLoadingAsync());
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

	showActions() {
		this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync("/portals/core/modules/create"));
	}

	onInfiniteScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.search(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : () => {});
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	private get paginationPrefix() {
		return this.portalsCoreSvc.getPaginationPrefix("module");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title.track);
		};
		this.portalsCoreSvc.searchModulesAsync(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		const predicate: (module: Module) => boolean = AppUtility.isNotEmpty(this.systemID) && AppUtility.isNotEmpty(this.definitionID)
			? object => object.SystemID === this.systemID && object.ModuleDefinitionID === this.definitionID
			: AppUtility.isNotEmpty(this.definitionID)
				? this.isSystemAdministrator
					? object => object.ModuleDefinitionID === this.definitionID
					: object => object.SystemID === this.systemID && object.ModuleDefinitionID === this.definitionID
				: object => object.SystemID === this.systemID;
		const objects = (results === undefined ? Module.instances.toArray(predicate) : Module.toArray(results).filter(predicate))
			.sortBy("Title", { name: "LastModified", reverse: true })
			.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
		this.modules = results === undefined ? objects : this.modules.concat(objects);
		if (onNext !== undefined) {
			onNext();
		}
	}

	private doRefresh(modules: Module[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title.track, "Refresh");
			if (index < modules.length - 1) {
				AppUtility.invoke(() => this.doRefresh(modules, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0 && modules.length > 1) {
			this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug ? () => console.log(`--- Start to refresh ${modules.length} modules -----------------`) : () => {});
		}
		this.portalsCoreSvc.refreshModuleAsync(modules[index].ID, refreshNext, refreshNext, undefined, useXHR);
	}

	private do(action: () => void, event?: Event) {
		if (event !== undefined) {
			event.stopPropagation();
		}
		this.listCtrl.closeSlidingItems().then(() => action());
	}

	open(event: Event, module: Module) {
		this.do(() => this.configSvc.navigateForwardAsync(module.routerURI), event);
	}

	showContentTypes(event: Event, module: Module) {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, "list", module.ansiTitle, { SystemID: module.SystemID, RepositoryID: module.ID }, "content.type", "core")), event);
	}

	showExpressions(event: Event, module: Module) {
		this.do(() => this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(undefined, undefined, undefined, { RepositoryID: module.ID }, "expression", "core")), event);
	}

	refresh(event: Event, module: Module) {
		this.do(() => this.doRefresh([module], 0, true, () => this.appFormsSvc.showToastAsync("The module was freshen-up")), event);
	}

	refreshAll() {
		this.doRefresh(this.modules, 0, false, () => this.appFormsSvc.showToastAsync("All the modules were freshen-up"));
	}

	clearCache(event: Event, module: Module) {
		this.do(() => this.portalsCoreSvc.clearCacheAsync("module", module.ID), event);
	}

	setActive(event: Event, module: Module) {
		this.do(() => this.portalsCoreSvc.setActiveModule(module), event);
	}

	isActive(module: Module) {
		return module !== undefined && Module.active !== undefined && AppUtility.isEquals(module.ID, Module.active.ID);
	}

	viewVersions(event: Event, module: Module) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(module.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "Module", id: module.ID })), event);
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("Module", this.organization.ID);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync("Module", this.organization.ID).then(() => this.trackAsync(this.actions[3].text, "Import"));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Module", action: action || "Browse" });
	}

}
