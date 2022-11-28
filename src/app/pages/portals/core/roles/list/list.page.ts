import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Role } from "@app/models/portals.core.all";

@Component({
	selector: "page-portals-core-roles-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsRolesListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private organization: Organization;
	private parentID: string;
	private subscription: Subscription;
	private children = "{{number}} children: {{children}}";

	title = {
		track: "Roles",
		page: "Roles"
	};
	roles = new Array<Role>();
	parentRole: Role;
	searching = false;
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
	filtering = false;
	labels = {
		filter: "Quick filter",
		versions: "Versions",
		cancel: "Cancel"
	};
	private objects = new Array<Role>();

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	get gotPagination() {
		return this.pagination !== undefined || this.parentRole !== undefined;
	}

	get totalDisplays() {
		return this.parentRole !== undefined
			? this.parentRole.childrenIDs.length
			: AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get totalRecords() {
		return this.parentRole !== undefined
			? this.parentRole.childrenIDs.length
			: this.pagination.TotalRecords;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (!this.searching) {
			if (this.parentRole !== undefined) {
				AppEvents.off(this.portalsCoreSvc.name, `Roles:${this.parentRole.ID}:Refresh`);
			}
			else {
				AppEvents.off(this.portalsCoreSvc.name, "Roles:Refresh");
			}
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.searching = this.configSvc.currentURL.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.roles.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title.track = AppUtility.format(title, { info: "" });
		this.children = await this.configSvc.getResourceAsync("portals.roles.list.children");

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check").then(async () => this.appFormsSvc.showConfirmAsync(
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				async () => await this.configSvc.navigateRootAsync("/portals/core/organizations/list/all")
			));
			return;
		}

		if (!this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.labels = {
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.roles.list.searchbar");
			this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl));
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.create"), "create", () => this.create()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.search"), "search", () => this.openSearch(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcel()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcel()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.refresh"), "refresh", () => this.refreshAll())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentRole = Role.get(this.parentID);

			if (this.parentRole !== undefined) {
				this.roles = this.parentRole.Children;
				this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${this.parentRole.FullTitle}]` });
				this.trackAsync(this.title.track).then(() => this.appFormsSvc.hideLoadingAsync());
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Role" && (this.parentRole.ID === info.args.ID || this.parentRole.ID === info.args.ParentID)) {
						this.roles = this.parentRole.Children;
					}
				}, `Roles:${this.parentRole.ID}:Refresh`);
			}
			else {
				this.configSvc.appTitle = this.title.page = AppUtility.format(title, { info: `[${this.organization.Title}]` });
				this.filterBy.And = [
					{ SystemID: { Equals: this.organization.ID } },
					{ ParentID: "IsNull" }
				];
				this.startSearch(() => this.appFormsSvc.hideLoadingAsync());
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Role" && info.args.ParentID === undefined) {
						this.prepareResults();
					}
				}, "Roles:Refresh");
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

	onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				AppUtility.invoke(async () => {
					await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.messages.searching"));
					this.roles = [];
					this.pageNumber = 0;
					this.pagination = AppPagination.getDefault();
					this.search(() => this.appFormsSvc.hideLoadingAsync(() => this.infiniteScrollCtrl.disabled = false));
				});
			}
			else {
				this.roles = this.objects.filter(Role.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear(isOnCanceled?: boolean) {
		if (this.searching || this.filtering) {
			this.filterBy.Query = undefined;
			this.roles = this.filtering ? this.objects.map(object => object) : [];
			if (isOnCanceled) {
				this.filtering = false;
				this.infiniteScrollCtrl.disabled = false;
				this.objects = [];
			}
		}
	}

	onCancel() {
		if (this.searching) {
			this.configSvc.navigateBackAsync();
		}
		else {
			this.onClear(true);
		}
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
		return this.portalsCoreSvc.getPaginationPrefix("role");
	}

	private startSearch(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		this.search(onNext);
	}

	private search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			this.trackAsync(this.title.track);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchRoles(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
		}
		else {
			this.portalsCoreSvc.searchRolesAsync(this.request, onSuccess, error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			this.roles.merge((results || []).map(object => Role.get(object.ID) || Role.deserialize(object, Role.get(object.ID))));
		}
		else {
			const predicate: (role: Role) => boolean = object => object.SystemID === this.organization.ID && object.ParentID === this.parentID;
			const objects = (results === undefined ? Role.instances.toArray(predicate) : Role.toArray(results).filter(predicate))
				.sortBy("Title", { name: "LastModified", reverse: true })
				.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
			this.roles = results === undefined ? objects : this.roles.concat(objects);
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	private doRefresh(roles: Role[], index: number, useXHR: boolean = false, onFreshenUp?: () => void) {
		const refreshNext: () => void = () => {
			this.trackAsync(this.title.track, "Refresh");
			if (index < roles.length - 1) {
				AppUtility.invoke(() => this.doRefresh(roles, index + 1, useXHR, onFreshenUp));
			}
			else {
				this.appFormsSvc.hideLoadingAsync(() => AppUtility.invoke(onFreshenUp !== undefined ? () => onFreshenUp() : undefined));
			}
		};
		if (index === 0 && roles.length > 1) {
			this.appFormsSvc.showLoadingAsync(this.actions.last().text).then(this.configSvc.isDebug ? () => console.log(`--- Start to refresh ${roles.length} roles -----------------`) : () => {});
		}
		this.portalsCoreSvc.refreshRoleAsync(roles[index].ID, refreshNext, refreshNext, undefined, useXHR);
	}

	private do(action: () => void, event?: Event) {
		if (event !== undefined) {
			event.stopPropagation();
		}
		this.listCtrl.closeSlidingItems().then(() => action());
	}

	showActions() {
		this.do(() => this.appFormsSvc.showActionSheetAsync(this.actions));
	}

	openSearch(filtering: boolean = true) {
		this.do(async () => {
			if (filtering) {
				this.filtering = true;
				this.objects = this.roles.map(obj => obj);
				this.infiniteScrollCtrl.disabled = true;
				this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
				PlatformUtility.focus(this.searchCtrl);
			}
			else {
				this.configSvc.navigateForwardAsync("/portals/core/roles/search");
			}
		});
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync(`/portals/core/roles/create${(this.parentID === undefined ? "" : "?x-request=" + AppCrypto.jsonEncode({ ParentID: this.parentID }))}`));
	}

	open(event: Event, role: Role) {
		this.do(() => this.configSvc.navigateForwardAsync(role.routerURI), event);
	}

	showChildren(event: Event, role: Role) {
		this.do(() => this.configSvc.navigateForwardAsync(role.listURI), event);
	}

	viewVersions(event: Event, role: Role) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(role.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "Role", id: role.ID })), event);
	}

	refresh(event: Event, role: Role) {
		this.do(() => this.doRefresh([role], 0, true, () => this.appFormsSvc.showToastAsync("The role was freshen-up")), event);
	}

	refreshAll() {
		this.doRefresh(this.roles, 0, false, () => this.appFormsSvc.showToastAsync("All the roles were freshen-up"));
	}

	exportToExcel() {
		this.do(async () => await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.common.excel.message.confirm"),
			async () => {
				await this.portalsCoreSvc.exportToExcelAsync("Role", this.organization.ID);
				await this.trackAsync(this.actions[2].text, "Export");
			},
			"{{default}}",
			"{{default}}"
		));
	}

	importFromExcel() {
		this.portalsCoreSvc.importFromExcelAsync("Role", this.organization.ID).then(() => this.trackAsync(this.actions[3].text, "Import"));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Role", action: action || "Browse" });
	}

}
