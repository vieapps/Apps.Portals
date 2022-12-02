import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { PortalBase as BaseModel, Form } from "@app/models/portals.cms.all";

@Component({
	selector: "page-portals-cms-forms-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsFormsUpdatePage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private item: Form;
	private canModerate = false;
	private hash = "";

	title = {
		page: "Item",
		track: "Item"
	};
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formControls = new Array<AppFormsControl>();
	processing = false;
	buttons = {
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
		const itemID = this.configSvc.requestParams["ID"];
		if (AppUtility.isNotEmpty(itemID)) {
			this.item = Form.get(itemID);
			if (this.item === undefined) {
				await this.portalsCmsSvc.getFormAsync(itemID, _ => this.item = Form.get(itemID), undefined, true);
			}
		}

		this.contentType = this.item !== undefined
			? this.item.contentType
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.item !== undefined
			? Organization.get(this.item.SystemID)
			: this.contentType !== undefined
				? Organization.get(this.contentType.SystemID)
				: await this.portalsCoreSvc.getActiveOrganizationAsync();

		this.title.track = await this.configSvc.getResourceAsync(`portals.cms.forms.title.${(this.item !== undefined && AppUtility.isNotEmpty(this.item.ID) ? "update" : "create")}`);

		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = this.item !== undefined
				? this.item.contentType
				: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
			if (this.contentType === undefined) {
				this.trackAsync(`${this.title.track} | Invalid Content Type`, "Check");
				this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"), "/portals/core/content.types/list/all"));
				return;
			}
		}

		this.module = Module.get(this.contentType.RepositoryID);

		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Item", this.contentType !== undefined ? this.contentType.Privileges : this.module.Privileges);
		let canUpdate = this.canModerate || this.authSvc.isEditor(this.portalsCoreSvc.name, "Item", this.contentType !== undefined ? this.contentType.Privileges : this.module.Privileges);
		if (!canUpdate && this.item !== undefined && (AppUtility.isEquals(this.item.Status, "Draft") || AppUtility.isEquals(this.item.Status, "Pending"))) {
			canUpdate = AppUtility.isEquals(this.item.CreatedID, this.configSvc.getAccount().id);
		}

		if (!canUpdate) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.item = this.item || new Form(this.organization.ID, this.module.ID, this.contentType.ID);
		this.configSvc.appTitle = this.title.page = this.title.track + (AppUtility.isNotEmpty(this.item.ID) ? ` [${this.item.Title}]` : "");

		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.item.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track);
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.form", undefined, { "x-content-type-id": this.contentType.ID });

		let control = formConfig.find(ctrl => ctrl.Name === "Name");
		if (!!control) {
			control.Options.AutoFocus = true;
		}

		control = formConfig.find(ctrl => ctrl.Name === "Address");
		if (!!control) {
			formConfig.insert({
				Name: "Addresses",
				Type: "Lookup",
				Options: {
					Type: "Address",
					PlaceHolder: await this.configSvc.getResourceAsync("users.register.controls.Address.placeholder"),
					MinLength: 2,
					LookupOptions: {
						Multiple: false,
						AsModal: false,
						AsCompleter: true
					}
				}
			}, control.Order + 1);
			formConfig.removeAt(formConfig.findIndex(ctrl => ctrl.Name === "County"));
			formConfig.removeAt(formConfig.findIndex(ctrl => ctrl.Name === "Province"));
			formConfig.removeAt(formConfig.findIndex(ctrl => ctrl.Name === "Country"));
		}

		formConfig.filter(ctrl => ctrl.Name === "TextArea").forEach(ctrl => ctrl.Options.Rows = 7);

		control = formConfig.find(ctrl => ctrl.Name === "Notes");
		if (!!control) {
			control.Type = "TextArea";
			control.Options.Rows = 3;
		}

		control = formConfig.find(ctrl => ctrl.Name === "Title");
		if (!!control) {
			control.Hidden = false;
		}

		control = formConfig.find(ctrl => ctrl.Name === "Details");
		if (!!control) {
			control.Hidden = false;
			control.Type = "TextArea";
			control.Options.Rows = 10;
		}

		control = formConfig.find(ctrl => ctrl.Name === "Status");
		if (!!control) {
			control.Hidden = false;
			control.Options.Label = "{{portals.cms.forms.controls.Status.label}}";
			control.Options.SelectOptions.Values = BaseModel.approvalStatus.map(value => ({ Value: value, Label: `{{portals.cms.forms.controls.Status.${value}}}` }));
		}

		if (AppUtility.isNotEmpty(this.item.ID)) {
			formConfig.push(
				this.portalsCmsSvc.getPermanentLinkFormControl(this.item),
				this.portalsCoreSvc.getAuditFormControl(this.item),
				this.appFormsSvc.getButtonControls("basic", {
					Name: "Delete",
					Label: "{{portals.cms.contents.update.buttons.delete}}",
					OnClick: () => this.delete(),
					Options: {
						Fill: "clear",
						Color: "danger",
						Css: "ion-float-end",
						Icon: {
							Name: "trash",
							Slot: "start"
						}
					}
				})
			);
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.item.ID)) {
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
		this.form.patchValue(AppUtility.clone(this.item, false, undefined, obj => Form.normalizeClonedProperties(this.item, obj)));
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync();
	}

	save() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				this.configSvc.navigateBackAsync();
			}
			else {
				this.appFormsSvc.showLoadingAsync(this.title.track).then(() => {
					this.processing = true;
					const form = this.form.value;
					if (AppUtility.isNotEmpty(form.ID)) {
						this.portalsCmsSvc.updateFormAsync(
							form,
							_ => this.trackAsync(this.title.track, "Update").then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.update"))).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())),
							error => this.trackAsync(this.title.track, "Update").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
					else {
						this.portalsCmsSvc.createFormAsync(
							form,
							_ => this.trackAsync(this.title.track).then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.new"))).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())),
							error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
				});
			}
		}
	}

	delete() {
		AppUtility.invoke(async () => {
			const deleteButton = await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete");
			const removeButton = await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.remove");
			const confirmMessage = await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.delete");
			const successMessage = await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.delete");
			this.appFormsSvc.showConfirmAsync(
				confirmMessage,
				() => this.appFormsSvc.showLoadingAsync(deleteButton).then(() => this.portalsCmsSvc.deleteFormAsync(
					this.item.ID,
					() => this.trackAsync(deleteButton, "Delete").then(() => this.appFormsSvc.showToastAsync(successMessage)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())),
					error => this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
				)),
				removeButton,
				"{{default}}"
			);
		});
	}

	cancel(message?: string, url?: string) {
		if (message === undefined && this.hash === AppCrypto.hash(this.form.value)) {
			this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url));
		}
		else {
			AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
				message || await this.configSvc.getResourceAsync(`portals.cms.contents.update.messages.confirm.${AppUtility.isNotEmpty(this.item.ID) ? "cancel" : "new"}`),
				() => this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url)),
				undefined,
				message === undefined ? "{{default}}" : undefined
			));
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Form", action: action || (this.item !== undefined && AppUtility.isNotEmpty(this.item.ID) ? "Edit" : "Create") });
	}

}
