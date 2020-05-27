import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { AppFormsControlComponent } from "@components/forms.control.component";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { FilesService, FileOptions } from "@services/files.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { AttachmentInfo } from "@models/base";
import { Organization } from "@models/portals.core.organization";
import { Site } from "@models/portals.core.site";
import { Desktop } from "@models/portals.core.desktop";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { FilesProcessorModalPage } from "@controls/common/file.processor.modal.page";

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
		update: "Update",
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
		this.site = Site.get(this.configSvc.requestParams["ID"]);

		this.organization = this.site !== undefined
			? Organization.get(this.site.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.site.SystemID, _ => this.organization = Organization.get(this.site.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
			return;
		}

		this.site = this.site || new Site(this.organization.ID, "");
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.sites.title.${(AppUtility.isNotEmpty(this.site.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.site.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.site.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (!AppUtility.isNotEmpty(this.site.ID)) {
			this.site.Status = this.isSystemModerator ? "Published" : "Pending";
			this.site.SubDomain = "*";
			this.site.Language = this.configSvc.appConfig.language;
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();

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

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.organization.Title },
				Options: {
					Label: "{{portals.sites.controls.Organization}}",
					ReadOnly: true
				}
			},
			0
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;
		if (!AppUtility.isNotEmpty(this.site.ID)) {
			control.Options.OnBlur = (_, formControl) => (this.form.controls.SEOInfo as FormGroup).controls.Description.setValue(formControl.value, { onlySelf: true });
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AlwaysUseHTTPs"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		control.Options.SelectOptions.Interface = "popover";
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
		}
		if (!this.canModerateOrganization) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Language"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = this.configSvc.languages.map(language => {
			return { Value: language.Value, Label: language.Label };
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Theme"));
		control.Options.Type = "dropdown";
		control.Options.SelectOptions.Values = (await this.portalsCoreSvc.getThemesAsync()).map(theme => {
			return { Value: theme.name, Label: theme.name };
		});
		AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: await this.configSvc.getResourceAsync("portals.common.unspecified") }, 0);

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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "MetaTags"));
		control.Options.Rows = 10;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Scripts"));
		control.Options.Rows = 15;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RedirectToNoneWWW"));
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
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	private get fileOptions() {
		return {
			ServiceName: this.portalsCoreSvc.name,
			ObjectName: "Organization",
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
		if (!AppUtility.isNotEmpty(this.site.ID)) {
			site.Title = this.organization.Title;
		}
		this.form.patchValue(site);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(async () => await this.filesSvc.searchAttachmentsAsync(this.fileOptions, attachments => this.prepareAttachments(attachments)));
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

	async updateAsync() {
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
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Site", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.sites.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.showErrorAsync(error);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createSiteAsync(
						site,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Site", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.sites.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.showErrorAsync(error);
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.sites.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.sites.update.buttons.delete"));
				await this.portalsCoreSvc.deleteSiteAsync(
					this.site.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Site", Type: "Deleted", ID: data.ID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.sites.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.sites.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.showErrorAsync(error)
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
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
