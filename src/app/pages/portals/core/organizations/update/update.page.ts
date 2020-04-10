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
import { FilesService } from "../../../../../services/files.service";
import { PortalsCoreService } from "../../../../../services/portals.core.service";
import { UsersService } from "../../../../../services/users.service";
import { Organization } from "../../../../../models/portals.core.organization";
import { UserProfile } from "../../../../../models/user";
import { Privileges } from "../../../../../models/privileges";

@Component({
	selector: "page-portals-core-organizations-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class OrganizationsUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private filesSvc: FilesService,
		private portalsCoreSvc: PortalsCoreService,
		private usersSvc: UsersService
	) {
	}

	title = "";
	organization: Organization;

	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
	};
	formControls = new Array<AppFormsControl>();
	hash = "";
	processing = false;
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	private previousPrivileges: { [key: string]: Array<string> };

	ngOnInit() {
		this.organization = Organization.get(this.configSvc.requestParams["ID"]);
		const gotRights = this.organization === undefined
			? this.authSvc.isSystemAdministrator()
			: AppUtility.isEquals(this.organization.OwnerID, this.configSvc.getAccount().id) || this.authSvc.isAdministrator(this.portalsCoreSvc.name, "Organization", this.organization.Privileges);
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
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.organizations.title.${(this.organization === undefined ? "create" : "update")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(this.organization === undefined ? "create" : "update")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.organization === undefined) {
			this.organization = new Organization();
			this.organization.Privileges = new Privileges(true);
			this.organization.Notifications = {
				Events: [],
				Methods: [],
				WebHooks: {
					SignAlgorithm: "SHA256",
					SignatureAsHex: true,
					SignatureInQuery: false
				}
			};
			this.organization.RefreshUrls = { Interval: 15 };
			this.organization.RedirectUrls = { AllHttp404: false };
			this.organization.Emails = { Smtp: { Port: 25, EnableSsl: false } };
		}
		else {
			this.previousPrivileges = Privileges.getPrivileges(this.organization.Privileges);
			this.organization = Organization.deserialize(AppUtility.clone(this.organization));
			this.organization.Privileges = Privileges.resetPrivileges(undefined, this.previousPrivileges);
		}

		this.formSegments.items = await this.portalsCoreSvc.getOrganizationFormSegmentsAsync(this.organization);
		this.formConfig = await this.portalsCoreSvc.getOrganizationFormControlsAsync(this.organization, formConfig => {
			if (this.organization.ID === "") {
				formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title")).Options.OnBlur = (_, control) => {
					this.form.controls.Alias.setValue(AppUtility.toANSI(control.value, true).replace(/\-/g, ""));
					((this.form.controls.Notifications as FormGroup).controls.WebHooks as FormGroup).controls.SignKey.setValue(AppCrypto.md5(control.value));
				};
				formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias")).Options.OnBlur = (_, control) => {
					control.setValue(AppUtility.toANSI(control.value, true).replace(/\-/g, ""));
				};
			}
		});
	}

	onFormInitialized() {
		this.form.patchValue(this.organization);
		this.form.controls.ExpiredDate.setValue(AppUtility.toIsoDate(this.organization.ExpiredDate), { onlySelf: true });
		(this.form.controls.Others as FormGroup).controls.MetaTags.setValue(this.organization.MetaTags, { onlySelf: true });
		(this.form.controls.Others as FormGroup).controls.Scripts.setValue(this.organization.Scripts, { onlySelf: true });
		Organization.instructionElements.forEach(type => ((this.form.controls.Instructions as FormGroup).controls[type] as FormGroup).controls.Language.setValue(this.configSvc.appConfig.language, { onlySelf: true }));
		PlatformUtility.invoke(() => this.form.controls.OwnerID.setValue(this.organization.OwnerID, { onlySelf: true }), 234);

		const formValue = this.form.value;
		delete formValue.Emails["Buttons"];
		this.hash = AppCrypto.hash(formValue);
		this.appFormsSvc.hideLoadingAsync();
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			const organization = this.form.value;
			delete organization.Emails["Buttons"];
			Organization.instructionElements.forEach(type => {
				if (organization.Instructions[type]) {
					this.configSvc.appConfig.languages.forEach(language => {
						const instruction = organization.Instructions[type][language.Value];
						if (instruction === undefined || (!AppUtility.isNotEmpty(instruction.Subject) && !AppUtility.isNotEmpty(instruction.Body))) {
							delete organization.Instructions[type][language.Value];
						}
					});
				}
			});

			if (this.hash === AppCrypto.hash(organization)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				organization.ExpiredDate = this.form.value.ExpiredDate !== undefined ? AppUtility.toIsoDate(this.form.value.ExpiredDate).replace(/\-/g, "/") : "-";
				organization.MetaTags = this.form.value.Others.MetaTags;
				organization.Scripts = this.form.value.Others.Scripts;
				organization.OriginalPrivileges = Privileges.getPrivileges(this.organization.Privileges);

				delete organization["Others"];
				delete organization["Privileges"];

				if (AppUtility.isNotEmpty(organization.ID)) {
					await this.portalsCoreSvc.updateOrganizationAsync(
						organization,
						async () => {
							await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.organizations.update.messages.success.update"));
							await this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync());
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCoreSvc.createOrganizationAsync(
						organization,
						async () => {
							await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.organizations.update.messages.success.new"));
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
			await this.configSvc.getResourceAsync(`portals.organizations.update.messages.confirm.${AppUtility.isNotEmpty(this.organization.ID) ? "cancel" : "new"}`),
			async () => {
				this.organization = Organization.get(this.configSvc.requestParams["ID"]);
				if (this.organization !== undefined) {
					Privileges.resetPrivileges(this.organization.Privileges, this.previousPrivileges);
				}
				await this.configSvc.navigateBackAsync();
			},
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
