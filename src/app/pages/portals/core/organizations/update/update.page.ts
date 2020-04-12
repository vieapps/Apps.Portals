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

	private organization: Organization;
	private hash = "";
	private instructions = {} as {
		[type: string]: {
			[language: string]: {
				Subject?: string;
				Body?: string;
			}
		}
	};

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
					EndpointURLs: [],
					SignAlgorithm: "SHA256",
					SignatureAsHex: true,
					SignatureInQuery: false
				}
			};
			this.organization.RefreshUrls = { Addresses: [], Interval: 15 };
			this.organization.RedirectUrls = { Addresses: [], AllHttp404: false };
			this.organization.EmailSettings = { Smtp: { Port: 25, EnableSsl: false } };
		}

		this.formSegments.items = await this.portalsCoreSvc.getOrganizationFormSegmentsAsync(this.organization);
		this.formConfig = await this.portalsCoreSvc.getOrganizationFormControlsAsync(this.organization, formConfig => {
			if (this.organization.ID === "") {
				formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title")).Options.OnBlur = (_, control) => {
					this.form.controls.Alias.setValue(AppUtility.toANSI(control.value, true).replace(/\-/g, ""), { onlySelf: true });
					((this.form.controls.Notifications as FormGroup).controls.WebHooks as FormGroup).controls.SignKey.setValue(AppCrypto.md5(control.value), { onlySelf: true });
				};
				formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias")).Options.OnBlur = (_, control) => {
					control.setValue(AppUtility.toANSI(control.value, true).replace(/\-/g, ""), { onlySelf: true });
				};
			}
			const instructionControls = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Instructions")).SubControls.Controls;
			Organization.instructionElements.forEach(type => {
				const controls = instructionControls.find(ctrl => AppUtility.isEquals(ctrl.Name, type)).SubControls.Controls;
				controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Language")).Options.OnChanged = (event, formControl) => {
					this.instructions[formControl.parentControl.Name] = this.instructions[formControl.parentControl.Name] || {};
					const instruction = this.instructions[formControl.parentControl.Name][event.detail.value] || {};
					formControl.formGroup.controls.Subject.setValue(instruction.Subject, { onlySelf: true });
					formControl.formGroup.controls.Body.setValue(instruction.Body, { onlySelf: true });
					formControl.parentControl.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Subject")).focus();
				};
				controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Subject")).Options.OnBlur = (_, formControl) => this.instructions[formControl.parentControl.Name][formControl.formGroup.controls.Language.value] = { Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
				controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Body")).Options.OnBlur = (_, formControl) => this.instructions[formControl.parentControl.Name][formControl.formGroup.controls.Language.value] = { Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
			});
		});
	}

	onFormInitialized() {
		const privileges = Privileges.getPrivileges(this.organization.Privileges);
		const organization = AppUtility.clone(this.organization, ["MetaTags", "Scripts"]);
		organization.Privileges = Privileges.resetPrivileges(undefined, privileges);
		organization.ExpiredDate = AppUtility.toIsoDate(this.organization.ExpiredDate);
		organization.Notifications.WebHooks.EndpointURLs = AppUtility.toStr(this.organization.Notifications.WebHooks.EndpointURLs.filter(value => AppUtility.isNotEmpty(value)), "\n");
		organization.Others = { MetaTags: this.organization.MetaTags, Scripts: this.organization.Scripts };
		organization.RefreshUrls.Addresses = AppUtility.toStr(this.organization.RefreshUrls.Addresses, "\n");
		organization.RedirectUrls.Addresses = AppUtility.toStr(this.organization.RedirectUrls.Addresses, "\n");

		this.instructions = organization.Instructions;
		Organization.instructionElements.forEach(type => {
			this.instructions[type] = this.instructions[type] || {};
			this.configSvc.appConfig.languages.map(language => language.Value).forEach(language => {
				this.instructions[type][language] = this.instructions[type][language] || { Subject: undefined as string, Body: undefined as string };
			});
		});
		this.hash = AppCrypto.hash(organization);

		organization.Instructions = {};
		Organization.instructionElements.forEach(type => {
			const instruction = this.instructions[type][this.configSvc.appConfig.language];
			organization.Instructions[type] = {
				Language: this.configSvc.appConfig.language,
				Subject: instruction.Subject,
				Body: instruction.Body
			};
		});
		this.form.patchValue(organization);
		this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.invoke(() => this.form.controls.OwnerID.setValue(organization.OwnerID, { onlySelf: true }), 234));
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			const organization = this.form.value;
			organization.Instructions = this.instructions;
			delete organization.EmailSettings["Buttons"];

			if (this.hash === AppCrypto.hash(organization)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				organization.ExpiredDate = organization.ExpiredDate !== undefined ? AppUtility.toIsoDate(organization.ExpiredDate).replace(/\-/g, "/") : "-";
				organization.Notifications.WebHooks.EndpointURLs = AppUtility.toArray(organization.Notifications.WebHooks.EndpointURLs, "\n").filter(value => AppUtility.isNotEmpty(value));
				organization.MetaTags = organization.Others.MetaTags;
				organization.Scripts = organization.Others.Scripts;
				organization.RefreshUrls.Addresses = AppUtility.toArray(organization.RefreshUrls.Addresses, "\n").filter(value => AppUtility.isNotEmpty(value));
				organization.RedirectUrls.Addresses = AppUtility.toArray(organization.RedirectUrls.Addresses, "\n").filter(value => AppUtility.isNotEmpty(value));
				organization.OriginalPrivileges = Privileges.getPrivileges(organization.Privileges);

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
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
