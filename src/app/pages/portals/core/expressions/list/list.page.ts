import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonList } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination, AppDataPagination, AppDataRequest } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Module, ContentType, Expression } from "@app/models/portals.core.all";
import { ContentTypeDefinition } from "@app/models/portals.base";

@Component({
	selector: "page-portals-core-expressions-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsExpressionsListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;
	@ViewChild(IonList, { static: true }) private listCtrl: IonList;

	private subscription: Subscription;
	private isSystemAdministrator = false;
	private canModerateOrganization = false;
	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private contentTypeDefinitions: Array<ContentTypeDefinition>;
	private contentTypeDefinition: ContentTypeDefinition;
	private objects = new Array<Expression>();

	title = "Expressions";
	expressions = new Array<Expression>();
	searching = false;
	filtering = false;
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
	labels = {
		edit: "Update this expression",
		advancedEdit: "Update this expression in advanced mode",
		filter: "Quick filter",
		cancel: "Cancel"
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
		if (!this.searching) {
			AppEvents.off(this.portalsCoreSvc.name, "Expressions:Refresh");
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();

		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		this.module = Module.get(this.configSvc.requestParams["RepositoryID"]);
		this.contentType = ContentType.get(this.configSvc.requestParams["RepositoryEntityID"]);
		this.contentTypeDefinitions = this.portalsCoreSvc.contentTypeDefinitions;
		const contentTypeDefinitionID = this.configSvc.requestParams["ContentTypeDefinitionID"];
		this.contentTypeDefinition = AppUtility.isNotEmpty(contentTypeDefinitionID) ? this.contentTypeDefinitions.find(definition => definition.ID === contentTypeDefinitionID) : undefined;

		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		if (!this.isSystemAdministrator && this.organization === undefined) {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				undefined,
				async () => await this.configSvc.navigateHomeAsync("/portals/core/organizations/list/all"),
				await this.configSvc.getResourceAsync("common.buttons.ok")
			);
			return;
		}

		if (!this.canModerateOrganization || this.organization === undefined) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateHomeAsync()
			]));
			return;
		}

		this.filterBy.And.push({ SystemID: { Equals: this.organization.ID } });
		if (this.module !== undefined) {
			this.filterBy.And.push({ RepositoryID: { Equals: this.module.ID } });
		}
		if (this.contentType !== undefined) {
			this.filterBy.And.push({ RepositoryEntityID: { Equals: this.contentType.ID } });
		}
		if (this.contentTypeDefinition !== undefined) {
			this.filterBy.And.push({ ContentTypeDefinitionID: { Equals: this.contentTypeDefinition.ID } });
		}

		this.labels = {
			edit: await this.configSvc.getResourceAsync("common.buttons.edit"),
			advancedEdit: await this.configSvc.getResourceAsync("portals.expressions.update.buttons.edit"),
			filter: await this.configSvc.getResourceAsync("common.buttons.filter"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.searching = this.configSvc.currentUrl.endsWith("/search");
		const title = await this.configSvc.getResourceAsync(`portals.expressions.title.${(this.searching ? "search" : "list")}`);
		const titleInfo = this.contentType !== undefined
			? this.organization.Title + " > " + this.contentType.Title
			: this.contentTypeDefinition !== undefined
				? this.organization.Title + " > " + this.contentTypeDefinition.Title
				: this.module !== undefined
					? this.organization.Title + " > " + this.module.Title
					: this.organization.Title;
		this.configSvc.appTitle = this.title = AppUtility.format(title, { info: titleInfo !== undefined ? `[${titleInfo}]` : "" });

		if (this.searching) {
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.expressions.list.searchbar");
			PlatformUtility.focus(this.searchCtrl);
			await this.appFormsSvc.hideLoadingAsync();
		}
		else {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.expressions.title.create"), "create", () => this.createAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.expressions.title.search"), "search", () => this.openSearchAsync(false)),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.export"), "code-download", () => this.exportToExcelAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.common.excel.action.import"), "code-working", () => this.importFromExcelAsync())
			];
			await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
			AppEvents.on(this.portalsCoreSvc.name, info => {
				if (info.args.Object === "Expression" && (info.args.Type === "Created" || info.args.Type === "Deleted")) {
					this.prepareResults();
				}
			}, "Expressions:Refresh");
		}
	}

	track(index: number, expression: Expression) {
		return `${expression.ID}@${index}`;
	}

	getInfo(expression: Expression) {
		const contentType = expression.contentType;
		return (contentType !== undefined ? `Type: ${contentType.Title}` : `Definition: ${expression.contentTypeDefinition.Title}`)
			+ (AppUtility.isNotEmpty(expression.Description) ? ` - ${expression.Description}` : "");
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
				this.expressions = [];
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				await this.searchAsync(async () => {
					this.infiniteScrollCtrl.disabled = false;
					await this.appFormsSvc.hideLoadingAsync();
				});
			}
			else {
				this.expressions = this.objects.filter(Expression.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear() {
		this.filterBy.Query = undefined;
		this.expressions = this.filtering ? this.objects.map(obj => obj) : [];
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
		return this.portalsCoreSvc.getPaginationPrefix("expression");
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
			this.subscription = this.portalsCoreSvc.searchExpression(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
		else {
			await this.portalsCoreSvc.searchExpressionAsync(this.request, onSuccess, async error => await this.appFormsSvc.showErrorAsync(error));
		}
	}

	private prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(o => this.expressions.push(Expression.get(o.ID) || Expression.deserialize(o, Expression.get(o.ID))));
		}
		else {
			const predicate: (expression: Expression) => boolean = this.contentType !== undefined
			? obj => obj.RepositoryEntityID === this.contentType.ID
			: this.contentTypeDefinition !== undefined
				? obj => obj.ContentTypeDefinitionID === this.contentTypeDefinition.ID
				: this.module !== undefined
					? obj => obj.RepositoryID === this.module.ID
					: obj => obj.SystemID === this.organization.ID;
			let objects = results === undefined
				? Expression.instances.toList(predicate)
				: Expression.toList(results).Where(predicate);
			objects = objects.OrderBy(obj => obj.Title).ThenByDescending(obj => obj.LastModified);
			if (results === undefined && this.pagination !== undefined) {
				objects = objects.Take(this.pageNumber * this.pagination.PageSize);
			}
			this.expressions = results === undefined
				? objects.ToArray()
				: this.expressions.concat(objects.ToArray());
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
			this.objects = this.expressions.map(obj => obj);
		}
		else {
			await this.configSvc.navigateForwardAsync("/portals/core/expressions/search");
		}
	}

	async createAsync() {
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync("/portals/core/expressions/create/new");
	}

	async editAsync(event: Event, expression: Expression) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(expression.routerURI);
	}

	async editInAdvancedModeAsync(event: Event, expression: Expression) {
		event.stopPropagation();
		await this.listCtrl.closeSlidingItems();
		await this.configSvc.navigateForwardAsync(expression.getRouterURI({ ID: expression.ID, Advanced: true }));
	}

	async exportToExcelAsync() {
		await this.portalsCoreSvc.exportToExcelAsync("Expression", this.organization.ID);
	}

	async importFromExcelAsync() {
		await this.portalsCoreSvc.importFromExcelAsync("Expression", this.organization.ID);
	}

}
