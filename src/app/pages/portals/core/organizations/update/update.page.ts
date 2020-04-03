import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "../../../../../components/app.crypto";
import { AppEvents } from "../../../../../components/app.events";
import { AppUtility } from "../../../../../components/app.utility";
import { PlatformUtility } from "../../../../../components/app.utility.platform";
import { TrackingUtility } from "../../../../../components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "../../../../../components/forms.service";
import { ConfigurationService } from "../../../../../services/configuration.service";
import { AuthenticationService } from "../../../../../services/authentication.service";
import { FilesService } from "../../../../../services/files.service";
import { PortalsService } from "../../../../../services/portals.service";
import { Organization } from "../../../../../models/portals.organization";

@Component({
	selector: "page-portals-organizations-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class OrganizationsUpdatePage implements OnInit {
	constructor(
		public appFormsSvc: AppFormsService,
		public configSvc: ConfigurationService,
		public authSvc: AuthenticationService,
		public filesSvc: FilesService,
		public portalsSvc: PortalsService
	) {
	}

	title = "";
	organization: Organization;
	update = {
		form: new FormGroup({}),
		config: undefined as Array<AppFormsControlConfig>,
		segments: {
			items: undefined as Array<AppFormsSegment>,
			default: "basic"
		},
		controls: new Array<AppFormsControl>(),
		hash: "",
	};
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	ngOnInit() {
		this.organization = Organization.get(this.configSvc.requestParams["ID"]);
		if (!(this.organization === undefined ? this.authSvc.isSystemAdministrator() : this.authSvc.isAdministrator(this.portalsSvc.name, "Organization", this.organization.Privileges))) {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]);
		}
		else {
			this.initializeAsync();
		}
	}

	async initializeAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.organizations.title.${(this.organization === undefined ? "create" : "update")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(this.organization === undefined ? "create" : "update")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.update.segments.items = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.organizations.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.organizations.update.segments.privileges")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.organizations.update.segments.notifications")),
			new AppFormsSegment("urls", await this.configSvc.getResourceAsync("portals.organizations.update.segments.urls")),
			new AppFormsSegment("emails", await this.configSvc.getResourceAsync("portals.organizations.update.segments.emails")),
			new AppFormsSegment("socials", await this.configSvc.getResourceAsync("portals.organizations.update.segments.socials")),
			new AppFormsSegment("instructions", await this.configSvc.getResourceAsync("portals.organizations.update.segments.instructions")),
		];
		if (this.organization !== undefined) {
			this.update.segments.items.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("portals.organizations.update.segments.attachments")));
		}

		const config: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsSvc.name, "organization", "form-controls");
		config.forEach(control => control.Segment = "basic");

		config.push({
			Name: "Privileges",
			Type: "Custom",
			Segment: "privileges",
			Extras: { AllowInheritFromParent: false },
			Options: {
				Type: "object-privileges"
			}
		});

		config.push(
			await this.portalsSvc.GetNotificationsControlConfigAsync("Notifications", "notifications", undefined, undefined, false),
			{
				Name: "RefreshUrls",
				Segment: "urls",
				Options: {
					Label: await this.appFormsSvc.getResourceAsync("portals.organizations.controls.RefreshUrls.label"),
				},
					SubControls: {
					Controls: [
						{
							Name: "Addresses",
							Type: "TextArea",
							Options: {
								Label: await this.configSvc.getResourceAsync("portals.organizations.controls.RefreshUrls.Addresses.label"),
								Description: await this.configSvc.getResourceAsync("portals.organizations.controls.RefreshUrls.Addresses.description"),
								Rows: 10
							}
						},
						{
							Name: "Interval",
							Type: "Range",
							Options: {
								Label: await this.configSvc.getResourceAsync("portals.organizations.controls.RefreshUrls.Interval.label"),
								Description: await this.configSvc.getResourceAsync("portals.organizations.controls.RefreshUrls.Interval.description"),
								Type: "number",
								MinValue: 5,
								MaxValue: 120,
								RangeOptions: {
									AllowPin: true,
									AllowSnaps: true,
									AllowTicks: true,
									Step: 5,
									Icons: {
										Start: "time"
									}
								}
							}
						}
					]
				}
			},
			{
				Name: "RedirectUrls",
				Segment: "urls",
				Options: {
					Label: await this.appFormsSvc.getResourceAsync("portals.organizations.controls.RedirectUrls.label"),
				},
					SubControls: {
					Controls: [
						{
							Name: "Addresses",
							Type: "TextArea",
							Options: {
								Label: await this.configSvc.getResourceAsync("portals.organizations.controls.RedirectUrls.Addresses.label"),
								Description: await this.configSvc.getResourceAsync("portals.organizations.controls.RedirectUrls.Addresses.description"),
								Rows: 10
							}
						},
						{
							Name: "AllHttp404",
							Type: "YesNo",
							Options: {
								Label: await this.configSvc.getResourceAsync("portals.organizations.controls.RedirectUrls.AllHttp404"),
								Type: "toggle"
							}
						}
					]
				}
			},
			await this.portalsSvc.GetEmailSettingsControlConfigAsync("Emails", "emails", false)
		);

		if (this.organization === undefined) {
			config.find(control => AppUtility.isEquals(control.Name, "Title")).Options.OnKeyUp = () => {
				this.update.form.controls.Alias.setValue(AppUtility.toANSI(this.update.form.controls.Title.value, true).replace(/\-/g, ""));
				let control = this.update.form.controls.Notifications as FormGroup;
				control = control.controls.WebHooks as FormGroup;
				control.controls.SignKey.setValue(AppCrypto.md5(this.update.form.controls.Title.value));
			};
		}

		let ctrl = config.find(control => AppUtility.isEquals(control.Name, "Description"));
		ctrl.Type = "TextArea";
		ctrl.Options.Rows = 2;

		ctrl = config.find(control => AppUtility.isEquals(control.Name, "Status"));
		if (AppUtility.isNotEmpty(ctrl.Options.SelectOptions.Values)) {
			ctrl.Options.SelectOptions.Values = (AppUtility.toArray(ctrl.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
			ctrl.Options.SelectOptions.Interface = "popover";
		}
		if (!this.authSvc.isSystemAdministrator()) {
			ctrl.Options.Disabled = true;
		}

		ctrl = config.find(control => AppUtility.isEquals(control.Name, "ExpiredDate"));
		ctrl.Type = "DatePicker";
		ctrl.Required = false;
		ctrl.Options.DatePickerOptions = { AllowTimes: false };
		if (!this.authSvc.isSystemAdministrator()) {
			ctrl.Options.Disabled = true;
		}

		ctrl = config.find(control => AppUtility.isEquals(control.Name, "FilesQuotes"));
		ctrl.Type = "Range";
		ctrl.Options.MinValue = 0;
		ctrl.Options.MaxValue = 500;
		ctrl.Options.RangeOptions = {
			AllowPin: true,
			AllowSnaps: true,
			AllowTicks: true,
			Step: 10,
			Icons: {
				Start: "cloud-done",
				End: "cloud"
			}
		};
		if (!this.authSvc.isSystemAdministrator()) {
			ctrl.Options.Disabled = true;
		}

		ctrl = config.find(control => AppUtility.isEquals(control.Name, "Required2FA"));
		ctrl.Options.Type = "toggle";

		ctrl = config.find(control => AppUtility.isEquals(control.Name, "TrackDownloadFiles"));
		ctrl.Options.Type = "toggle";

		ctrl = config.find(control => control.Options && control.Options.AutoFocus);
		if (ctrl === undefined) {
			ctrl = config.find(control => AppUtility.isEquals(control.Type, "TextBox") && !control.Hidden);
			if (ctrl !== undefined) {
				ctrl.Options.AutoFocus = true;
			}
		}

		this.update.config = config;
		this.organization = this.organization || new Organization();
	}

	onFormInitialized(event: any) {
		this.update.form.patchValue(this.organization);
		if (AppUtility.isEquals("-", this.organization.ExpiredDate)) {
			this.update.form.controls.ExpiredDate.patchValue(undefined);
		}
		this.update.hash = AppCrypto.hash(this.update.form.value);
		this.appFormsSvc.hideLoadingAsync();
		console.log("Forms", this.update.form.value);
	}

	async updateAsync() {
		if (this.update.form.invalid) {
			this.appFormsSvc.highlightInvalids(this.update.form);
		}
		else {
			await this.appFormsSvc.showLoadingAsync(this.title);
		}
	}

	async cancelAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			undefined,
			await this.configSvc.getResourceAsync("portals.organizations.update.messages.confirm"),
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
