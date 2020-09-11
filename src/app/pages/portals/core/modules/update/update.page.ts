import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Privileges } from "@models/privileges";
import { ModuleDefinition, EmailNotificationSettings } from "@models/portals.base";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { Desktop } from "@models/portals.core.desktop";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@controls/portals/role.selector.modal.page";

@Component({
	selector: "page-portals-core-modules-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsModulesUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private module: Module;
	private organization: Organization;
	private definitions: Array<ModuleDefinition>;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private emailsByApprovalStatus = {} as { [status: string]: EmailNotificationSettings };
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
		save: "Save",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

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
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
			return;
		}

		this.module = this.module || new Module(this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.module.SystemID) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.modules.title.${(AppUtility.isNotEmpty(this.module.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.module.ID) ? "save" : "create")}`),
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
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "module");

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
			this.portalsCoreSvc.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, true, this.portalsCoreSvc.getNotificationInheritStates(this.module.Notifications)),
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
				this.portalsCoreSvc.getAuditFormControl(this.module, "basic"),
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Notifications"));
		this.portalsCoreSvc.prepareNotificationsFormControl(control, this.emailsByApprovalStatus);

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.module.ID)) {
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

	onFormInitialized() {
		const module = AppUtility.clone(this.module, false, ["Notifications", "EmailSettings"]);
		delete module["Privileges"];
		module.OriginalPrivileges = Privileges.clonePrivileges(this.module.OriginalPrivileges);
		module.Notifications = this.portalsCoreSvc.getNotificationSettings(this.module.Notifications, this.emailsByApprovalStatus);
		module.EmailSettings = this.portalsCoreSvc.getEmailSettings(this.module.EmailSettings);

		this.form.patchValue(module);
		this.hash = AppCrypto.hash(this.form.value);

		this.appFormsSvc.hideLoadingAsync(() => {
			if (!AppUtility.isNotEmpty(this.module.ID)) {
				const first = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ModuleDefinitionID")).Options.SelectOptions.Values[0];
				this.form.controls.ModuleDefinitionID.setValue(first.Value, { onlySelf: true });
				this.form.controls.Title.setValue(first.Label, { onlySelf: true });
				this.form.controls.Description.setValue(first.Description, { onlySelf: true });
				this.hash = AppCrypto.hash(this.form.value);
			}
			if (this.configSvc.isDebug) {
				console.log("<Portals>: Module", this.module);
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

				const module = this.form.value;
				module.OriginalPrivileges = Privileges.getPrivileges(module.OriginalPrivileges);
				this.portalsCoreSvc.normalizeNotificationSettings(module.Notifications, this.emailsByApprovalStatus);
				this.portalsCoreSvc.normalizeEmailSettings(module.EmailSettings);

				if (AppUtility.isNotEmpty(module.ID)) {
					await this.portalsCoreSvc.updateModuleAsync(
						module,
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
							await this.appFormsSvc.showErrorAsync(error);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createModuleAsync(
						module,
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
							await this.appFormsSvc.showErrorAsync(error);
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
					async error => await this.appFormsSvc.showErrorAsync(error)
				);
			},
			await this.configSvc.getResourceAsync("portals.modules.update.buttons.remove"),
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
				message || await this.configSvc.getResourceAsync(`portals.modules.update.messages.confirm.${AppUtility.isNotEmpty(this.module.ID) ? "cancel" : "new"}`),
				undefined,
				async () => await this.configSvc.navigateBackAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
	}

}
