import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService, FileOptions } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { AttachmentInfo } from "@app/models/base";
import { Organization, Site, Desktop } from "@app/models/portals.core.all";
import { DesktopsSelectorModalPage } from "@app/controls/portals/desktop.selector.modal.page";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";

@Component({
	selector: "page-portals-core-sites-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsSitesUpdatePage implements OnInit, OnDestroy {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private site: Site;
	private organization: Organization;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		save: "Save",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (AppUtility.isNotEmpty(this.site.ID)) {
			AppEvents.off(this.filesSvc.name, "Site:Refresh");
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.site = Site.get(this.configSvc.requestParams["ID"]);
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.sites.title.${this.site !== undefined ? "update" : "create"}`);

		this.organization = this.site !== undefined
			? Organization.get(this.site.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.site.SystemID, _ => this.organization = Organization.get(this.site.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await Promise.all([
				this.trackAsync(`${this.title} | No Permission`, "Check"),
				this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync("Hmmmmmm....")),
				this.configSvc.navigateBackAsync()
			]);
			return;
		}

		this.site = this.site || new Site(this.organization.ID, "");
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.site.SystemID) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check"),
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.site.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (!AppUtility.isNotEmpty(this.site.ID)) {
			this.site.Status = this.isSystemModerator ? "Published" : "Pending";
			this.site.SubDomain = "*";
			this.site.Language = this.configSvc.appConfig.language;
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		await this.trackAsync(this.title);

		if (AppUtility.isNotEmpty(this.site.ID)) {
			AppEvents.on(this.filesSvc.name, info => {
				if (info.args.Object === "Attachment" && this.site.ID === info.args.ObjectID) {
					this.prepareAttachments(undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
				}
			}, "Site:Refresh");
		}
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.sites.update.segments.basic")),
			new AppFormsSegment("display", await this.configSvc.getResourceAsync("portals.sites.update.segments.display")),
			new AppFormsSegment("seo", await this.configSvc.getResourceAsync("portals.sites.update.segments.seo"))
		];
		if (AppUtility.isNotEmpty(this.site.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "site");
		this.portalsCoreSvc.addOrganizationControl(formConfig, "{{portals.sites.controls.Organization}}", this.organization);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;
		if (!AppUtility.isNotEmpty(this.site.ID)) {
			control.Options.OnBlur = (_, formControl) => (this.form.controls.SEOInfo as FormGroup).controls.Description.setValue(formControl.value, { onlySelf: true });
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AlwaysUseHTTPs"));
		if (control !== undefined) {
			control.Options.Type = "toggle";
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AlwaysReturnHTTPs"));
		if (control !== undefined) {
			control.Options.Type = "toggle";
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		this.portalsCoreSvc.prepareApprovalStatusControl(control);
		if (!this.canModerateOrganization) {
			control.Options.Disabled = true;
		}

		await Promise.all([
			this.portalsCoreSvc.prepareLanguageControlAsync(formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Language")), true, false),
			this.portalsCoreSvc.prepareThemeControlAsync(formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Theme")))
		]);

		const homeDesktopCtrl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "HomeDesktopID"));
		const searchDesktopCtrl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SearchDesktopID"));
		homeDesktopCtrl.Options.LookupOptions = searchDesktopCtrl.Options.LookupOptions = {
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: DesktopsSelectorModalPage,
				ComponentProps: {
					multiple: false,
					organizationID: this.organization.ID
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						const desktop = Desktop.get(data[0]);
						formControl.setValue(desktop.ID);
						formControl.lookupDisplayValues = [{ Value: desktop.ID, Label: desktop.FullTitle }];
					}
				}
			}
		};

		let homeDesktop = Desktop.get(this.site.HomeDesktopID);
		if (homeDesktop === undefined && AppUtility.isNotEmpty(this.site.HomeDesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.site.HomeDesktopID, _ => homeDesktop = Desktop.get(this.site.HomeDesktopID), undefined, true);
		}
		homeDesktopCtrl.Extras = { LookupDisplayValues: homeDesktop !== undefined ? [{ Value: homeDesktop.ID, Label: homeDesktop.FullTitle }] : undefined };

		let searchDesktop = Desktop.get(this.site.SearchDesktopID);
		if (searchDesktop === undefined && AppUtility.isNotEmpty(this.site.SearchDesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.site.SearchDesktopID, _ => searchDesktop = Desktop.get(this.site.SearchDesktopID), undefined, true);
		}
		searchDesktopCtrl.Extras = { LookupDisplayValues: searchDesktop !== undefined ? [{ Value: searchDesktop.ID, Label: searchDesktop.FullTitle }] : undefined };

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UISettings"));
		control.Options.Label = control.Options.Label === undefined ? undefined : control.Options.Label.replace("portals.sites", "portals.common");
		control.Options.Description = control.Options.Description === undefined ? undefined : control.Options.Description.replace("portals.sites", "portals.common");
		control.Options.PlaceHolder = control.Options.PlaceHolder === undefined ? undefined : control.Options.PlaceHolder.replace("portals.sites", "portals.common");
		control.SubControls.Controls.forEach(ctrl => {
			ctrl.Options.Label = ctrl.Options.Label === undefined ? undefined : ctrl.Options.Label.replace("portals.sites", "portals.common");
			ctrl.Options.Description = ctrl.Options.Description === undefined ? undefined : ctrl.Options.Description.replace("portals.sites", "portals.common");
			ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder === undefined ? undefined : ctrl.Options.PlaceHolder.replace("portals.sites", "portals.common");
		});
		control.Options.Label = "{{portals.sites.controls.UISettings}}";

		const backgoundImageControl = control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		const iconControl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "IconURI"));
		const coverControl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CoverURI"));

		if (AppUtility.isNotEmpty(this.site.ID)) {
			backgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(this.site.UISettings, true) && AppUtility.isNotEmpty(this.site.UISettings.BackgroundImageURI) ? [{ Value: this.site.UISettings.BackgroundImageURI, Label: this.site.UISettings.BackgroundImageURI }] : undefined;
			iconControl.Extras.LookupDisplayValues = AppUtility.isNotEmpty(this.site.IconURI) ? [{ Value: this.site.IconURI, Label: this.site.IconURI }] : undefined;
			coverControl.Extras.LookupDisplayValues = AppUtility.isNotEmpty(this.site.CoverURI) ? [{ Value: this.site.CoverURI, Label: this.site.CoverURI }] : undefined;
			backgoundImageControl.Options.LookupOptions = iconControl.Options.LookupOptions = coverControl.Options.LookupOptions = {
				AsModal: true,
				Multiple: false,
				OnDelete: (_, formControl) => {
					formControl.setValue(undefined);
					formControl.lookupDisplayValues = undefined;
				},
				ModalOptions: {
					Component: FilesProcessorModalPage,
					ComponentProps: {
						mode: "select",
						fileOptions: this.fileOptions,
						allowSelect: true,
						multiple: false,
						handlers: { predicate: (attachment: AttachmentInfo) => attachment.isImage, onSelect: () => {} }
					},
					OnDismiss: (attachments: AttachmentInfo[], formControl: AppFormsControlComponent) => {
						const uri = attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined;
						if (uri !== undefined) {
							formControl.setValue(uri);
							formControl.lookupDisplayValues = [{ Value: uri, Label: uri }];
						}
						else {
							formControl.setValue(undefined);
							formControl.lookupDisplayValues = undefined;
						}
					}
				}
			};
		}
		else {
			backgoundImageControl.Options.Disabled = iconControl.Options.Disabled = coverControl.Options.Disabled = true;
		}

		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "MetaTags")).Options.Rows =
			formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ScriptLibraries")).Options.Rows = 5;
		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Stylesheets")).Options.Rows =
			formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Scripts")).Options.Rows = 15;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RedirectToNoneWWW"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UseInlineStylesheets"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UseInlineScripts"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SEOInfo"));
		control.SubControls.Controls.filter(ctrl => AppUtility.isEquals(ctrl.Type, "TextArea")).forEach(ctrl => ctrl.Options.Rows = 10);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.site.ID)) {
			formConfig.push(
				this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label"), false, true, true, FilesProcessorModalPage),
				this.portalsCoreSvc.getUploadFormControl(this.fileOptions, "attachments"),
				this.portalsCoreSvc.getAuditFormControl(this.site, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.sites.update.buttons.delete}}",
						OnClick: async () => await this.deleteAsync(),
						Options: {
							Fill: "clear",
							Color: "danger",
							Css: "ion-float-end",
							Icon: {
								Name: "trash",
								Slot: "start"
							}
						}
					}
				)
			);
		}
		else {
			control.Options.OnBlur = (_, formControl) => (this.form.controls.SEOInfo as FormGroup).controls.Title.setValue(formControl.value, { onlySelf: true });
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.site.ID)) {
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	private get fileOptions() {
		return {
			ServiceName: this.portalsCoreSvc.name,
			ObjectName: "Site",
			SystemID: this.organization.ID,
			RepositoryEntityID: this.site.getEntityInfo("Site"),
			ObjectID: this.site.ID,
			ObjectTitle: this.site.Title,
			IsShared: false,
			IsTracked: this.organization.TrackDownloadFiles,
			IsTemporary: false,
			Extras: {}
		} as FileOptions;
	}

	private prepareAttachments(attachments?: Array<AttachmentInfo>, addedOrUpdated?: AttachmentInfo, deleted?: AttachmentInfo, onCompleted?: (control: AppFormsControl) => void) {
		const formControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Attachments"));
		this.filesSvc.prepareAttachmentsFormControl(formControl, false, attachments, addedOrUpdated, deleted, onCompleted);
	}

	onFormInitialized() {
		const site = AppUtility.clone(this.site, false);
		site.Title = AppUtility.isNotEmpty(site.ID) ? site.Title : this.organization.Title;
		site.Theme = AppUtility.isNotEmpty(site.Theme) ? site.Theme : "-";
		site.UISettings = site.UISettings || {};
		this.form.patchValue(site);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(async () => {
			if (AppUtility.isNotEmpty(this.site.ID)) {
				await this.filesSvc.searchAttachmentsAsync(this.fileOptions, attachments => this.prepareAttachments(attachments));
				this.hash = AppCrypto.hash(this.form.value);
			}
		});
	}

	private async showErrorAsync(error: any) {
		const metaTagsAreInvalid = "MetaTagsAreInvalidException" === error.Type;
		const scriptsAreInvalid = "ScriptsAreInvalidException" === error.Type;
		const subHeader = metaTagsAreInvalid
			? await this.appFormsSvc.getResourceAsync("portals.common.errors.metaTags")
			: scriptsAreInvalid
				? await this.appFormsSvc.getResourceAsync("portals.common.errors.scripts")
				: undefined;
		await this.appFormsSvc.showErrorAsync(error, subHeader, () => {
			if (metaTagsAreInvalid || scriptsAreInvalid) {
				const control = metaTagsAreInvalid
					? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "MetaTags"))
					: this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Scripts"));
				this.formSegments.current = control.Segment;
				control.focus();
			}
		});
	}

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const site = this.form.value;
				site.Theme = AppUtility.isEquals(site.Theme, "-") ? undefined : site.Theme;
				delete site["Attachments"];

				if (AppUtility.isNotEmpty(site.ID)) {
					await this.portalsCoreSvc.updateSiteAsync(
						site,
						async _ => await Promise.all([
							this.trackAsync(this.title, "Update"),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.sites.update.messages.success.update")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title, "Update"),
								this.showErrorAsync(error)
							]);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createSiteAsync(
						site,
						async _ => await Promise.all([
							this.trackAsync(this.title),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.sites.update.messages.success.new")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title),
								this.showErrorAsync(error)
							]);
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		const button = await this.configSvc.getResourceAsync("portals.sites.update.buttons.delete");
		await this.trackAsync(button, "Delete");
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.sites.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(button);
				await this.portalsCoreSvc.deleteSiteAsync(
					this.site.ID,
					async _ => Promise.all([
						this.trackAsync(button, "Delete"),
						this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.sites.update.messages.success.delete")),
						this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
					]),
					async error => await Promise.all([
						this.appFormsSvc.showErrorAsync(error),
						this.trackAsync(button, "Delete")
					])
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
		if (message === undefined && this.hash === AppCrypto.hash(this.form.value)) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				message || await this.configSvc.getResourceAsync(`portals.sites.update.messages.confirm.${AppUtility.isNotEmpty(this.site.ID) ? "cancel" : "new"}`),
				undefined,
				async () => await this.configSvc.navigateBackAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
	}

	private async trackAsync(title: string, action?: string, category?: string) {
		await TrackingUtility.trackAsync({ title: title, category: category || "Site", action: action || (this.site !== undefined && AppUtility.isNotEmpty(this.site.ID) ? "Edit" : "Create") });
	}

}
