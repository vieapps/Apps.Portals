import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
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

	title = "Roles";
	roles = new Array<Role>();
	parentRole: Role;
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
	filtering = false;
	labels = {
		filter: "Quick filter",
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

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		if (this.organization === undefined) {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		this.labels = {
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.roles.title.${(this.searching ? "search" : "list")}`);
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: "" });
		this.children = await this.configSvc.getResourceAsync("portals.roles.list.children");

		if (this.searching) {
			this.filterBy.And = [{ SystemID: { Equals: this.organization.ID } }];
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.roles.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.roles.title.search"), "search", () => this.openSearchAsync(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
			];

			this.parentID = this.configSvc.requestParams["ParentID"];
			this.parentRole = Role.get(this.parentID);

			if (this.parentRole !== undefined) {
				this.roles = this.parentRole.Children;
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.parentRole.FullTitle}]` });
				await this.appFormsSvc.hideLoadingAsync();
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Role" && (this.parentRole.ID === info.args.ID || this.parentRole.ID === info.args.ParentID)) {
						this.roles = this.parentRole.Children;
					}
				}, `Roles:${this.parentRole.ID}:Refresh`);
			}
			else {
				this.configSvc.appTitle = this.title = AppUtility.format(title, { info: `[${this.organization.Title}]` });
				this.filterBy.And = [
					{ SystemID: { Equals: this.organization.ID } },
					{ ParentID: "IsNull" }
				];
				await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
				AppEvents.on("Portals", info => {
					if (info.args.Object === "Role" && info.args.ParentID === undefined) {
						this.prepareResults();
					}
				}, "Roles:Refresh");
			}
		}

		if (this.configSvc.isDebug) {
			console.log("<Portals>: Roles", this.configSvc.requestParams, this.filterBy, this.sortBy);
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

	async onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.messages.searching"));
				this.roles = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				await this.searchAsync(async () => {
					this.infiniteScrollCtrl.disabled = false;
					await this.appFormsSvc.hideLoadingAsync();
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

	onClear() {
		this.filterBy.Query = undefined;
		this.roles = this.filtering ? this.objects.map(obj => obj) : [];
	}

	async onCancel() {
		if (this.searching) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			PlatformUtility.invoke(() => {
				this.onClear();
				this.filtering = false;
			}, 123);
		}
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
		return this.portalsCoreSvc.getPaginationPrefix("role");
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
			await TrackingUtility.trackAsync(`${this.title} [${this.pageNumber}]`, this.configSvc.currentUrl);
		};
		if (this.searching) {
			this.subscription = this.portalsCoreSvc.searchRole(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCoreSvc.searchRoleAsync(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.roles.push(Role.get(o.ID) || Role.deserialize(o, Role.get(o.ID))));
		}
		else {
			const predicate: (role: Role) => boolean = obj => obj.SystemID === this.organization.ID && obj.ParentID === this.parentID;
			let objects = results === undefined
				? Role.instances.toList(predicate)
				: Role.toList(results).Where(predicate);
			objects = objects.OrderBy(o => o.Title).ThenByDescending(o => o.LastModified);
			this.roles = results === undefined && this.pagination !== undefined
				? objects.Take(this.pageNumber * this.pagination.PageSize).ToArray()
				: this.roles.concat(objects.ToArray());
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	async showActionsAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async openSearchAsync(filtering: boolean = true) {
		await this.listCtrl.closeSlidingItems();
		if (filtering) {
			this.filtering = true;
			PlatformUtility.focus(this.searchCtrl);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.filter");
			this.objects = this.roles.map(obj => obj);
		}
		else {
			await this.configSvc.navigateForwardAsync("/portals/core/roles/search");
		}
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(`/portals/core/roles/create${(this.parentID === undefined ? "" : "?x-request=" + AppCrypto.jsonEncode({ ParentID: this.parentID }))}`);
	}

	async openAsync(event: Event, role: Role) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(role.routerURI);
	}

	async showChildrenAsync(event: Event, role: Role) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(role.listURI);
	}

	async refreshAsync(event: Event, role: Role) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.portalsCoreSvc.refreshRoleAsync(role.ID, async _ => await this.appFormsSvc.showToastAsync("The role was freshen-up"));
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("Role", this.organization.ID);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync("Role", this.organization.ID);
	}

}
