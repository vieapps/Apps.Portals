import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { AppFormsControlComponent } from "@components/forms.control.component";
import { ConfigurationService } from "@services/configuration.service";
import { FilesService, FileOptions } from "@services/files.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { AttachmentInfo } from "@models/base";
import { Organization } from "@models/portals.core.organization";
import { Desktop } from "@models/portals.core.desktop";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { FilesProcessorModalPage } from "@controls/common/file.processor.modal.page";

@Component({
	selector: "page-portals-core-desktops-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsDesktopsUpdatePage implements OnInit, OnDestroy {
	constructor(
		private configSvc: ConfigurationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private desktop: Desktop;
	private organization: Organization;
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
		if (AppUtility.isNotEmpty(this.desktop.ID)) {
			AppEvents.off(this.filesSvc.name, "Desktop:Refresh");
		}
	}

	private async initializeAsync() {
		this.desktop = Desktop.get(this.configSvc.requestParams["ID"]);

		this.organization = this.desktop !== undefined
			? Organization.get(this.desktop.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.desktop.SystemID, _ => this.organization = Organization.get(this.desktop.SystemID), undefined, true);
		}

		this.canModerateOrganization = this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}

		this.desktop = this.desktop || new Desktop(this.organization.ID, "", this.configSvc.requestParams["ParentID"]);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.desktop.SystemID) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.desktops.title.${(AppUtility.isNotEmpty(this.desktop.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.desktop.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (!AppUtility.isNotEmpty(this.desktop.ID)) {
			this.desktop.SEOSettings = { SEOInfo: { Title: undefined as string } };
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();

		if (AppUtility.isNotEmpty(this.desktop.ID)) {
			AppEvents.on(this.filesSvc.name, info => {
				if (info.args.Object === "Attachment" && this.desktop.ID === info.args.ObjectID) {
					this.prepareAttachments(undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
				}
			}, "Desktop:Refresh");
		}
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.desktops.update.segments.basic")),
			new AppFormsSegment("display", await this.configSvc.getResourceAsync("portals.desktops.update.segments.display")),
			new AppFormsSegment("seo", await this.configSvc.getResourceAsync("portals.desktops.update.segments.seo"))
		];
		if (AppUtility.isNotEmpty(this.desktop.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "desktop");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.organization.Title },
				Options: {
					Label: "{{portals.desktops.controls.Organization}}",
					ReadOnly: true
				}
			},
			0
		);

		if (!AppUtility.isNotEmpty(this.desktop.ID)) {
			AppUtility.insertAt(
				formConfig,
				{
					Name: "CopyFromID",
					Type: "Lookup",
					Segment: "basic",
					Options: {
						Label: "{{portals.desktops.controls.CopyFromID.label}}",
						Description: "{{portals.desktops.controls.CopyFromID.description}}"
					}
				},
				1
			);
		}

		const parentDesktop = this.desktop.Parent;
		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID"));
		control.Extras.LookupDisplayValues = parentDesktop !== undefined ? [{ Value: parentDesktop.ID, Label: parentDesktop.FullTitle }] : undefined ;
		control.Options.LookupOptions = {
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: DesktopsSelectorModalPage,
				ComponentProps: {
					multiple: false,
					organizationID: this.organization.ID,
					excludedIDs: AppUtility.isNotEmpty(this.desktop.ID) ? [this.desktop.ID] : undefined
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CopyFromID"));
		if (control !== undefined) {
			control.Options.LookupOptions = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID")).Options.LookupOptions;
		}

		const unspecified = await this.configSvc.getResourceAsync("portals.common.unspecified");

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Language"));
		control.Required = false;
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = this.configSvc.languages.map(language => {
			return { Value: language.Value, Label: language.Label };
		});
		AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: unspecified }, 0);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Theme"));
		control.Options.Type = "dropdown";
		control.Options.SelectOptions.Values = (await this.portalsCoreSvc.getThemesAsync()).map(theme => {
			return { Value: theme.name, Label: theme.name };
		});
		AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: unspecified }, 0);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: (event, formControl) => console.warn("Click icon to generate the template", event, formControl)
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UISettings"));
		control.Options.Label = control.Options.Label === undefined ? undefined : control.Options.Label.replace("portals.desktops", "portals.common");
		control.Options.Description = control.Options.Description === undefined ? undefined : control.Options.Description.replace("portals.desktops", "portals.common");
		control.Options.PlaceHolder = control.Options.PlaceHolder === undefined ? undefined : control.Options.PlaceHolder.replace("portals.desktops", "portals.common");
		control.SubControls.Controls.forEach(ctrl => {
			ctrl.Options.Label = ctrl.Options.Label === undefined ? undefined : ctrl.Options.Label.replace("portals.desktops", "portals.common");
			ctrl.Options.Description = ctrl.Options.Description === undefined ? undefined : ctrl.Options.Description.replace("portals.desktops", "portals.common");
			ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder === undefined ? undefined : ctrl.Options.PlaceHolder.replace("portals.desktops", "portals.common");
		});

		const backgoundImageControl = control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI"));
		const iconControl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "IconURI"));
		const coverControl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CoverURI"));

		if (AppUtility.isNotEmpty(this.desktop.ID)) {
			backgoundImageControl.Extras.LookupDisplayValues = AppUtility.isObject(this.desktop.UISettings, true) && AppUtility.isNotEmpty(this.desktop.UISettings.BackgroundImageURI) ? [{ Value: this.desktop.UISettings.BackgroundImageURI, Label: this.desktop.UISettings.BackgroundImageURI }] : undefined;
			iconControl.Extras.LookupDisplayValues = AppUtility.isNotEmpty(this.desktop.IconURI) ? [{ Value: this.desktop.IconURI, Label: this.desktop.IconURI }] : undefined;
			coverControl.Extras.LookupDisplayValues = AppUtility.isNotEmpty(this.desktop.CoverURI) ? [{ Value: this.desktop.CoverURI, Label: this.desktop.CoverURI }] : undefined;
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SEOSettings"));
		const seo = (AppUtility.toArray(control.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "TitleMode")).Options.SelectOptions.Values) as Array<string>).map(value => {
			return { Value: value, Label: `{{portals.desktops.update.seo.${value}}}` };
		});
		await Promise.all(seo.map(async s => s.Label = await this.appFormsSvc.getResourceAsync(s.Label)));
		AppUtility.insertAt(seo, { Value: "-", Label: unspecified }, 0);
		control.SubControls.Controls.filter(ctrl => ctrl.Type === "Select").forEach(ctrl => ctrl.Options.SelectOptions.Values = seo);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.desktop.ID)) {
			formConfig.push(
				this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label"), false, true, true, FilesProcessorModalPage),
				this.portalsCoreSvc.getUploadFormControl(this.fileOptions, "attachments"),
				this.portalsCoreSvc.getAuditFormControl(this.desktop, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.desktops.update.buttons.delete}}",
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
			control.Options.OnBlur = (_, formControl) => {
				this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
				((this.form.controls.SEOSettings as FormGroup).controls.SEOInfo as FormGroup).controls.Title.setValue(formControl.value, { onlySelf: true });
			};
		}

		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias")).Options.OnBlur = (_, formControl) => formControl.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Aliases")).Options.OnBlur = (_, formControl) => {
			const aliases = AppUtility.isNotEmpty(formControl.value)
				? AppUtility.toStr((AppUtility.toArray(formControl.value, ";") as string[]).map(alias => AppUtility.toANSI(alias, true)), ";")
				: undefined;
			formControl.setValue(aliases, { onlySelf: true });
		};

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.desktop.ID)) {
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
			ObjectName: "Organization",
			SystemID: this.organization.ID,
			RepositoryEntityID: this.desktop.getEntityInfo("Desktop"),
			ObjectID: this.desktop.ID,
			ObjectTitle: this.desktop.Title,
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
		const desktop = AppUtility.clone(this.desktop, false);
		desktop.Language = AppUtility.isNotEmpty(desktop.Language) ? desktop.Language : "-";
		desktop.SEOSettings = desktop.SEOSettings || {};
		this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "SEOSettings")).SubControls.Controls.filter(ctrl => ctrl.Type === "Select").forEach(ctrl => {
			const value = desktop.SEOSettings[ctrl.Name];
			desktop.SEOSettings[ctrl.Name] = AppUtility.isNotEmpty(value) ? value : "-";
		});
		this.form.patchValue(desktop);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(async () => await this.filesSvc.searchAttachmentsAsync(this.fileOptions, attachments => this.prepareAttachments(attachments)));
	}

	private async showErrorAsync(error: any) {
		const aliasIsExisted = "AliasIsExistedException" === error.Type;
		const templateIsInvalid = "TemplateIsInvalidException" === error.Type;
		const metaTagsAreInvalid = "MetaTagsAreInvalidException" === error.Type;
		const scriptsAreInvalid = "ScriptsAreInvalidException" === error.Type;
		const details = AppUtility.isNotEmpty(error.Message) ? error.Message as string : "";
		const subHeader = aliasIsExisted
			? await this.appFormsSvc.getResourceAsync("portals.common.errors.alias.desktop")
			: templateIsInvalid
				? details.indexOf("no zone") > 0
					? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.desktop.noZone")
					: details.indexOf("but has no value") > 0
						? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.desktop.zoneNoID")
						: details.indexOf("by another zone") > 0
							? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.desktop.zoneExisted")
							: details.indexOf("required a zone") > 0
								? await this.appFormsSvc.getResourceAsync("portals.common.errors.template.desktop.required")
								: await this.appFormsSvc.getResourceAsync("portals.common.errors.template.desktop.invalid")
				: metaTagsAreInvalid
					? await this.appFormsSvc.getResourceAsync("portals.common.errors.metaTags")
					: scriptsAreInvalid
						? await this.appFormsSvc.getResourceAsync("portals.common.errors.scripts")
						: undefined;
		await this.appFormsSvc.showErrorAsync(error, subHeader, () => {
			if (aliasIsExisted) {
				const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias"));
				this.formSegments.current = control.Segment;
				control.focus();
			}
			else if (templateIsInvalid || metaTagsAreInvalid || scriptsAreInvalid) {
				const control = metaTagsAreInvalid
					? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "MetaTags"))
					: scriptsAreInvalid
						? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Scripts"))
						: this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
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

				const desktop = this.form.value;
				desktop.Language = AppUtility.isEquals(desktop.Language, "-") ? undefined : desktop.Language;
				desktop.Theme = AppUtility.isEquals(desktop.Theme, "-") ? undefined : desktop.Theme;
				this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "SEOSettings")).SubControls.Controls.filter(ctrl => ctrl.Type === "Select").forEach(ctrl => {
					const value = desktop.SEOSettings[ctrl.Name];
					desktop.SEOSettings[ctrl.Name] = AppUtility.isEquals(value, "-") ? undefined : value;
				});
				delete desktop["Attachments"];

				if (AppUtility.isNotEmpty(desktop.ID)) {
					const oldParentID = this.desktop.ParentID;
					await this.portalsCoreSvc.updateDesktopAsync(
						desktop,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Desktop", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							if (oldParentID !== data.ParentID) {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Desktop", Type: "Updated", ID: oldParentID });
							}
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.desktops.update.messages.success.update")),
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
					await this.portalsCoreSvc.createDesktopAsync(
						desktop,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Desktop", Type: "Created", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.desktops.update.messages.success.new")),
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
		const modes = [
			{
				label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete-all"),
				value: "delete"
			},
			{
				label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.set-null-all"),
				value: "set-null"
			}
		];
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.desktops.update.messages.confirm.delete"),
			this.desktop.childrenIDs === undefined || this.desktop.childrenIDs.length < 1 ? undefined : await this.configSvc.getResourceAsync("portals.desktops.update.messages.mode"),
			async mode => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete"));
				await this.portalsCoreSvc.deleteDesktopAsync(
					this.desktop.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Desktop", Type: "Deleted", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.desktops.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.showErrorAsync(error),
					{ "x-children": mode }
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			this.desktop.childrenIDs === undefined || this.desktop.childrenIDs.length < 1 ? undefined : modes.map(mode => {
				return {
					type: "radio",
					label: mode.label,
					value: mode.value,
					checked: mode.value === "delete"
				};
			})
		);
	}

	async cancelAsync(message?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.desktops.update.messages.confirm.${AppUtility.isNotEmpty(this.desktop.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
