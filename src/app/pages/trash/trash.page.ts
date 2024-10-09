import { Component, OnInit, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonInfiniteScroll } from "@ionic/angular";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { AppPagination } from "@app/components/app.pagination";
import { AppDataPagination, AppDataRequest } from "@app/components/app.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { TrashContent } from "@app/models/base";
import { UserProfile } from "@app/models/user";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";

@Component({
	selector: "page-trash-list",
	templateUrl: "./trash.page.html",
	styleUrls: ["./trash.page.scss"]
})

export class TrashPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	title = "Trashs";
	contents = new Array<TrashContent>();
	all = {
		value: false,
		label: "All organizations"
	};
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get isSystemAdministrator() {
		return this.authSvc.isSystemAdministrator();
	}

	get totalDisplays() {
		return this.pagination !== undefined ? AppPagination.computeTotal(this.pageNumber, this.pagination) : 0;
	}

	get totalRecords() {
		return this.pagination !== undefined ? this.pagination.TotalRecords : 0;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		const gotRights = this.isSystemAdministrator || this.portalsCoreSvc.canManageOrganization(this.portalsCoreSvc.activeOrganization);
		if (gotRights) {
			await this.appFormsSvc.showLoadingAsync();
			this.title = await this.configSvc.getResourceAsync("trash.list");
			this.all.label = await this.configSvc.getResourceAsync("trash.all");
			this.find(() => TrackingUtility.trackAsync({ title: this.title, category: "Trash", action: "List" }));
		}
		else {
			await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateBackAsync()
			]);
		}
	}

	track(index: number, content: TrashContent) {
		return `${content.ID}@${index}`;
	}

	onInfiniteScroll() {
		if (this.pagination !== undefined && this.pagination.PageNumber < this.pagination.TotalPages) {
			this.appFormsSvc.showLoadingAsync().then(() => this.find(this.infiniteScrollCtrl !== undefined ? () => this.infiniteScrollCtrl.complete() : () => {}));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	onAllOrganizationsChanged(event: any) {
		this.contents = [];
		this.all.value = event.detail.checked;
		this.appFormsSvc.showLoadingAsync().then(() => this.find());
	}

	private find(onNext?: () => void) {
		this.request = AppPagination.buildRequest(undefined, undefined, this.pagination);
		this.portalsCoreSvc.findTrashContentsAsync(
			this.request,
			this.all.value ? undefined : this.portalsCoreSvc.activeOrganization.ID,
			data => {
				if (this.configSvc.isDebug) {
					console.log("<Trash>: Find trash contents", data);
				}
				this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request);
				if (this.pagination !== undefined) {
					this.pageNumber++;
					this.pagination.PageNumber = this.pageNumber;
				}
				this.contents.merge(data.Objects, true, (object, array) => array.findIndex(item => item.ID === object.ID)).forEach(content => {
					content.Created = new Date(content.Created);
					if (content["Creator"] === undefined) {
						const profile = UserProfile.get(content.CreatedID);
						if (profile === undefined) {
							this.usersSvc.getProfileAsync(content.CreatedID, () => content["Creator"] = UserProfile.contains(content.CreatedID) ? UserProfile.get(content.CreatedID).Name : "Unknown");
						}
						else {
							content["Creator"] = profile.Name;
						}
					}
					if (content["Meta"] === undefined) {
						let contentType: ContentType;
						let module: Module;
						let organization: Organization;
						if (AppUtility.isNotEmpty(content.RepositoryEntityID)) {
							contentType = ContentType.get(content.RepositoryEntityID);
							if (contentType === undefined ) {
								this.portalsCoreSvc.getContentTypeAsync(content.RepositoryEntityID, () => {
									contentType = ContentType.get(content.RepositoryEntityID);
									module = Module.get(content.RepositoryID);
									organization = Organization.get(content.SystemID);
									this.updateMeta(content, contentType, module, organization);
								});
							}
							else {
								module = Module.get(content.RepositoryID);
								organization = Organization.get(content.SystemID);
							}
						}
						else if (AppUtility.isNotEmpty(content.RepositoryID)) {
							module = Module.get(content.RepositoryID);
							if (module === undefined ) {
								this.portalsCoreSvc.getModuleAsync(content.RepositoryID, () => {
									module = Module.get(content.RepositoryID);
									organization = Organization.get(content.SystemID);	
									this.updateMeta(content, contentType, module, organization);
								});
							}
							else {
								organization = Organization.get(content.SystemID);
							}
						}
						else if (AppUtility.isNotEmpty(content.SystemID)) {
							organization = Organization.get(content.SystemID);
							if (organization === undefined ) {
								this.portalsCoreSvc.getOrganizationAsync(content.SystemID, () => {
									organization = Organization.get(content.SystemID);
									this.updateMeta(content, contentType, module, organization);
								});
							}
						}
						if (contentType !== undefined || module !== undefined || organization !== undefined) {
							this.updateMeta(content, contentType, module, organization);
						}
					}
				});
				this.appFormsSvc.hideLoadingAsync(onNext);
			},
			error => this.appFormsSvc.showErrorAsync(error)
		);
	}

	private updateMeta(content: TrashContent, contentType?: ContentType, module?: Module, organization?: Organization) {
		let meta = "";
		if (contentType !== undefined) {
			meta = "# " + contentType.Title + (module === undefined ? "" : ` (${module.Title})`) + (organization !== undefined && this.all.value ? " @ " + organization.Title : "");
		}
		else if (module !== undefined) {
			meta = module.Title + (organization !== undefined && this.all.value ? " @ " + organization.Title : "");
		}
		else if (organization !== undefined && this.all.value) {
			meta = " @ " + organization.Title;
		}
		content["Meta"] = meta + (meta !== "" ? " - " : "");
	}

	async restoreAsync(content: TrashContent) {
		await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("trash.confirm", { title: content.Title }),
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("trash.processing"));
				await this.portalsCoreSvc.restoreAsync(content.ID, () => this.restoreSuccessAsync(content), error => {
					if ((error.Message || "").indexOf("Value cannot be null") > -1 ) {
						this.restoreSuccessAsync(content);
					}
					else {
						this.appFormsSvc.showErrorAsync(error);
					}
				});
			},
			"{{default}}",
			"{{default}}"
		);
	}

	private async restoreSuccessAsync(content: TrashContent) {
		const message = await this.configSvc.getResourceAsync("trash.done", { title: content.Title });
		await Promise.all([
			TrackingUtility.trackAsync({ title: this.title, category: "Trash", action: "Restore" }),
			this.appFormsSvc.showAlertAsync(undefined, message, undefined, () => this.contents.removeAt(this.contents.findIndex(cnt => cnt.ID == content.ID)))
		]);
	}

}
