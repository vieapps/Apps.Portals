import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild, NgZone, ChangeDetectorRef } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { AppDataPagination, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { UserToken } from "@app/models/user";

@Component({
	selector: "page-tokens-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class TokensListPage implements OnInit, OnDestroy {

	constructor(
		private zone: NgZone,
		private changeDetector: ChangeDetectorRef,
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "Tokens";
	tokens = new Array<UserToken>();
	searching = false;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	filterBy = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy = { Title: "Ascending" };
	subscription: Subscription;

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	ngOnInit() {
		if (this.authSvc.isSystemAdministrator()) {
			this.initializeAsync();
			AppEvents.on("Token", _ => {
				this.tokens = UserToken.instances.toArray().sortBy({ name: "Title" }, { name: "Created", reverse: true });
			}, "UserTokenUpdater");
		}
		else {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateRootAsync()
			]);
		}
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
		AppEvents.off("Token", "UserTokenUpdater");
	}

	async initializeAsync() {
		this.searching = this.configSvc.currentURL.startsWith(this.configSvc.appConfig.URLs.users.search);
		this.configSvc.appTitle = this.title = this.searching
			? await this.configSvc.getResourceAsync("users.list.title.search")
			: await this.configSvc.getResourceAsync("tokens.list.title");
		if (this.searching) {
			PlatformUtility.focus(this.searchCtrl);
			this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("users.list.searchbar");
		}
		else {
			await this.appFormsSvc.showLoadingAsync();
			await this.startSearchAsync(async () => await this.appFormsSvc.hideLoadingAsync());
		}
	}

	track(index: number, profile: UserToken) {
		return `${profile.ID}@${index}`;
	}

	openSearchAsync() {
		return this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.users.search);
	}

	onStartSearch(event: any) {
		this.cancelSearch();
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.tokens = [];
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
		this.tokens = [];
	}

	onCancelSearch() {
		this.onClearSearch();
		this.startSearchAsync();
	}

	async onInfiniteScrollAsync() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchAsync(async () => await (this.infiniteScrollCtrl !== undefined ? this.infiniteScrollCtrl.complete() : AppUtility.promise));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private get paginationPrefix() {
		return `token@${this.usersSvc.name}`.toLowerCase();
	}

	private async startSearchAsync(onNext?: () => void, pagination?: AppDataPagination) {
		this.pagination = pagination || AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
		this.pagination.PageNumber = this.pageNumber = 0;
		await this.searchAsync(onNext);
	}

	private async searchAsync(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const nextAsync = async (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
		};
		if (this.searching) {
			this.subscription = this.usersSvc.searchTokens(this.request, nextAsync);
		}
		else {
			await this.usersSvc.searchTokensAsync(this.request, nextAsync);
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
			(results || []).forEach(obj => {
				const token = UserToken.deserialize(obj, UserToken.get(obj.ID));
				this.tokens.push(token);
			});
		}
		else {
			const objects = (results === undefined ? UserToken.instances.toArray().map(obj => obj as UserToken) : UserToken.toArray(results))
				.sortBy("Title", { name: "LastAccess", reverse: true })
				.take(results === undefined && this.pagination !== undefined ? this.pageNumber * this.pagination.PageSize : 0);
			this.tokens = results === undefined ? objects : this.tokens.concat(objects);
		}
		if (this.searching || this.configSvc.isElectronApp) {
			this.zone.run(() => this.changeDetector.detectChanges());
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	create() {
		this.configSvc.navigateForwardAsync(`${this.configSvc.appConfig.URLs.users.root}/tokens/create`);
	}

}
