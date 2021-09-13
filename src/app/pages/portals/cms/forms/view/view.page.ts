import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Form } from "@app/models/portals.cms.form";

@Component({
	selector: "page-portals-cms-items-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsFormsViewPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	private item: Form;
	canModerate = false;
	canEdit = false;
	title = {
		page: "Item",
		track: "Item"
	};
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
	formControls = new Array<AppFormsControl>();
	resources = {
		status: "Status",
		update: "Update",
		moderate: "Moderate",
		delete: "Delete"
	};
	actions: Array<{
		text: string,
		role?: string,
		icon?: string,
		handler: () => void
	}>;

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		AppEvents.off(this.portalsCoreSvc.name, "CMS.Forms:View:Refresh");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const itemID = this.configSvc.requestParams["ID"];
		this.item = Form.get(itemID);
		if (this.item === undefined) {
			await this.portalsCmsSvc.getFormAsync(itemID, _ => this.item = Form.get(itemID), undefined, true);
		}

		this.title.track = await this.configSvc.getResourceAsync("portals.cms.forms.title.view");

		if (this.item === undefined) {
			this.trackAsync(`${this.title.track} | No Content`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		let canView = false;
		const account = this.configSvc.getAccount();
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.item.organization, account) || this.portalsCmsSvc.canModerate(this.item, account);

		if (AppUtility.isEquals(this.item.Status, "Draft") || AppUtility.isEquals(this.item.Status, "Pending") || AppUtility.isEquals(this.item.Status, "Rejected")) {
			this.canEdit = canView = this.canModerate || this.portalsCmsSvc.canEdit(this.item, account) || AppUtility.isEquals(this.item.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.item.Status, "Approved")) {
			this.canEdit = this.canModerate || this.portalsCmsSvc.canEdit(this.item, account);
			canView = this.canEdit || AppUtility.isEquals(this.item.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.item.Status, "Published")) {
			this.canEdit = this.canModerate || this.portalsCmsSvc.canEdit(this.item, account);
			canView = this.portalsCmsSvc.canView(this.item, account);
		}
		else {
			this.canEdit = canView = this.canModerate;
		}

		if (!canView) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.configSvc.appTitle = this.title.page = this.title.track + ` [${this.item.Title}]`;

		this.resources = {
			status: await this.configSvc.getResourceAsync("portals.cms.contents.controls.Status.label"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			moderate: await this.configSvc.getResourceAsync("common.buttons.approve"),
			delete: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete")
		};

		if (this.canEdit) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(this.resources.update, "create", () => this.update()),
				this.appFormsSvc.getActionSheetButton(this.resources.moderate, "checkmark-done", () => this.moderate()),
				this.appFormsSvc.getActionSheetButton(this.resources.delete, "trash", () => this.delete())
			];
		}

		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track);

		AppEvents.on(this.portalsCoreSvc.name, info => {
			const args = info.args;
			if (args.Object === "CMS.Form" && this.item.ID === args.ID) {
				if (args.Type === "Updated") {
					this.formControls.filter(control => control.Hidden).forEach(control => control.Hidden = this.formConfig.find(cfg => cfg.Name === control.Name).Hidden ? true : false);
					this.prepareValues();
				}
				else if (args.Type === "Deleted") {
					this.cancel();
				}
			}
		}, "CMS.Forms:View:Refresh");
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.form", undefined, { "x-content-type-id": this.item.RepositoryEntityID, "x-view-controls": "x" });
		formConfig.push(
			this.portalsCmsSvc.getPermanentLinkFormControl(this.item, "basic"),
			this.portalsCoreSvc.getAuditFormControl(this.item, "basic")
		);

		let control = formConfig.find(ctrl => ctrl.Name === "Address");
		control.Name = "fullAddress";

		formConfig.removeAt(formConfig.findIndex(ctrl => ctrl.Name === "County"));
		formConfig.removeAt(formConfig.findIndex(ctrl => ctrl.Name === "Province"));
		formConfig.removeAt(formConfig.findIndex(ctrl => ctrl.Name === "Country"));
		formConfig.forEach((ctrl, index) => ctrl.Order = index);

		control = formConfig.find(ctrl => ctrl.Name === "ID");
		control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
		control.Hidden = false;
		control.Options.Label = "{{common.audits.identity}}";
		control.Options.ReadOnly = true;

		if (this.canEdit) {
			formConfig.push(this.appFormsSvc.getButtonControls(
				"basic",
				{
					Name: "Delete",
					Label: this.resources.delete,
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
				}
			));
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	onFormInitialized() {
		this.prepareValues();
		this.appFormsSvc.hideLoadingAsync();
	}

	private prepareValues() {
		this.formControls.filter(ctrl => !ctrl.Hidden && ctrl.Name !== "Buttons").forEach(async control => {
			control.value = AppUtility.isEquals(control.Name, "Audits")
				? await this.portalsCoreSvc.getAuditInfoAsync(this.item)
				: this.item[control.Name];
			control.Hidden = AppUtility.isEmpty(control.value);
			if (!control.Hidden) {
				if (AppUtility.isEquals(control.Type, "TextEditor")) {
					control.value = (control.value || "").replaceAll("\r", "").replaceAll("\n", "<br/>");
				}
				else {
					switch (control.Name) {
						case "Status":
							control.value = await this.appFormsSvc.getResourceAsync(`status.approval.${control.value}`);
							break;

						case "AllowComments":
							control.Hidden = !this.item.contentType.AllowComments;
							break;

						case "Summary":
							control.value = AppUtility.normalizeHtml(control.value, true);
							break;
					}
				}
			}
		});
	}

	showActions() {
		this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	update() {
		this.configSvc.navigateForwardAsync(this.item.routerURI.replace("/view/", "/update/"));
	}

	moderate() {
		const availableStatuses = ["Draft", "Pending"];
		if (this.canEdit) {
			availableStatuses.push("Rejected", "Approved");
		}
		if (this.canModerate) {
			availableStatuses.push("Published", "Archieved");
		}
		const currentStatus = availableStatuses.indexOf(this.item.Status) > -1 ? this.item.Status : "Draft";
		this.portalsCoreSvc.approveAsync(this.item.contentType.ID, this.item.ID, currentStatus, availableStatuses);
	}

	delete() {
		this.trackAsync(this.resources.delete, "Delete").then(async () => this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.delete"),
			undefined,
			async () => this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete")).then(() => this.portalsCmsSvc.deleteFormAsync(
				this.item.ID,
				async data => {
					AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Form", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID });
					this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.delete"))
						.then(() => this.trackAsync(this.resources.delete, "Delete"))
						.then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
				},
				error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.resources.delete, "Delete"))
			)),
			await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		));
	}

	cancel() {
		this.configSvc.navigateBackAsync();
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Form", action: action || "View" });
	}

}
