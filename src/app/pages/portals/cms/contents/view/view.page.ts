import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { FilesService } from "@services/files.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { AttachmentInfo } from "@models/base";
import { Category } from "@models/portals.cms.category";
import { Content } from "@models/portals.cms.content";

@Component({
	selector: "page-portals-cms-contents-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsContentsViewPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private filesSvc: FilesService,
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

	get status() {
		const control = this.formControls !== undefined
			? this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"))
			: undefined;
		return {
			raw: this.content !== undefined ? this.content.Status : "Draft",
			normalized: control !== undefined ? control.value as string : this.content !== undefined ? this.content.Status : "Draft"
		};
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.content !== undefined) {
			AppEvents.off(this.portalsCoreSvc.name, "CMS.Contents:View:Refresh");
			AppEvents.off(this.filesSvc.name, "CMS.Contents:View:Refresh");
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const contentID = this.configSvc.requestParams["ID"];
		this.content = Content.get(contentID);
		if (this.content === undefined) {
			await this.portalsCmsSvc.getContentAsync(contentID, _ => this.content = Content.get(contentID), undefined, true);
		}

		if (this.content === undefined) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		let canView = false;
		const account = this.configSvc.getAccount();
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.content.organization, account) || this.portalsCmsSvc.canModerate(this.content, account);

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

		if (!canView) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		this.title = await this.configSvc.getResourceAsync("portals.cms.contents.title.view");
		this.configSvc.appTitle = this.title = this.title + ` [${this.content.Title}]`;

		this.resources = {
			status: await this.configSvc.getResourceAsync("portals.cms.contents.controls.Status.label"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			moderate: await this.configSvc.getResourceAsync("common.buttons.moderate"),
			delete: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete")
		};

		if (this.canEdit) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(this.resources.update, "create", () => this.updateAsync()),
				this.appFormsSvc.getActionSheetButton(this.resources.moderate, "checkmark-done", () => this.moderateAsync()),
				this.appFormsSvc.getActionSheetButton(this.resources.delete, "trash", () => this.deleteAsync())
			];
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();

		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "CMS.Content" && this.content.ID === info.args.ID) {
				if (info.args.Type === "Updated") {
					this.formControls.filter(control => control.Hidden).forEach(control => control.Hidden = this.formConfig.find(cfg => AppUtility.isEquals(cfg.Name, control.Name)).Hidden ? true : false);
					this.prepareValues();
				}
				else if (info.args.Type === "Deleted") {
					this.cancelAsync();
				}
			}
		}, "CMS.Contents:View:Refresh");

		AppEvents.on(this.filesSvc.name, info => {
			if (this.content.ID === info.args.ObjectID && (info.args.Object === "Attachment" || info.args.Object === "Thumbnail")) {
				this.prepareAttachments(`${info.args.Object}s`, undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
			}
		}, "CMS.Contents:View:Refresh");
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: Array<AppFormsSegment>) => void) {
		const formSegments = [
			new AppFormsSegment("management", await this.configSvc.getResourceAsync("portals.cms.contents.view.segments.management")),
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.view.segments.basic")),
			new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.content", undefined, { "x-content-type": this.content.RepositoryEntityID });
		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Relateds")).Segment = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExternalRelateds")).Segment = "basic";

		formConfig.push(
			this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments"),
			this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label")),
			this.portalsCmsSvc.getPermanentLinkFormControl(this.content, "management"),
			this.portalsCoreSvc.getAuditFormControl(this.content, "management")
		);
		formConfig.forEach((ctrl, index) => ctrl.Order = index);

		const control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
		control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
		control.Segment = "management";
		control.Hidden = false;
		control.Options.Label = "{{common.audits.identity}}";
		control.Options.ReadOnly = true;

		if (this.canEdit) {
			formConfig.push(this.appFormsSvc.getButtonControls(
				"management",
				{
					Name: "Delete",
					Label: this.resources.delete,
					OnClick: async () => await this.deleteAsync(),
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
		this.appFormsSvc.hideLoadingAsync(() => {
			if (this.content.thumbnails !== undefined) {
				this.prepareAttachments("Thumbnails", this.content.thumbnails);
			}
			else {
				this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.content), thumbnails => {
					this.content.updateThumbnails(thumbnails);
					this.prepareAttachments("Thumbnails", thumbnails);
				});
			}
			if (this.content.attachments !== undefined) {
				this.prepareAttachments("Attachments", this.content.attachments);
			}
			else {
				this.filesSvc.searchAttachmentsAsync(this.portalsCmsSvc.getFileOptions(this.content), attachments => {
					this.content.updateAttachments(attachments);
					this.prepareAttachments("Attachments", attachments);
				});
			}
		});
	}

	private prepareAttachments(name: string, attachments?: Array<AttachmentInfo>, addedOrUpdated?: AttachmentInfo, deleted?: AttachmentInfo) {
		const formControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, name));
		const isThumbnails = AppUtility.isEquals(name, "Thumbnails");
		this.filesSvc.prepareAttachmentsFormControl(formControl, isThumbnails, attachments, addedOrUpdated, deleted, control => control.Hidden = control.value === undefined);
	}

	private prepareValues() {
		this.formControls.filter(control => !control.Hidden && !AppUtility.isEquals(control.Name, "Thumbnails") && !AppUtility.isEquals(control.Name, "Attachments") && !AppUtility.isEquals(control.Name, "Buttons")).forEach(async control => {
			control.value = AppUtility.isEquals(control.Name, "Audits")
				? await this.portalsCoreSvc.getAuditInfoAsync(this.content)
				: this.content[control.Name];
			control.Hidden = control.value === undefined;
			if (!control.Hidden) {
				if (AppUtility.isEquals(control.Type, "TextEditor")) {
					control.value = this.portalsCmsSvc.normalizeRichHtml(control.value);
				}
				else {
					let category: Category;
					let categories: string;
					let relateds: string;
					let content: Content;
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
							categories = "";
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
							control.Hidden = !this.content.contentType.AllowComments;
							break;

						case "Summary":
							control.value = AppUtility.normalizeHtml(control.value, true);
							break;

						case "Relateds":
							relateds = "";
							await Promise.all(this.content.Relateds.map(async contentID => {
								content = Content.get(contentID);
								if (content === undefined) {
									await this.portalsCmsSvc.getContentAsync(contentID, _ => content = Content.get(contentID), undefined, true);
								}
								if (content !== undefined) {
									relateds += `<li>${content.Title}</li>`;
								}
							}));
							control.value = `<ul>${relateds}</ul>`;
							control.Type = "TextArea";
							break;

						case "ExternalRelateds":
							relateds = "";
							this.content.ExternalRelateds.forEach(related => relateds += `<li><a href="${related.URL}" target=\"_blank\">${related.Title}</a></li>`);
							control.value = `<ul>${relateds}</ul>`;
							control.Type = "TextArea";
							break;
					}
				}
			}
		});
	}

	async showActionsAsync() {
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async updateAsync() {
		await this.configSvc.navigateForwardAsync(this.content.routerURI.replace("/view/", "/update/"));
	}

	async moderateAsync() {
		await this.configSvc.navigateForwardAsync(this.content.routerURI.replace("/view/", "/update/"));
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete"));
				await this.portalsCmsSvc.deleteContentAsync(
					this.content.ID,
					async data => {
						AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: data.CategoryID });
						if (AppUtility.isArray(data.OtherCategories)) {
							(data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: categoryID }));
						}
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.showErrorAsync(error)
				);
			},
			await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync() {
		await this.configSvc.navigateBackAsync();
	}

}
