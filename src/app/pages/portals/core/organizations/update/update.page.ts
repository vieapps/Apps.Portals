import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "../../../../../components/app.crypto";
import { AppEvents } from "../../../../../components/app.events";
import { AppUtility } from "../../../../../components/app.utility";
import { PlatformUtility } from "../../../../../components/app.utility.platform";
import { TrackingUtility } from "../../../../../components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "../../../../../components/forms.service";
import { ConfigurationService } from "../../../../../services/configuration.service";
import { FilesService } from "../../../../../services/files.service";
import { UsersService } from "../../../../../services/users.service";
import { PortalsCoreService } from "../../../../../services/portals.core.service";
import { Organization } from "../../../../../models/portals.core.organization";
import { Privileges } from "../../../../../models/privileges";
import { UserProfile } from "../../../../../models/user";
import { Role } from "../../../../../models/portals.core.role";
import { RolesSelectorModalPage } from "../../../../../controls/portals/role.selector.modal.page";
import { UsersSelectorModalPage } from "../../../../../controls/common/user.selector.modal.page";

@Component({
	selector: "page-portals-core-organizations-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class OrganizationsUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private filesSvc: FilesService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

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

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.organization = Organization.get(this.configSvc.requestParams["ID"]);
		if (this.portalsCoreSvc.canModerateOrganization(this.organization)) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
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
				formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title")).Options.OnBlur = (_, formControl) => {
					this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true).replace(/\-/g, ""), { onlySelf: true });
					((this.form.controls.Notifications as FormGroup).controls.WebHooks as FormGroup).controls.SignKey.setValue(AppCrypto.md5(formControl.value), { onlySelf: true });
				};
				formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias")).Options.OnBlur = (_, formControl) => formControl.setValue(AppUtility.toANSI(formControl.value, true).replace(/\-/g, ""), { onlySelf: true });
			}

			const ownerControl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OwnerID"));
			ownerControl.Options.LookupOptions.CompleterOptions.AllowLookupByModal = true;
			ownerControl.Options.LookupOptions.ModalOptions = {
				Component: UsersSelectorModalPage,
				ComponentProps: { multiple: false },
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						formControl.completerInitialValue = UserProfile.get(data[0]);
					}
				}
			};

			const privilegesControl = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Privileges"));
			privilegesControl.Extras["role"] = {
				prepare: async (role: { Value: string; Label: string; Description?: string; Image?: string }) => {
					let r = Role.get(role.Value);
					if (r === undefined) {
						await this.portalsCoreSvc.getRoleAsync(role.Value, _ => r = Role.get(role.Value) || new Role(), undefined, true);
					}
					role.Label = r.Title;
				},
				modalComponent: RolesSelectorModalPage,
				modalComponentProperties: { organizationID: this.organization.ID }
			};

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
		const organization = AppUtility.clone(this.organization, false);
		organization.Privileges = Privileges.resetPrivileges(undefined, Privileges.getPrivileges(this.organization.Privileges));
		organization.ExpiredDate = AppUtility.toIsoDate(organization.ExpiredDate);
		organization.Notifications.WebHooks.EndpointURLs = AppUtility.toStr(organization.Notifications.WebHooks.EndpointURLs, "\n");
		organization.Others = { MetaTags: organization.MetaTags, Scripts: organization.Scripts };
		organization.RefreshUrls.Addresses = AppUtility.toStr(organization.RefreshUrls.Addresses, "\n");
		organization.RedirectUrls.Addresses = AppUtility.toStr(organization.RedirectUrls.Addresses, "\n");

		this.instructions = organization.Instructions;
		Organization.instructionElements.forEach(type => {
			this.instructions[type] = this.instructions[type] || {};
			this.configSvc.appConfig.languages.map(language => language.Value).forEach(language => {
				this.instructions[type][language] = this.instructions[type][language] || { Subject: undefined as string, Body: undefined as string };
			});
		});

		delete organization["MetaTags"];
		delete organization["Scripts"];
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
