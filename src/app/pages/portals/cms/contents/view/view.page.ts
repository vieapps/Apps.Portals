import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { Category, Content } from "@app/models/portals.cms.all";
import { SchedulingTask } from "@app/models/portals.core.all";
import { ScheduledPublishModalPage } from "@app/controls/portals/scheduled.publish.modal.page";

@Component({
	selector: "page-portals-cms-contents-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsContentsViewPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	private content: Content;
	private task: SchedulingTask;
	canModerate = false;
	canEdit = false;
	title = {
		page: "Content",
		track: "Content"
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
		versions: "Versions",
		delete: "Delete",
		deleteThumbnail: "Delete Thumbnail"
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

	private get schedulingTask() {
		if (this.task === undefined && this.content !== undefined) {
			this.task = this.content.updatingTask;
		}
		return this.task;
	}

	get scheduled() {
		return this.schedulingTask !== undefined && this.schedulingTask.updatingStatus !== undefined && this.content.Status !== "Published";
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
			this.trackAsync(`${this.title.track} | No Content`, "Check");
			this.appFormsSvc.showToastAsync("Hmmmmmm....");
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		let canView = false;
		const account = this.configSvc.getAccount();
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.content.organization, account) || this.portalsCmsSvc.canModerate(this.content, account);

		if (AppUtility.isEquals(this.content.Status, "Draft") || AppUtility.isEquals(this.content.Status, "Pending") || AppUtility.isEquals(this.content.Status, "Rejected")) {
			this.canEdit = canView = this.canModerate || this.portalsCmsSvc.canEdit(this.content, account) || AppUtility.isEquals(this.content.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.content.Status, "Approved")) {
			this.canEdit = this.canModerate || this.portalsCmsSvc.canEdit(this.content, account);
			canView = this.canEdit || AppUtility.isEquals(this.content.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.content.Status, "Published")) {
			this.canEdit = this.canModerate || this.portalsCmsSvc.canEdit(this.content, account);
			canView = this.portalsCmsSvc.canView(this.content, account);
		}
		else {
			this.canEdit = canView = this.canModerate;
		}

		if (!canView) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check");
			this.appFormsSvc.showToastAsync("Hmmmmmm....");
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.title.track = await this.configSvc.getResourceAsync("portals.cms.contents.title.view");
		this.configSvc.appTitle = this.title.page = this.title.track + ` [${this.content.Title}]`;
		if (this.content.Versions === undefined) {
			this.portalsCoreSvc.findVersionsAsync("CMS.Content", this.content.ID);
		}

		this.resources = {
			status: await this.configSvc.getResourceAsync("portals.cms.contents.controls.Status.label"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			moderate: await this.configSvc.getResourceAsync("common.buttons.approve"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			delete: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete"),
			deleteThumbnail: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.deleteThumbnail")
		};

		if (this.canEdit) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(this.resources.update, "create", () => this.update()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync(this.content.Status !== "Published" ? "portals.tasks.scheduled.publish.title.modal" : "portals.tasks.scheduled.update.action"), "timer", () => this.openSchedulingTaskAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync(this.content.Status !== "Published" ? "portals.cms.common.buttons.viewAsPublished" : "portals.cms.common.buttons.viewAsPublic"), "eye", () => this.view()),
				this.appFormsSvc.getActionSheetButton(this.resources.versions, "layers-outline", () => this.viewVersions()),
				this.appFormsSvc.getActionSheetButton(this.resources.delete, "trash", () => this.delete())
			];
			if (this.canModerate) {
				this.actions.insert(this.appFormsSvc.getActionSheetButton(this.resources.moderate, "checkmark-done", () => this.moderate()), 1);
			}
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track);
		this.portalsCoreSvc.setActiveOrganization(this.content.organization);

		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "CMS.Content" && this.content.ID === info.args.ID) {
				if (info.args.Type === "Updated") {
					this.task = undefined;
					this.formControls.filter(control => control.Hidden).forEach(control => control.Hidden = this.formConfig.find(cfg => AppUtility.isEquals(cfg.Name, control.Name)).Hidden ? true : false);
					this.prepareValues();
					if (this.canEdit) {
						AppUtility.invoke(async () => this.actions[this.canModerate ? 3 : 2].text = await this.configSvc.getResourceAsync(this.content.Status !== "Published" ? "portals.cms.common.buttons.viewAsPublished" : "portals.cms.common.buttons.viewAsPublic"));
					}
				}
				else if (info.args.Type === "Deleted") {
					this.cancel();
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
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.content", undefined, { "x-content-type-id": this.content.RepositoryEntityID, "x-view-controls": "x" });
		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Relateds")).Segment = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExternalRelateds")).Segment = "basic";

		formConfig.push(
			this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments"),
		);
		if (this.canEdit) {
			const buttons = this.appFormsSvc.getButtonControls("attachments", {
				Name: "DeleteThumbnail",
				Label: this.resources.deleteThumbnail,
				OnClick: () => this.deleteThumbnail(),
				Options: {
					Fill: "clear",
					Color: "danger",
					Css: "ion-float-end",
					Icon: {
						Name: "trash",
						Slot: "start"
					}
				}
			});
			buttons.Name = "ThumbnailButtons";
			formConfig.push(buttons);
		}

		formConfig.push(
			this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label")),
			this.portalsCmsSvc.getPermanentLinkFormControl(this.content, "management"),
			this.portalsCmsSvc.getPublicLinkFormControl(this.content, "management"),
			this.portalsCmsSvc.getTemporaryLinkFormControl(this.content, "management"),
			this.portalsCoreSvc.getAuditFormControl(this.content, "management"),
			{
				Name: "RepositoryEntity",
				Type: "Text",
				Segment: "management",
				Extras: { Text: this.content.contentType !== undefined ? this.content.contentType.Title : "" },
				Options: {
					Label: "{{portals.cms.contents.list.current}}",
					ReadOnly: true
				}
			}
		);

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		const control = formConfig.find(ctrl => ctrl.Name === "ID");
		control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
		control.Segment = "management";
		control.Hidden = false;
		control.Options.Label = "{{common.audits.identity}}";
		control.Options.ReadOnly = true;

		if (this.canEdit) {
			formConfig.push(this.appFormsSvc.getButtonControls("management", {
				Name: "Delete",
				Label: this.resources.delete,
				OnClick: async () => this.delete(),
				Options: {
					Fill: "clear",
					Color: "danger",
					Css: "ion-float-end",
					Icon: {
						Name: "trash",
						Slot: "start"
					}
				}
			}));
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

	private prepareValues() {
		this.formControls.filter(ctrl => !ctrl.Hidden && ctrl.Name !== "Thumbnails" && ctrl.Name !== "Attachments" && ctrl.Name !== "Buttons" && ctrl.Name !== "ThumbnailButtons").forEach(async control => {
			control.value = AppUtility.isEquals(control.Name, "Audits")
				? await this.portalsCoreSvc.getAuditInfoAsync(this.content)
				: this.content[control.Name];
			control.Hidden = control.value === undefined;
			if (!control.Hidden) {
				if (control.Type === "TextEditor") {
					control.value = this.portalsCmsSvc.normalizeRichHtml(this.portalsCmsSvc.normalizeTempTokens(control.value, this.authSvc.getTempToken(this.content.Privileges)));
				}
				else {
					switch (control.Name) {
						case "Status":
							control.value = await this.appFormsSvc.getResourceAsync(`status.approval.${control.value}`);
							break;

						case "CategoryID":
							let mainCategory = Category.get(this.content.CategoryID);
							if (mainCategory === undefined) {
								await this.portalsCmsSvc.getCategoryAsync(this.content.CategoryID, _ => mainCategory = Category.get(this.content.CategoryID), undefined, true);
							}
							if (mainCategory !== undefined) {
								control.value = mainCategory.FullTitle;
							}
							break;

						case "OtherCategories":
							control.Type = "TextArea";
							control.value = "";
							if (AppUtility.isArray(this.content.OtherCategories, true)) {
								let otherCategories = "";
								await Promise.all(this.content.OtherCategories.map(async id => {
									let otherCategory = Category.get(id);
									if (otherCategory === undefined) {
										await this.portalsCmsSvc.getCategoryAsync(id, _ => otherCategory = Category.get(id), undefined, true);
									}
									if (otherCategory !== undefined) {
										otherCategories += `<li>${otherCategory.FullTitle}</li>`;
									}
								}));
								control.value = `<ul>${otherCategories}</ul>`;
							}
							break;

						case "AllowComments":
							control.Hidden = !this.content.contentType.AllowComments;
							break;

						case "Summary":
							control.value = AppUtility.normalizeHtml(control.value, true);
							break;

						case "Relateds":
							control.Type = "TextArea";
							control.value = "";
							if (AppUtility.isArray(this.content.Relateds, true)) {
								let relateds = "";
								await Promise.all(this.content.Relateds.map(async id => {
									let content = Content.get(id);
									if (content === undefined) {
										await this.portalsCmsSvc.getContentAsync(id, _ => content = Content.get(id), async _ => await this.portalsCmsSvc.getContentAsync(id, __ => content = Content.get(id), undefined, true), true);
									}
									if (content !== undefined) {
										relateds += `<li>${content.Title}</li>`;
									}
								}));
								control.value = `<ul>${relateds}</ul>`;
							}
							break;

						case "ExternalRelateds":
							control.Type = "TextArea";
							control.value = "";
							if (AppUtility.isArray(this.content.ExternalRelateds, true)) {
								let relateds = "";
								this.content.ExternalRelateds.forEach(related => relateds += `<li><a href="${related.URL}" target=\"_blank\">${related.Title}</a></li>`);
								control.value = `<ul>${relateds}</ul>`;
							}
							break;
					}
				}
			}
			else if (control.Name === "PublicLink") {
				this.portalsCoreSvc.fetchDesktops(this.content.SystemID, () => this.setPublicURL(2345, () => this.setPublicURL()));
			}
		});
	}

	private setPublicURL(defer?: number, onUndefined?: () => void) {
		AppUtility.invoke(() => {
			const url = this.portalsCoreSvc.getPublicURL(this.content, this.content.category);
			if (AppUtility.isNotEmpty(url)) {
				const control = this.formControls.find(ctrl => ctrl.Name === "PublicLink");
				control.Extras["Text"] = url;
				control.Hidden = false;
				this.formControls.find(ctrl => ctrl.Name === "TempLink").Extras["Text"] = this.portalsCoreSvc.getPortalURL(this.content, this.content.category, true);
			}
			else if (onUndefined !== undefined) {
				onUndefined();
			}
		}, defer || 6789);
	}

	private prepareAttachments(name: string, attachments?: Array<AttachmentInfo>, addedOrUpdated?: AttachmentInfo, deleted?: AttachmentInfo) {
		const formControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, name));
		const isThumbnails = AppUtility.isEquals(name, "Thumbnails");
		this.filesSvc.prepareAttachmentsFormControl(formControl, isThumbnails, attachments, addedOrUpdated, deleted, control => {
			control.Hidden = control.value === undefined;
			if (isThumbnails) {
				this.formControls.find(ctrl => ctrl.Name === "ThumbnailButtons").Hidden = control.Hidden;
			}
		});
	}

	showActions() {
		this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async openSchedulingTaskAsync() {
		if (this.scheduled || this.content.Status !== "Published") {
			await this.appFormsSvc.showModalAsync(ScheduledPublishModalPage, { taskID: this.schedulingTask !== undefined ? this.schedulingTask.ID : undefined, object: this.content });
		}
		else {
			await this.configSvc.navigateForwardAsync(await this.portalsCmsSvc.getSchedulingTaskURLAsync(this.content));
		}
	}

	update() {
		this.configSvc.navigateForwardAsync(this.content.routerURI.replace("/view/", "/update/"));
	}

	moderate() {
		const availableStatuses = ["Draft", "Pending"];
		if (this.canEdit) {
			availableStatuses.push("Rejected", "Approved");
		}
		if (this.canModerate) {
			availableStatuses.push("Published", "Archieved");
		}
		const currentStatus = availableStatuses.indexOf(this.content.Status) > -1 ? this.content.Status : "Draft";
		this.portalsCoreSvc.showApprovalDialogAsync(this.content.contentType.ID, this.content.ID, currentStatus, availableStatuses);
	}

	viewVersions() {
		this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(this.content.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "CMS.Content", id: this.content.ID }));
	}

	delete() {
		AppUtility.invoke(async () => {
			const title = await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete");
			const button = await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.remove");
			const confirm = await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.delete");
			const success = await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.delete");
			this.appFormsSvc.showConfirmAsync(
				confirm,
				() => this.appFormsSvc.showLoadingAsync(title).then(() => this.portalsCmsSvc.deleteContentAsync(
					this.content.ID,
					data => {
						AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: data.CategoryID });
						if (AppUtility.isArray(data.OtherCategories)) {
							(data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: categoryID }));
						}
						this.trackAsync(title, "Delete").then(() => this.appFormsSvc.showToastAsync(success)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
					},
					error => this.trackAsync(title, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
				)),
				button,
				"{{default}}"
			);
		});
	}

	deleteThumbnail() {
		AppUtility.invoke(async () => {
			const button = await this.configSvc.getResourceAsync("common.buttons.delete");
			const confirm = await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.deleteThumbnail");
			this.appFormsSvc.showConfirmAsync(
				confirm,
				() => this.filesSvc.deleteThumbnailAsync(
					this.content.thumbnails[0].ID,
					() => {
						this.prepareAttachments("Thumbnails", [], undefined, this.content.thumbnails[0]);
						this.content.thumbnails.removeAll();
						this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail");
					},
					error => this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail").then(() => this.appFormsSvc.showErrorAsync(error)),
					this.portalsCoreSvc.getPortalFileHeaders(this.content)
				),
				button,
				"{{default}}"
			);
		});
	}

	cancel() {
		this.configSvc.navigateBackAsync();
	}

	private view() {
		const url = this.portalsCoreSvc.getPublicURL(this.content, this.content.category);
		if (AppUtility.isNotEmpty(url)) {
			if (this.content.Status === "Published") {
				PlatformUtility.openURL(url);
			}
			else {
				PlatformUtility.openURL(`${url}${url.indexOf("?") > 0 ? "&" : "?"}x-app-token=${this.configSvc.appConfig.jwt}`);
			}
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Content", action: action || "View" });
	}

}
