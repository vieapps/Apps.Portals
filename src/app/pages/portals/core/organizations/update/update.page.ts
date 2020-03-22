import { Component, OnInit, NgZone } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "../../../../../components/app.crypto";
import { AppEvents } from "../../../../../components/app.events";
import { AppUtility } from "../../../../../components/app.utility";
import { TrackingUtility } from "../../../../../components/app.utility.trackings";
import { AppFormsControl, AppFormsSegment, AppFormsService } from "../../../../../components/forms.service";
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
		public zone: NgZone,
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
		config: undefined as Array<any>,
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

	async ngOnInit() {
		this.organization = Organization.get(this.configSvc.requestParams["ID"]);

		if (!(this.organization === undefined ? this.authSvc.isSystemAdministrator() : this.authSvc.isAdministrator(this.portalsSvc.name, "Organization", this.organization.Privileges))) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
			return;
		}

		this.title = this.organization === undefined
			? await this.configSvc.getResourceAsync("portals.organizations.title.create")
			: await this.configSvc.getResourceAsync("portals.organizations.title.update");
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: this.organization === undefined
				? await this.configSvc.getResourceAsync("common.buttons.create")
				: await this.configSvc.getResourceAsync("common.buttons.update"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.update.segments.items = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.organizations.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.organizations.update.segments.privileges")),
			new AppFormsSegment("messages", await this.configSvc.getResourceAsync("portals.organizations.update.segments.messages")),
			new AppFormsSegment("emails", await this.configSvc.getResourceAsync("portals.organizations.update.segments.emails")),
			new AppFormsSegment("socials", await this.configSvc.getResourceAsync("portals.organizations.update.segments.socials")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.organizations.update.segments.notifications")),
			new AppFormsSegment("urls", await this.configSvc.getResourceAsync("portals.organizations.update.segments.urls")),
			new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("portals.organizations.update.segments.attachments"))
		];

		const config: Array<any> = await this.configSvc.getDefinitionAsync(this.portalsSvc.name, "organization", "form-controls");
		config.forEach(control => control.Segment = "basic");

		if (this.organization === undefined) {
			config.find(control => control.Name === "Title").Options.OnKeyUp = () => this.update.form.controls.Alias.setValue(AppUtility.toURI(this.update.form.controls.Title.value));
		}

		let ctrl = config.find(control => control.Name === "Description");
		ctrl.Type = "TextArea";
		ctrl.Options.TextAreaRows = 2;

		ctrl = config.find(control => control.Name === "Status");
		if (AppUtility.isNotEmpty(ctrl.Options.SelectOptions.Values)) {
			ctrl.Options.SelectOptions.Values = (AppUtility.toArray(ctrl.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
		}

		ctrl = config.find(control => true === control.Options.AutoFocus);
		if (ctrl === undefined) {
			ctrl = config.find(control => control.Type === "TextBox" && !control.Hidden);
			if (ctrl !== undefined) {
				ctrl.Options.AutoFocus = true;
			}
		}

		this.update.config = config;
		this.organization = this.organization || new Organization();
	}

	onFormInitialized() {
		this.update.form.patchValue(this.organization);
		this.update.hash = AppCrypto.hash(this.update.form.value);
		this.appFormsSvc.hideLoadingAsync();
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
			async () => await this.zone.run(async () => await this.configSvc.navigateBackAsync()),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
