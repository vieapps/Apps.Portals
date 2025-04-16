import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, ViewChild, NgZone, ChangeDetectorRef } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonSearchbar, IonInfiniteScroll, IonSelect } from "@ionic/angular";
import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppEvents } from "@app/components/app.events";
import { AppFormsService } from "@app/components/forms.service";
import { AppPagination } from "@app/components/app.pagination";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { AttachmentInfo } from "@app/models/base";

@Component({
	selector: "page-search",
	templateUrl: "./search.page.html",
	styleUrls: ["./search.page.scss"],
})

export class SearchPage implements OnInit, OnDestroy {

	constructor(
		private zone: NgZone,
		private changeDetector: ChangeDetectorRef,
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private filesSvc: FilesService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonSelect, { static: true }) private typeCtrl: IonSelect;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private subscription: Subscription;
	private adapters = new Dictionary<string, { Searcher: (request: AppDataRequest, onSuccess: (data?: any) => void, onError: (data?: any) => void) => Subscription, Preparer: (data?: any) => Array<SearchResult>, FilterConditions: Array<{ [key: string]: any }> }>();
	private filterBy: AppDataFilter = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	pageNumber = 0;
	pagination: AppDataPagination;
	types = new Array<{ Value: string; Label: string }>();
	results = new Array<SearchResult>();

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get debounce() {
		return this.configSvc.debounce;
	}

	get noThumbnailURI() {
		return `${this.configSvc.appConfig.URIs.files}thumbnails/no-image.png`;
	}

	get totalDisplays() {
		return this.pagination !== undefined ? AppPagination.computeTotal(this.pageNumber, this.pagination) : 0;
	}

	get totalRecords() {
		return this.pagination !== undefined ? this.pagination.TotalRecords : 0;
	}

	get totalPages() {
		return this.pagination !== undefined ? this.pagination.TotalPages : 0;
	}

	ngOnInit() {
		AppEvents.on("Searcher", info => {
			if (info.args.Type === "AdaptersPrepared") {
				this.prepareAdapters(info.args.Adapters);
				this.zone.run(() => this.changeDetector.detectChanges());
			}
			else if (info.args.Type === "UpdateObjectOfAttachment" && AppUtility.isNotEmpty(info.args.ID)) {
				const content = this.results.find(object => object.ID === info.args.ID);
				if (content !== undefined) {
					content.SubTitle = info.args.ObjectInfo.SubTitle;
					content.OpenURI = info.args.ObjectInfo.OpenURI;
					this.zone.run(() => this.changeDetector.detectChanges());
				}
			}
		}, "Prepare");
		AppEvents.on("Portals", info => {
			if ("ThumbnailURI" === info.args.Type && AppUtility.isNotEmpty(info.args.ID) && AppUtility.isNotEmpty(info.args.ThumbnailURI)) {
				const content = this.results.find(object => object.ID === info.args.ID);
				if (content !== undefined) {
					content.ThumbnailURI = info.args.ThumbnailURI;
					this.zone.run(() => this.changeDetector.detectChanges());
				}
			}
		}, "Searcher:PrepareThumbnailURI");
		this.initializeAsync(() => AppEvents.broadcast("Searcher", { Type: "PrepareAdapters" }));
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
		AppEvents.off("Searcher", "Prepare");
		AppEvents.off("Portals", "Searcher:PrepareThumbnailURI");
	}

	private async initializeAsync(onNext?: () => void) {
		await this.appFormsSvc.showLoadingAsync("Preparing...");
		if (!this.configSvc.isAuthenticated) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		const adapters = this.authSvc.isSystemAdministrator() ? [{
			Name : "Users",
			Label: "Profile",
			Searcher: (request: AppDataRequest, onSuccess: (data?: any) => void, onError: (data?: any) => void) => this.usersSvc.searchProfiles(request, onSuccess, onError),
			Preparer: (data?: any) => {
				const profiles = data !== undefined && AppUtility.isGotData(data.Objects) ? this.usersSvc.processProfiles(data.Objects as Array<any>) : [];
				return profiles.map(profile => ({
					ID: profile.ID,
					Title: profile.Name,
					Created: profile.Joined,
					LastModified: profile.LastAccess,
					Status: profile.Status === "Activated" ? "Published" : "Pending",
					StartDate: profile.Joined,
					PublishedTime: undefined,
					SubTitle: profile.Email,
					OpenURI: profile.routerURI,
					ThumbnailURI: profile.avatarURI,
				}));
			},
			FilterConditions: new Array<{ [key: string]: any }>()
		}] : [];
		adapters.push({ 
			Name: "Files",
			Label: "Attachment",
			Searcher: (request: AppDataRequest, onSuccess: (data?: any) => void, onError: (data?: any) => void) => this.filesSvc.searchAttachments(request, onSuccess, onError),
			Preparer: (data?: any) => {
				const results = new Array<SearchResult>();
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<AttachmentInfo>).forEach(attachment => {
						results.push({
							ID: attachment.ID,
							Title: attachment.Title,
							Created: new Date(attachment.Created),
							LastModified: new Date(attachment.LastModified),
							Status: "Published",
							StartDate: new Date(attachment.Created),
							PublishedTime: undefined,
							SubTitle: undefined,
							OpenURI: undefined,
							ThumbnailURI: undefined
						});
						if ((attachment.ServiceName === "portals" || attachment.ServiceName === "Portals") && AppUtility.isNotEmpty(attachment.ObjectName)) {
							AppEvents.broadcast("Searcher", { 
								Type: "GetObjectOfAttachment",
								ID: attachment.ID,
								ObjectInfo: {
									ID: (attachment.ObjectID || "").toLowerCase(),
									SystemID: (attachment.SystemID || "").toLowerCase(),
									RepositoryEntityID: (attachment.EntityInfo || "").toLowerCase(),
									ServiceName: "Portals",
									ObjectName: attachment.ObjectName.toUpperCase().substring(0, 1) + attachment.ObjectName.toLowerCase().substring(1)
								}
							});
						}
					});
				}
				return results;
			},
			FilterConditions: this.configSvc.appConfig.services.active.service === this.portalsCoreSvc.name && this.portalsCoreSvc.activeOrganization !== undefined ? [{ SystemID: { Equals: this.portalsCoreSvc.activeOrganization.ID } }] : []
		});
		this.prepareAdapters(adapters);

		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync("portals.cms.contents.list.search");
		await this.appFormsSvc.hideLoadingAsync(onNext);
		PlatformUtility.focus(this.searchCtrl);
	}

	onSearch(event: any) {
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value.replace(/%20/g, " ").replace(/\+/g, " ").trim();
			this.pagination = AppPagination.getDefault();
			this.pagination.PageNumber++;
			this.pageNumber = 0;
			this.results = [];
			this.appFormsSvc.showLoadingAsync("Searching...");
			this.search(() => this.appFormsSvc.hideLoadingAsync());
		}
		else {
			this.onClear();
		}
	}

	onClear(isChangeType: boolean = false) {
		this.filterBy.Query = undefined;
		this.filterBy.And = AppUtility.clone(this.adapters.get(this.typeCtrl.value).FilterConditions);
		this.infiniteScrollCtrl.disabled = false;
		this.results = [];
		if (isChangeType) {
			this.searchCtrl.value = undefined;
			PlatformUtility.focus(this.searchCtrl);
		}
		this.zone.run(() => this.changeDetector.detectChanges());
	}

	onCancel() {
		this.configSvc.navigateBackAsync();
	}

	onScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.pagination.PageNumber++;
			this.search(() => this.infiniteScrollCtrl.complete());
		}
		else {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	track(index: number, object: SearchResult) {
		return `${object.ID}@${index}`;
	}

	view(object: SearchResult) {
		if (object.OpenURI !== undefined) {
			this.configSvc.navigateForwardAsync(object.OpenURI);
		}
	}

	private prepareAdapters(adapters: Array<{ Name: string, Label: string, Searcher: (request: AppDataRequest, onSuccess: (data?: any) => void, onError: (data?: any) => void) => Subscription, Preparer: (data?: any) => Array<SearchResult>, FilterConditions: Array<{ [key: string]: any }> }>) {
		adapters.forEach(adapter => {
			this.adapters.set(adapter.Name, { Searcher: adapter.Searcher, Preparer: adapter.Preparer, FilterConditions: adapter.FilterConditions });
			this.types.insert({ Value: adapter.Name, Label: adapter.Label }, 0);
		});
		this.typeCtrl.value = this.types.first().Value;
		this.filterBy.And = AppUtility.clone(this.adapters.get(this.typeCtrl.value).FilterConditions);
	}

	private search(onNext?: () => void) {
		const time = new Date();
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}

		const adapter = this.adapters.get(this.typeCtrl.value);
		const request = AppPagination.buildRequest(this.filterBy, undefined, this.pagination);
		if (this.configSvc.isDebug) {
			console.log(`<Search>: Perform (${this.typeCtrl.value})`, request);
		}

		this.subscription = adapter.Searcher(request, (data?: any) => {
			const results = adapter.Preparer(data);
			this.pagination = AppPagination.getDefault(data);
			if (this.pagination !== undefined) {
				this.pageNumber++;
				this.pagination.PageNumber = this.pageNumber;
			}
			this.results.merge(results);
			this.zone.run(() => this.changeDetector.detectChanges());
			if (onNext !== undefined) {
				onNext();
			}
			if (this.configSvc.isDebug) {
				console.log(`<Search>: Done (${this.typeCtrl.value}) - Times: ${AppUtility.getElapsedTime(time)}`, this.pageNumber, data, results);
			}
		}, error => this.appFormsSvc.showErrorAsync(error));
	}
}

export interface SearchResult {
	ID: string;
	Title: string;
	Created: Date;
	LastModified: Date;
	Status: string;
	StartDate: Date;
	PublishedTime: Date;
	SubTitle: string;
	OpenURI: string;
	ThumbnailURI: string;
}
