import { Component, OnInit } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Category } from "@models/portals.cms.category";
import { Content } from "@models/portals.cms.content";

@Component({
	selector: "page-portals-cms-contens-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsContentsViewPage implements OnInit {

	constructor(
		public configSvc: ConfigurationService,
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
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
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

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("management", await this.configSvc.getResourceAsync("portals.cms.contents.view.segments.management")),
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.view.segments.basic"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.content");
		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Relateds")).Segment =
			formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExternalRelateds")).Segment = "basic";
		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	onFormInitialized() {
		this.formControls.filter(control => !control.Hidden).forEach(async control => {
			control.value = this.content[control.Name];
			control.Hidden = control.value === undefined;
			if (control.Hidden) {
				return;
			}
			let category: Category;
			let relateds: string;
			switch (control.Name) {
				case "Status":
					control.value = await this.appFormsSvc.getResourceAsync(`status.approval.${control.value}`);
					break;

				case "CategoryID":
					category = Category.get(this.content.CategoryID);
					if (category === undefined) {
						await this.portalsCmsSvc.getCategoryAsync(this.content.CategoryID, _ => category = Category.get(this.content.CategoryID), undefined, true);
					}
					if (category !== undefined) {
						control.value = category.FullTitle;
					}
					break;

				case "OtherCategories":
					let categories = "";
					await Promise.all(this.content.OtherCategories.map(async categoryID => {
						category = Category.get(categoryID);
						if (category === undefined) {
							await this.portalsCmsSvc.getCategoryAsync(categoryID, _ => category = Category.get(categoryID), undefined, true);
						}
						if (category !== undefined) {
							categories += `<li>${category.FullTitle}</li>`;
						}
					}));
					control.value = `<ul>${categories}</ul>`;
					control.Type = "TextArea";
					break;

				case "AllowComments":
					control.Hidden = !this.content.ContentType.AllowComments;
					break;

				case "Relateds":
					relateds = "";
					await Promise.all(this.content.Relateds.map(async contentID => {
						let content = Content.get(contentID);
						if (content === undefined) {
							await this.portalsCmsSvc.getContentAsync(contentID, _ => content = Content.get(contentID), undefined, true);
						}
						if (content !== undefined) {
							relateds += `<li>${content.Title}</li>`;
						}
						control.value = `<ul>${relateds}</ul>`;
						control.Type = "TextArea";
					}));
					break;

				case "ExternalRelateds":
					relateds = "";
					this.content.ExternalRelateds.forEach(related => {
						relateds += `<li><a target=_blank href="${related.URL}">${related.Title}</a></li>`;
						control.value = `<ul>${relateds}</ul>`;
						control.Type = "TextArea";
					});
					break;
			}
		});
		this.appFormsSvc.hideLoadingAsync();
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
