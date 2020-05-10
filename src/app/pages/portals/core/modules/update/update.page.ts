import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { UsersService } from "@services/users.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Privileges } from "@models/privileges";
import { Organization } from "@models/portals.core.organization";
import { ModuleDefinition } from "@models/portals.base";
import { Module } from "@models/portals.core.module";
import { Desktop } from "@models/portals.core.desktop";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@controls/portals/role.selector.modal.page";

@Component({
	selector: "page-portals-core-modules-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class ModulesUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private module: Module;
	private organization: Organization;
	private definitions: Array<ModuleDefinition>;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.module = Module.get(this.configSvc.requestParams["ID"]);

		this.organization = this.module !== undefined
			? Organization.get(this.module.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.module.SystemID, _ => this.organization = Organization.get(this.module.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (this.canModerateOrganization) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.module = this.module || new Module(this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.module.SystemID) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.modules.title.${(AppUtility.isNotEmpty(this.module.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.module.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.definitions = await this.portalsCoreSvc.getDefinitionsAsync();
		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.modules.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.modules.update.segments.privileges")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.modules.update.segments.notifications")),
			new AppFormsSegment("emails", await this.configSvc.getResourceAsync("portals.modules.update.segments.emails"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const trackings: Array<string> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "trackings");
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "module", "form-controls");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.organization.Title },
				Options: {
					Label: "{{portals.modules.controls.Organization}}",
					ReadOnly: true
				}
			},
			0
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ModuleDefinitionID"));
		if (AppUtility.isNotEmpty(this.module.ID)) {
			control.Hidden = true;
			AppUtility.insertAt(
				formConfig,
				{
					Name: "ModuleDefinition",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: this.definitions.find(definition => definition.ID === this.module.ModuleDefinitionID).Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => AppUtility.isEquals(ctrl.Name, "ModuleDefinitionID"))
			);
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.definitions.map(definition => {
				return {
					Value: definition.ID,
					Label: definition.Title,
					Description: definition.Description
				} as AppFormsLookupValue;
			});
			control.Options.OnChanged = (_, formControl) => {
				this.form.controls.Title.setValue(formControl.selectOptions.find(o => o.Value === formControl.value).Label, { onlySelf: true });
				this.form.controls.Description.setValue(formControl.selectOptions.find(o => o.Value === formControl.value).Description, { onlySelf: true });
			};
		}

		let desktop = Desktop.get(this.module.DesktopID);
		if (desktop === undefined && AppUtility.isNotEmpty(this.module.DesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.module.DesktopID, _ => desktop = Desktop.get(this.module.DesktopID), undefined, true);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "DesktopID"));
		control.Type = "Lookup";
		control.Extras = { LookupDisplayValues: desktop !== undefined ? [{ Value: desktop.ID, Label: desktop.FullTitle }] : undefined };
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
					organizationID: this.organization.ID
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						const selectedDesktop = Desktop.get(data[0]);
						formControl.setValue(selectedDesktop.ID);
						formControl.lookupDisplayValues = [{ Value: selectedDesktop.ID, Label: selectedDesktop.FullTitle }];
					}
				}
			}
		};

		const inheritEventsAndMethods = AppUtility.isNull(this.module.Notifications) || (AppUtility.isNull(this.module.Notifications.Events) && AppUtility.isNull(this.module.Notifications.Methods));
		const inheritEmailSettings = AppUtility.isNull(this.module.Notifications) || AppUtility.isNull(this.module.Notifications.Emails);
		const inheritWebHookSettings = AppUtility.isNull(this.module.Notifications) || AppUtility.isNull(this.module.Notifications.WebHooks);

		formConfig.push(
			{
				Name: "OriginalPrivileges",
				Type: "Custom",
				Segment: "privileges",
				Extras: { AllowInheritFromParent: true, RolesSelector: this.portalsCoreSvc.getRolesSelector(RolesSelectorModalPage, { organizationID: this.organization.ID }) },
				Options: {
					Type: "object-privileges"
				}
			},
			this.portalsCoreSvc.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, true, inheritEventsAndMethods, inheritEmailSettings, inheritWebHookSettings),
			{
				Name: "Trackings",
				Segment: "emails",
				Options: {
					Label: "{{portals.modules.controls.Trackings.label}}"
				},
				SubControls: {
					Controls: trackings.map(tracking => {
						return {
							Name: tracking,
							Options: {
								Label: `{{portals.modules.controls.Trackings.${tracking}.label}}`,
								Description: `{{portals.modules.controls.Trackings.${tracking}.description}}`
							}
						};
					})
				}
			},
			this.portalsCoreSvc.getEmailSettingsFormControl("EmailSettings", "emails", true, AppUtility.isNull(this.module.EmailSettings))
		);

		if (AppUtility.isNotEmpty(this.module.ID)) {
			formConfig.push(
				await this.usersSvc.getAuditFormControlAsync(this.module.Created, this.module.CreatedID, this.module.LastModified, this.module.LastModifiedID, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.modules.update.buttons.delete}}",
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

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	onFormInitialized() {
		const modul = AppUtility.clone(this.module, false);
		delete modul["Privileges"];
		modul.OriginalPrivileges = Privileges.clonePrivileges(this.module.OriginalPrivileges);
		modul.Notifications = modul.Notifications || {};
		modul.Notifications.InheritFromParent = AppUtility.isNull(this.module.Notifications) || (AppUtility.isNull(this.module.Notifications.Events) && AppUtility.isNull(this.module.Notifications.Methods));
		modul.Notifications.Emails = modul.Notifications.Emails || {};
		modul.Notifications.Emails.InheritFromParent = AppUtility.isNull(this.module.Notifications) || AppUtility.isNull(this.module.Notifications.Emails);
		modul.Notifications.WebHooks = modul.Notifications.WebHooks || {};
		modul.Notifications.WebHooks.InheritFromParent = AppUtility.isNull(this.module.Notifications) || AppUtility.isNull(this.module.Notifications.WebHooks);
		modul.EmailSettings = modul.EmailSettings || {};
		modul.EmailSettings.InheritFromParent = AppUtility.isNull(this.module.EmailSettings);
		modul.EmailSettings.Smtp = modul.EmailSettings.Smtp || { Port: 25, EnableSsl: false };

		this.form.patchValue(modul);
		this.hash = AppCrypto.hash(this.form.value);

		if (!AppUtility.isNotEmpty(this.module.ID)) {
			const first = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ModuleDefinitionID")).Options.SelectOptions.Values[0];
			this.form.controls.ModuleDefinitionID.setValue(first.Value, { onlySelf: true });
			this.form.controls.Title.setValue(first.Label, { onlySelf: true });
			this.form.controls.Description.setValue(first.Description, { onlySelf: true });
		}
		this.appFormsSvc.hideLoadingAsync();
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const modul = this.form.value;
				modul.OriginalPrivileges = Privileges.getPrivileges(modul.OriginalPrivileges);

				if (modul.Notifications && modul.Notifications.Emails && modul.Notifications.Emails.InheritFromParent) {
					modul.Notifications.Emails = undefined;
				}
				if (modul.Notifications && modul.Notifications.WebHooks && modul.Notifications.WebHooks.InheritFromParent) {
					modul.Notifications.WebHooks = undefined;
				}
				if (modul.EmailSettings && modul.EmailSettings.InheritFromParent) {
					modul.EmailSettings = undefined;
				}

				if (AppUtility.isNotEmpty(modul.ID)) {
					await this.portalsCoreSvc.updateModuleAsync(
						modul,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Module", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.modules.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCoreSvc.createModuleAsync(
						modul,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Module", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.modules.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.modules.update.messages.confirm.delete"),
			undefined,
			() => PlatformUtility.invoke(async () => await this.removeAsync(), 123),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async removeAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.modules.update.messages.confirm.delete"),
			await this.configSvc.getResourceAsync("portals.modules.update.messages.confirm.remove"),
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.modules.update.buttons.delete"));
				await this.portalsCoreSvc.deleteModuleAsync(
					this.module.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Module", Type: "Deleted", ID: data.ID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.modules.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.modules.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error))
				);
			},
			await this.configSvc.getResourceAsync("portals.modules.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.modules.update.messages.confirm.${AppUtility.isNotEmpty(this.module.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
