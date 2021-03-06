import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsService, AppFormsLookupValue } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { UsersService } from "@app/services/users.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { UserProfile } from "@app/models/user";
import { Organization, Role } from "@app/models/portals.core.all";
import { RolesSelectorModalPage } from "@app/controls/portals/role.selector.modal.page";
import { UsersSelectorModalPage } from "@app/controls/common/user.selector.modal.page";

@Component({
	selector: "page-portals-core-roles-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsRolesUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private role: Role;
	private organization: Organization;
	private canModerateOrganization = false;
	private users = new Array<AppFormsLookupValue>();
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
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
		await this.appFormsSvc.showLoadingAsync();
		this.role = Role.get(this.configSvc.requestParams["ID"]);

		this.organization = this.role !== undefined
			? Organization.get(this.role.SystemID)
			: this.portalsCoreSvc.activeOrganization;

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.role.SystemID, _ => this.organization = Organization.get(this.role.SystemID), undefined, true);
		}

		this.canModerateOrganization = this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
		}

		this.role = this.role || new Role(this.organization.ID, "", this.configSvc.requestParams["ParentID"]);
		if (this.organization === undefined || !AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.role.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.roles.title.${(AppUtility.isNotEmpty(this.role.ID) ? "update" : "create")}`);
		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.role.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.role.UserIDs !== undefined && this.role.UserIDs.length > 0) {
			this.users = this.role.UserIDs.map(id => {
				return {
					Value: id,
					Label: undefined as string,
					Description: undefined as string,
					Image: undefined as string
				};
			});
			await this.prepareUsersAsync();
		}

		this.formConfig = await this.getFormControlsAsync();

		if (AppUtility.isNotEmpty(this.role.ID) && this.role.childrenIDs === undefined) {
			this.portalsCoreSvc.refreshRoleAsync(this.role.ID, async _ => await this.appFormsSvc.showToastAsync("The role was freshen-up"));
		}
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "role");
		this.portalsCoreSvc.addOrganizationControl(formConfig, "{{portals.roles.controls.Organization}}");

		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title")).Options.AutoFocus = true;

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Type = "TextArea";
		control.Options.Rows = 2;

		const parentRole = this.role.Parent;
		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID"));
		control.Type = "Lookup";
		control.Required = false;
		control.Extras = { LookupDisplayValues: parentRole !== undefined ? [{ Value: parentRole.ID, Label: parentRole.FullTitle }] : undefined };
		control.Options.LookupOptions = {
			AsModal: true,
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: RolesSelectorModalPage,
				ComponentProps: {
					multiple: false,
					allowSystemRoles: false,
					organizationID: this.organization.ID,
					excludedIDs: this.role.ID === "" ? undefined : [this.role.ID]
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						const role = Role.get(data[0]);
						formControl.setValue(role.ID);
						formControl.lookupDisplayValues = [{ Value: role.ID, Label: role.FullTitle }];
					}
				}
			}
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UserIDs"));
		control.Type = "Lookup";
		control.Extras = {
			Settings: {
				ShowImage: true,
				ShowDescription: true, DescriptionAtRight: true
			},
			LookupDisplayValues: this.users
		};
		control.SubControls = control.Options.Label = undefined;
		control.Options.Description = "{{portals.roles.controls.UserIDs.description}}";
		control.Options.LookupOptions = {
			AsModal: false,
			AsSelector: true,
			Multiple: true,
			WarningOnDelete: "{{portals.roles.controls.UserIDs.confirm}}",
			OnDelete: (selected, formControl) => {
				const users = formControl.lookupValues;
				selected.forEach(id => {
					users.remove(id);
					this.users.removeAt(this.users.findIndex(user => user.Value === id));
				});
				formControl.lookupValues = users;
				formControl.lookupDisplayValues = this.users;
			},
			SelectorOptions: {
				HeaderText: "{{portals.roles.controls.UserIDs.label}}",
				OnAdd: async formControl => await this.appFormsSvc.showModalAsync(UsersSelectorModalPage, { multiple: true }, async selected => {
					if (AppUtility.isArray(selected, true)) {
						const users = formControl.lookupValues;
						(selected as Array<string>).except(users).forEach(id => {
							users.push(id);
							this.users.push({
								Value: id,
								Label: undefined as string,
								Description: undefined as string,
								Image: undefined as string
							});
						});
						await this.prepareUsersAsync();
						formControl.lookupValues = users;
						formControl.lookupDisplayValues = this.users;
					}
				})
			}
		};

		if (AppUtility.isNotEmpty(this.role.ID)) {
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.role),
				this.appFormsSvc.getButtonControls(
					undefined,
					{
						Name: "Delete",
						Label: "{{portals.roles.update.buttons.delete}}",
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
		if (AppUtility.isNotEmpty(this.role.ID)) {
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

	private async prepareUsersAsync() {
		await Promise.all(this.users.filter(user => user.Label === undefined).map(async user => {
			let profile = UserProfile.get(user.Value);
			if (profile === undefined) {
				await this.usersSvc.getProfileAsync(user.Value, _ => profile = UserProfile.get(user.Value) || new UserProfile(), undefined, true);
			}
			user.Label = profile.Name;
			user.Description = profile.getEmail(!this.canModerateOrganization);
			user.Image = profile.avatarURI;
		}));
		this.users = this.users.sortBy("Label", "Description");
	}

	onFormInitialized() {
		this.form.patchValue(this.role);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync();
		if (this.configSvc.isDebug) {
			console.log("<Portals>: Role", this.role);
		}
	}

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);
				const role = this.form.value;
				if (AppUtility.isNotEmpty(role.ID)) {
					const oldParentID = this.role.ParentID;
					await this.portalsCoreSvc.updateRoleAsync(
						role,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Role", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							if (oldParentID !== data.ParentID) {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Role", Type: "Updated", ID: oldParentID });
							}
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.roles.update.messages.success.update")),
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
					await this.portalsCoreSvc.createRoleAsync(
						role,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Role", Type: "Created", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.roles.update.messages.success.new")),
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
		const modes = [
			{
				label: await this.configSvc.getResourceAsync("portals.roles.update.buttons.delete-all"),
				value: "delete"
			},
			{
				label: await this.configSvc.getResourceAsync("portals.roles.update.buttons.set-null-all"),
				value: "set-null"
			}
		];
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.roles.update.messages.confirm.delete"),
			this.role.childrenIDs === undefined || this.role.childrenIDs.length < 1 ? undefined : await this.configSvc.getResourceAsync("portals.roles.update.messages.mode"),
			async mode => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.roles.update.buttons.delete"));
				await this.portalsCoreSvc.deleteRoleAsync(
					this.role.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Role", Type: "Deleted", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.roles.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.roles.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.showErrorAsync(error),
					{ "x-children": mode }
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			this.role.childrenIDs === undefined || this.role.childrenIDs.length < 1 ? undefined : modes.map(mode => {
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
		if (message === undefined && this.hash === AppCrypto.hash(this.form.value)) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				message || await this.configSvc.getResourceAsync(`portals.roles.update.messages.confirm.${AppUtility.isNotEmpty(this.role.ID) ? "cancel" : "new"}`),
				undefined,
				async () => await this.configSvc.navigateBackAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
	}

}
