import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment, AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Privileges } from "@app/models/privileges";
import { ModuleDefinition, EmailNotificationSettings } from "@app/models/portals.base";
import { Organization, Module, Desktop } from "@app/models/portals.core.all";
import { DesktopsSelectorModalPage } from "@app/controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@app/controls/portals/role.selector.modal.page";

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

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.modules.title.${(this.module !== undefined ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.organization = this.module !== undefined
			? Organization.get(this.module.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.module.SystemID, _ => this.organization = Organization.get(this.module.SystemID), undefined, true);
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

		this.module = this.module || new Module(this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.module.SystemID) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check"),
			this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.module.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.definitions = await this.portalsCoreSvc.getDefinitionsAsync();
		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		await this.trackAsync(this.title);
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
		this.portalsCoreSvc.addOrganizationControl(formConfig, "{{portals.modules.controls.Organization}}", this.organization);

		let control = formConfig.find(ctrl => ctrl.Name === "Title");
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => ctrl.Name === "Description");
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => ctrl.Name === "ModuleDefinitionID");
		if (AppUtility.isNotEmpty(this.module.ID)) {
			control.Hidden = true;
			formConfig.insert({
				Name: "ModuleDefinition",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.definitions.find(definition => definition.ID === this.module.ModuleDefinitionID).Title },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === "ModuleDefinitionID"));
		}
		else {
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

		control = formConfig.find(ctrl => ctrl.Name === "DesktopID");
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

		control = formConfig.find(ctrl => ctrl.Name === "Notifications");
		this.portalsCoreSvc.prepareNotificationsFormControl(control, this.emailsByApprovalStatus);

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.module.ID)) {
			control = formConfig.find(ctrl => ctrl.Name === "ID");
			control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
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
				const first = this.formControls.find(ctrl => ctrl.Name === "ModuleDefinitionID").Options.SelectOptions.Values[0];
				this.form.controls.ModuleDefinitionID.setValue(first.Value, { onlySelf: true });
				this.form.controls.Title.setValue(first.Label, { onlySelf: true });
				this.form.controls.Description.setValue(first.Description, { onlySelf: true });
				this.hash = AppCrypto.hash(this.form.value);
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
								this.trackAsync(this.title, "Update"),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.modules.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title, "Update"),
								this.appFormsSvc.showErrorAsync(error)
							]);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createModuleAsync(
						module,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Module", Type: "Created", ID: data.ID });
							await Promise.all([
								this.trackAsync(this.title),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.modules.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title),
								this.appFormsSvc.showErrorAsync(error)
							]);
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		const button = await this.configSvc.getResourceAsync("portals.modules.update.buttons.delete");
		await this.trackAsync(`${button} | Request`, "Delete");
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.modules.update.messages.confirm.delete"),
			undefined,
			() => AppUtility.invoke(async () => await this.removeAsync(), 123),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async removeAsync() {
		const button = await this.configSvc.getResourceAsync("portals.modules.update.buttons.delete");
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.modules.update.messages.confirm.delete"),
			await this.configSvc.getResourceAsync("portals.modules.update.messages.confirm.remove"),
			async () => {
				await this.appFormsSvc.showLoadingAsync(button);
				await this.portalsCoreSvc.deleteModuleAsync(
					this.module.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Module", Type: "Deleted", ID: data.ID });
						await Promise.all([
							this.trackAsync(`${button} | Success`, "Delete"),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.modules.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await Promise.all([
						this.appFormsSvc.showErrorAsync(error),
						this.trackAsync(`${button} | Error`, "Delete")
					])
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

	private async trackAsync(title: string, action?: string, category?: string) {
		await TrackingUtility.trackAsync({ title: title, category: category || "Module", action: action || (this.module !== undefined && AppUtility.isNotEmpty(this.module.ID) ? "Edit" : "Create") });
	}

}
