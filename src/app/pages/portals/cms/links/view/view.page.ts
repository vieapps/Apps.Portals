import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { NestedObject } from "@app/models/portals.base";
import { Module, ContentType } from "@app/models/portals.core.all";
import { Link, Category } from "@app/models/portals.cms.all";

@Component({
	selector: "page-portals-cms-links-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsLinksViewPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	private link: Link;
	canModerate = false;
	canEdit = false;
	title = {
		page: "Link",
		track: "Link"
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
			raw: this.link !== undefined ? this.link.Status : "Draft",
			normalized: control !== undefined ? control.value as string : this.link !== undefined ? this.link.Status : "Draft"
		};
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		AppEvents.off(this.portalsCoreSvc.name, "CMS.Links:View:Refresh");
		AppEvents.off(this.filesSvc.name, "CMS.Links:View:Refresh");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.title.track = await this.configSvc.getResourceAsync("portals.cms.links.title.view");

		const linkID = this.configSvc.requestParams["ID"];
		this.link = Link.get(linkID);
		if (this.link === undefined) {
			await this.portalsCmsSvc.getLinkAsync(linkID, _ => this.link = Link.get(linkID), undefined, true);
		}

		if (this.link === undefined) {
			await Promise.all([
				this.trackAsync(`${this.title.track} | No Content`, "Check"),
				this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync("Hmmmmmm....")),
				this.configSvc.navigateBackAsync()
			]);
			return;
		}

		let canView = false;
		const account = this.configSvc.getAccount();
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.link.organization, account) || this.portalsCmsSvc.canModerate(this.link, account);

		if (AppUtility.isEquals(this.link.Status, "Draft") || AppUtility.isEquals(this.link.Status, "Pending") || AppUtility.isEquals(this.link.Status, "Rejected")) {
			this.canEdit = canView = this.canModerate || this.portalsCmsSvc.canEdit(this.link, account) || AppUtility.isEquals(this.link.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.link.Status, "Approved")) {
			this.canEdit = this.canModerate;
			canView = this.canEdit || this.portalsCmsSvc.canEdit(this.link, account) || AppUtility.isEquals(this.link.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.link.Status, "Published")) {
			this.canEdit = this.canModerate;
			canView = this.portalsCmsSvc.canView(this.link, account);
		}
		else {
			this.canEdit = canView = this.canModerate;
		}

		if (!canView) {
			await Promise.all([
				this.trackAsync(`${this.title.track} | No Permission`, "Check"),
				this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync("Hmmmmmm....")),
				this.configSvc.navigateBackAsync()
			]);
			return;
		}

		this.configSvc.appTitle = this.title.page = this.title.track + ` [${this.link.FullTitle}]`;
		if (this.link.Versions === undefined) {
			this.portalsCoreSvc.findVersions("CMS.Link", this.link.ID);
		}

		this.resources = {
			status: await this.configSvc.getResourceAsync("portals.cms.links.controls.Status.label"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			moderate: await this.configSvc.getResourceAsync("common.buttons.approve"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			delete: await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.delete"),
			deleteThumbnail: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.deleteThumbnail")
		};

		if (this.canEdit) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(this.resources.update, "create", () => this.update()),
				this.appFormsSvc.getActionSheetButton(this.resources.moderate, "checkmark-done", () => this.moderate()),
				this.appFormsSvc.getActionSheetButton(this.resources.versions, "layers-outline", () => this.viewVersions()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("portals.tasks.scheduled.update.action"), "timer", () => this.createSchedulingTaskAsync()),
				this.appFormsSvc.getActionSheetButton(this.resources.delete, "trash", () => this.delete())
			];
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track);

		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "CMS.Link" && this.link.ID === info.args.ID) {
				if (info.args.Type === "Updated") {
					this.formControls.filter(control => control.Hidden).forEach(control => control.Hidden = this.formConfig.find(cfg => AppUtility.isEquals(cfg.Name, control.Name)).Hidden ? true : false);
					this.prepareValues();
				}
				else if (info.args.Type === "Deleted") {
					this.cancel();
				}
			}
		}, "CMS.Links:View:Refresh");

		AppEvents.on(this.filesSvc.name, info => {
			if (this.link.ID === info.args.ObjectID && (info.args.Object === "Attachment" || info.args.Object === "Thumbnail")) {
				this.prepareAttachments(`${info.args.Object}s`, undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
			}
		}, "CMS.Links:View:Refresh");
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: Array<AppFormsSegment>) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.basic")),
			new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.link", undefined, { "x-content-type-id": this.link.RepositoryEntityID, "x-view-controls": "x" });
		formConfig.push(
			this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments")
		);
		if (this.canEdit) {
			const buttons = this.appFormsSvc.getButtonControls(
				"attachments",
				{
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
				}
			);
			buttons.Name = "ThumbnailButtons";
			formConfig.push(buttons);
		}

		formConfig.push(
			this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label")),
			this.portalsCoreSvc.getAuditFormControl(this.link, "basic")
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "URL"));
		control.Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURL(AppUtility.isNotEmpty(formControl.value) ? formControl.value.replace("~/", `${this.configSvc.appConfig.URIs.portals}~${this.link.organization.Alias}/`) : undefined)
		};

		formConfig.forEach((ctrl, index) => ctrl.Order = index);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
		control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
		control.Segment = "basic";
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
		this.appFormsSvc.hideLoadingAsync(() => {
			if (this.link.thumbnails !== undefined) {
				this.prepareAttachments("Thumbnails", this.link.thumbnails);
			}
			else {
				this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.link), thumbnails => {
					this.link.updateThumbnails(thumbnails);
					this.prepareAttachments("Thumbnails", thumbnails);
				});
			}
			if (this.link.attachments !== undefined) {
				this.prepareAttachments("Attachments", this.link.attachments);
			}
			else {
				this.filesSvc.searchAttachmentsAsync(this.portalsCmsSvc.getFileOptions(this.link), attachments => {
					this.link.updateAttachments(attachments);
					this.prepareAttachments("Attachments", attachments);
				});
			}
		});
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

	private prepareValues() {
		this.formControls.filter(ctrl => !ctrl.Hidden && ctrl.Name !== "Thumbnails" && ctrl.Name !== "Attachments" && ctrl.Name !== "Buttons" && ctrl.Name !== "ThumbnailButtons").forEach(async control => {
			control.value = AppUtility.isEquals(control.Name, "Audits")
				? await this.portalsCoreSvc.getAuditInfoAsync(this.link)
				: this.link[control.Name];
				control.Hidden = AppUtility.isEmpty(control.value);
				if (!control.Hidden) {
				if (AppUtility.isEquals(control.Type, "TextEditor")) {
					control.value = this.portalsCmsSvc.normalizeRichHtml(control.value);
				}
				else {
					let link: Link;
					let module: Module;
					let contentType: ContentType;
					switch (control.Name) {
						case "Status":
							control.value = await this.appFormsSvc.getResourceAsync(`status.approval.${control.value}`);
							break;

						case "Summary":
							control.value = AppUtility.normalizeHtml(control.value, true);
							break;

						case "ChildrenMode":
							control.value = await this.appFormsSvc.getResourceAsync(`portals.cms.links.controls.ChildrenMode.${control.value}`);
							break;

						case "ParentID":
							link = this.link.Parent;
							if (link === undefined) {
								await this.portalsCmsSvc.getLinkAsync(this.link.ParentID, _ => link = Link.get(this.link.ParentID), undefined, true);
							}
							if (link !== undefined) {
								control.value = link.FullTitle;
							}
							break;

						case "LookupRepositoryID":
							module = Module.get(this.link.RepositoryID);
							if (module === undefined) {
								await this.portalsCoreSvc.getModuleAsync(this.link.RepositoryID, _ => module = Module.get(this.link.RepositoryID), undefined, true);
							}
							if (module !== undefined) {
								control.value = module.Title;
							}
							break;

						case "LookupRepositoryEntityID":
							contentType = ContentType.get(this.link.LookupRepositoryEntityID);
							if (contentType === undefined) {
								await this.portalsCoreSvc.getContentTypeAsync(this.link.LookupRepositoryEntityID, _ => contentType = ContentType.get(this.link.LookupRepositoryEntityID), undefined, true);
							}
							if (contentType !== undefined) {
								control.value = contentType.Title;
							}
							break;

						case "LookupRepositoryObjectID":
							let nestedObject: NestedObject = Link.get(control.value) || Category.get(control.value);
							if (nestedObject === undefined) {
								if (contentType === undefined || contentType.ID !== this.link.LookupRepositoryEntityID) {
									contentType = ContentType.get(this.link.LookupRepositoryEntityID);
								}
								if (contentType === undefined) {
									await this.portalsCoreSvc.getContentTypeAsync(this.link.LookupRepositoryEntityID, _ => contentType = ContentType.get(this.link.LookupRepositoryEntityID), undefined, true);
								}
								if (contentType !== undefined) {
									await this.portalsCmsSvc.getAsync(contentType.getObjectName(true), this.link.LookupRepositoryObjectID, data => nestedObject = data);
								}
							}
							if (nestedObject !== undefined) {
								control.value = nestedObject.FullTitle || nestedObject.Title;
							}
							break;
					}
				}
			}
		});
	}

	showActions() {
		this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async createSchedulingTaskAsync() {
		await this.configSvc.navigateForwardAsync(await this.portalsCmsSvc.getSchedulingTaskURLAsync(this.link));
	}

	update() {
		this.configSvc.navigateForwardAsync(this.link.routerURI.replace("/view/", "/update/"));
	}

	moderate() {
		const availableStatuses = ["Draft", "Pending"];
		if (this.canEdit) {
			availableStatuses.push("Rejected", "Approved");
		}
		if (this.canModerate) {
			availableStatuses.push("Published", "Archieved");
		}
		const currentStatus = availableStatuses.indexOf(this.link.Status) > -1 ? this.link.Status : "Draft";
		this.portalsCoreSvc.showApprovalDialogAsync(this.link.contentType.ID, this.link.ID, currentStatus, availableStatuses);
	}

	viewVersions() {
		this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(this.link.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "CMS.Link", id: this.link.ID }));
	}

	delete() {
		AppUtility.invoke(async () => {
			const deleteButton = await this.configSvc.getResourceAsync("common.buttons.delete");
			const removeButton = await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.delete");
			const cancelButton = await this.configSvc.getResourceAsync("common.buttons.cancel");
			const deleteMessage = await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.delete");
			const removeMessage = this.link.childrenIDs === undefined || this.link.childrenIDs.length < 1 ? undefined : await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.remove");
			const successMessage = await this.configSvc.getResourceAsync("portals.cms.links.update.messages.success.delete");
			const inputs = this.link.childrenIDs === undefined || this.link.childrenIDs.length < 1 ? undefined : [
				{
					type: "radio",
					label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete-all"),
					value: "delete",
					checked: false
				},
				{
					type: "radio",
					label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.set-null-all"),
					value: "set-null",
					checked: true
				}
			];
			this.appFormsSvc.showConfirmAsync(
				deleteMessage,
				() => this.appFormsSvc.showAlertAsync(
					undefined,
					deleteMessage,
					removeMessage,
					mode => {
						this.appFormsSvc.showLoadingAsync(removeButton).then(() => this.portalsCmsSvc.deleteLinkAsync(
							this.link.ID,
							_ => this.trackAsync(this.title.track, "Delete")
								.then(() => this.appFormsSvc.showToastAsync(successMessage))
								.then(() => this.appFormsSvc.hideLoadingAsync()),
							error => this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showErrorAsync(error)),
							{ "x-children": mode }
						));
					},
					removeButton,
					cancelButton,
					inputs
				),
				deleteButton,
				cancelButton
			);
		});
	}

	deleteThumbnail() {
		AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.deleteThumbnail"),
			() => this.filesSvc.deleteThumbnailAsync(
				this.link.thumbnails[0].ID,
				() => {
					this.prepareAttachments("Thumbnails", [], undefined, this.link.thumbnails[0]);
					this.link.thumbnails.removeAll();
					this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail");
				},
				error => this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail").then(() => this.appFormsSvc.showErrorAsync(error)),
				this.portalsCoreSvc.getPortalFileHeaders(this.link)
			),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			"{{default}}"
		));
	}

	cancel() {
		this.configSvc.navigateBackAsync();
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Link", action: action || "View" });
	}

}
