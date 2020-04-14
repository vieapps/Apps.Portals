import { Component, OnInit } from "@angular/core";
import { FormGroup, FormControl } from "@angular/forms";
import { AppCrypto } from "../../../../../components/app.crypto";
import { AppEvents } from "../../../../../components/app.events";
import { AppUtility } from "../../../../../components/app.utility";
import { PlatformUtility } from "../../../../../components/app.utility.platform";
import { TrackingUtility } from "../../../../../components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "../../../../../components/forms.service";
import { ConfigurationService } from "../../../../../services/configuration.service";
import { AuthenticationService } from "../../../../../services/authentication.service";
import { UsersService } from "../../../../../services/users.service";
import { PortalsCoreService } from "../../../../../services/portals.core.service";
import { Organization } from "../../../../../models/portals.core.organization";
import { Role } from "../../../../../models/portals.core.role";
import { Privileges } from "../../../../../models/privileges";

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
		this.role = Role.get(this.configSvc.requestParams["ID"]);
		const gotRights = this.role === undefined
			? this.authSvc.isSystemAdministrator()
			: AppUtility.isEquals(this.organization.OwnerID, this.configSvc.getAccount().id) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Role", this.organization.Privileges);
		if (!gotRights) {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]);
		}
		else {
			this.initializeFormAsync();
		}
	}

	async initializeFormAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.roles.title.${(this.role === undefined ? "create" : "update")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(this.role === undefined ? "create" : "update")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.role === undefined) {
			this.role = new Role();
		}

		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "role", "form-controls");
		this.formConfig = formConfig;
	}

	onFormInitialized() {
		const role = AppUtility.clone(this.role, false);
		this.hash = AppCrypto.hash(role);
		this.form.patchValue(role);
		this.appFormsSvc.hideLoadingAsync();
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			const role = this.form.value;

			if (this.hash === AppCrypto.hash(role)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);
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

	async cancelAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			undefined,
			await this.configSvc.getResourceAsync(`portals.roles.update.messages.confirm.${AppUtility.isNotEmpty(this.role.ID) ? "cancel" : "new"}`),
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
