import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "../../../../../components/app.crypto";
import { AppEvents } from "../../../../../components/app.events";
import { AppUtility } from "../../../../../components/app.utility";
import { PlatformUtility } from "../../../../../components/app.utility.platform";
import { TrackingUtility } from "../../../../../components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsService } from "../../../../../components/forms.service";
import { ConfigurationService } from "../../../../../services/configuration.service";
import { AuthenticationService } from "../../../../../services/authentication.service";
import { UsersService } from "../../../../../services/users.service";
import { PortalsCoreService } from "../../../../../services/portals.core.service";
import { Organization } from "../../../../../models/portals.core.organization";
import { Role } from "../../../../../models/portals.core.role";
import { UserProfile } from "../../../../../models/user";
import { RolesSelectorModalPage } from "../../../../../controls/portals/role.selector.modal.page";
import { UsersSelectorModalPage } from "../../../../../controls/common/user.selector.modal.page";

@Component({
	selector: "page-portals-core-roles-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class RolesUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private organization = this.portalsCoreSvc.activeOrganization || new Organization();
	private role: Role;
	private hash = "";
	private users = new Array<{ Value: string; Label: string; Description?: string; Image?: string }>();

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
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
		this.role = Role.get(this.configSvc.requestParams["ID"]);
		this.organization = this.role !== undefined && this.role.SystemID !== this.organization.ID
			? Organization.get(this.role.SystemID)
			: this.organization;

		if (this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.roles.title.${(this.role === undefined ? "create" : "update")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(this.role === undefined ? "create" : "update")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.role === undefined) {
			this.role = new Role();
			this.role.SystemID = this.organization.ID;
		}
		else if (this.role.SystemID !== this.organization.ID) {
			this.organization = Organization.get(this.role.SystemID);
			if (this.organization === undefined) {
				await this.portalsCoreSvc.getOrganizationAsync(this.role.SystemID, _ => this.organization = Organization.get(this.role.SystemID), undefined, true);
			}
		}

		if (this.organization === undefined || this.organization.ID === "") {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.roles.list.invalid"));
			return;
		}

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

		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "role", "form-controls");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "TextBox",
				Options: {
					Label: "{{portals.roles.controls.Organization}}",
					ReadOnly: true
				},
			},
			0
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Type = "TextArea";
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID"));
		control.Hidden = false;
		control.Type = "Lookup";
		control.Options.LookupOptions = {
			AsCompleter: false,
			AsModal: true,
			ModalOptions: {
				Component: RolesSelectorModalPage,
				ComponentProps: {
					multiple: false,
					allowSystemRoles: false,
					organizationID: this.organization.ID,
					excludedIDs: this.role.ID === "" ? undefined : [this.role.ID]
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true)) {
						const role = Role.get(data[0]);
						formControl.setValue(role.ID);
						formControl.lookupDisplayValues = [{ Value: role.ID, Label: role.Title }];
					}
				}
			},
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			}
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UserIDs"));
		control.Hidden = false;
		control.Type = "Lookup";
		control.Extras = { ShowImage: true, ShowDescription: true, LookupDisplayValues: this.users };
		control.SubControls = control.Options.Label = undefined;
		control.Options.Description = "{{portals.roles.controls.UserIDs.description}}";
		control.Options.LookupOptions = {
			AsCompleter: false,
			AsSelector: true,
			SelectorOptions: {
				HeaderText: "{{portals.roles.controls.UserIDs.label}}",
				OnAdd: async formControl => await this.appFormsSvc.showModalAsync(UsersSelectorModalPage, { multiple: true }, async selected => {
					if (AppUtility.isArray(selected, true)) {
						const userIDs = formControl.lookupValues;
						(selected as Array<string>).filter(id => userIDs.indexOf(id) < 0).forEach(id => {
							userIDs.push(id);
							this.users.push({
								Value: id,
								Label: undefined as string,
								Description: undefined as string,
								Image: undefined as string
							});
						});
						await this.prepareUsersAsync();
						formControl.lookupValues = userIDs;
						formControl.lookupDisplayValues = this.users;
					}
				})
			},
			Multiple: true,
			WarningOnDelete: "{{portals.roles.controls.UserIDs.confirm}}",
			OnDelete: (selected, formControl) => {
				const userIDs = formControl.lookupValues;
				selected.forEach(id => {
					AppUtility.removeAt(userIDs, userIDs.indexOf(id));
					AppUtility.removeAt(this.users, this.users.findIndex(user => user.Value === id));
				});
				formControl.lookupValues = userIDs;
				formControl.lookupDisplayValues = this.users;
			}
		};

		this.formConfig = formConfig;
	}

	onFormInitialized() {
		const role = AppUtility.clone(this.role, false);
		role.Organization = this.organization.Title;
		this.form.patchValue(role);
		this.hash = AppCrypto.hash(this.form.value);
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
				const role = this.form.value;
				delete role["Organization"];
				if (AppUtility.isNotEmpty(role.ID)) {
					await this.portalsCoreSvc.updateRoleAsync(
						role,
						async () => {
							await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.roles.update.messages.success.update"));
							await this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync());
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCoreSvc.createRoleAsync(
						role,
						async () => {
							await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.roles.update.messages.success.new"));
							await this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync());
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

	async cancelAsync(message?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.roles.update.messages.confirm.${AppUtility.isNotEmpty(this.role.ID) ? "cancel" : "new"}`),
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	private async prepareUsersAsync() {
		const hideEmails = !this.authSvc.isSystemAdministrator();
		await Promise.all(this.users.filter(user => user.Label === undefined).map(async user => {
			let profile = UserProfile.get(user.Value);
			if (profile === undefined) {
				await this.usersSvc.getProfileAsync(user.Value, _ => profile = UserProfile.get(user.Value) || new UserProfile(), undefined, true);
			}
			user.Label = profile.Name;
			user.Description = profile.getEmail(hideEmails);
			user.Image = profile.avatarURI;
		}));
		this.users = this.users.sort(AppUtility.getCompareFunction("Label", "Description"));
	}

}
