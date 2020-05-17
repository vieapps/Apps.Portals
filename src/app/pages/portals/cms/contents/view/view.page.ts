import { Component, OnInit } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { FormGroup } from "@angular/forms";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { UsersService } from "@services/users.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Content } from "@models/portals.cms.content";

@Component({
	selector: "page-portals-cms-contens-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsContentsViewPage implements OnInit {

	constructor(
		public configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	private content: Content;
	canModerate = false;
	canEdit = false;
	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formControls = new Array<AppFormsControl>();
	button = "Update";

	get locale() {
		return this.configSvc.locale;
	}

	get status() {
		return this.content !== undefined ? this.content.Status : "Draft";
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		const contentID = this.configSvc.requestParams["ID"];
		this.content = Content.get(contentID);
		if (this.content === undefined) {
			await this.portalsCmsSvc.getContentAsync(contentID, _ => this.content = Content.get(contentID), undefined, true);
		}

		if (this.content === undefined) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
			return;
		}

		const account = this.configSvc.getAccount();
		let canView = false;
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.content.Organization, account) || this.portalsCmsSvc.canModerate(this.content, account);

		if (AppUtility.isEquals(this.content.Status, "Draft") || AppUtility.isEquals(this.content.Status, "Pending") || AppUtility.isEquals(this.content.Status, "Rejected")) {
			this.canEdit = canView = this.canModerate || this.portalsCmsSvc.canEdit(this.content, account) || AppUtility.isEquals(this.content.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.content.Status, "Approved")) {
			this.canEdit = this.canModerate;
			canView = this.canEdit || this.portalsCmsSvc.canEdit(this.content, account) || AppUtility.isEquals(this.content.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.content.Status, "Published")) {
			this.canEdit = this.canModerate;
			canView = this.portalsCmsSvc.canView(this.content, account);
		}
		else {
			this.canEdit = canView = this.canModerate;
		}

		if (canView) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("portals.cms.contents.title.view");
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = this.canEdit
			? await this.configSvc.getResourceAsync(`common.buttons.${(this.canModerate ? "moderate" : "update")}`)
			: undefined;

		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.content", "view-controls");
		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	onFormInitialized() {
		const content = AppUtility.clone(this.content, false, ["StartDate", "EndDate", "PublishedTime"]);
		content.StartDate = AppUtility.toIsoDate(this.content.StartDate);
		content.EndDate = AppUtility.toIsoDate(this.content.EndDate);
		content.PublishedTime = AppUtility.toIsoDate(this.content.PublishedTime);
		this.form.patchValue(content);
		this.appFormsSvc.hideLoadingAsync();
		console.log("Forms", this.content, content, this.form, this.formControls);
	}

	async moderateAsync() {
		await this.configSvc.navigateForwardAsync(this.content.routerURI.replace("/view/", "/update"));
	}

	async updateAsync() {
		await this.configSvc.navigateForwardAsync(this.content.routerURI.replace("/view/", "/update"));
	}

	async cancelAsync() {
		await this.configSvc.navigateBackAsync();
	}

}
