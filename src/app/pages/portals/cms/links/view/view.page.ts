import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { FilesService } from "@services/files.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { AttachmentInfo } from "@models/base";
import { INestedObject } from "@models/portals.base";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Link } from "@models/portals.cms.link";
import { Category } from "@models/portals.cms.category";

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
		return control !== undefined
			? control.value
			: this.link !== undefined
				? this.link.Status
				: "Draft";
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.link !== undefined) {
			AppEvents.off(this.portalsCoreSvc.name, "CMS.Links:View:Refresh");
			AppEvents.off(this.filesSvc.name, "CMS.Links:View:Refresh");
		}
	}

	private async initializeAsync() {
		this.title = await this.configSvc.getResourceAsync("portals.cms.links.title.view");
		const linkID = this.configSvc.requestParams["ID"];
		this.link = Link.get(linkID);
		if (this.link === undefined) {
			await this.portalsCmsSvc.getLinkAsync(linkID, _ => this.link = Link.get(linkID), undefined, true);
		}

		if (this.link === undefined) {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
			return;
		}

		let canView = false;
		const account = this.configSvc.getAccount();
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.link.Organization, account) || this.portalsCmsSvc.canModerate(this.link, account);

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
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
			return;
		}

		await this.appFormsSvc.showLoadingAsync(this.title);
		this.configSvc.appTitle = this.title = this.title + ` [${this.link.FullTitle}]`;

		this.resources = {
			status: await this.configSvc.getResourceAsync("portals.cms.links.controls.Status.label"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			moderate: await this.configSvc.getResourceAsync("common.buttons.moderate"),
			delete: await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.delete")
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
			if (info.args.Object === "CMS.Link" && this.link.ID === info.args.ID) {
				if (info.args.Type === "Updated") {
					this.formControls.filter(control => control.Hidden).forEach(control => control.Hidden = this.formConfig.find(cfg => AppUtility.isEquals(cfg.Name, control.Name)).Hidden ? true : false);
					this.prepareValues();
				}
				else if (info.args.Type === "Deleted") {
					this.cancelAsync();
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
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.link");
		formConfig.push(
			this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments"),
			this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label")),
			this.portalsCoreSvc.getAuditFormControl(this.link, "basic")
		);

		formConfig.forEach((ctrl, index) => ctrl.Order = index);

		const control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
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
		this.filesSvc.prepareAttachmentsFormControl(formControl, isThumbnails, attachments, addedOrUpdated, deleted, control => control.Hidden = control.value === undefined);
	}

	private prepareValues() {
		this.formControls.filter(control => !control.Hidden && !AppUtility.isEquals(control.Name, "Thumbnails") && !AppUtility.isEquals(control.Name, "Attachments") && !AppUtility.isEquals(control.Name, "Buttons")).forEach(async control => {
			control.value = AppUtility.isEquals(control.Name, "Audits")
				? await this.portalsCoreSvc.getAuditInfoAsync(this.link)
				: this.link[control.Name];
			control.Hidden = control.value === undefined;
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
							let nestedObject: INestedObject = Link.get(control.value) || Category.get(control.value);
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

	async showActionsAsync() {
		await this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async updateAsync() {
		await this.configSvc.navigateForwardAsync(this.link.routerURI.replace("/view/", "/update/"));
	}

	async moderateAsync() {
		await this.configSvc.navigateForwardAsync(this.link.routerURI.replace("/view/", "/update/"));
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.delete"),
			undefined,
			() => PlatformUtility.invoke(async () => await this.removeAsync(), 123),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async removeAsync() {
		const modes = [
			{
				label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete-all"),
				value: "delete"
			},
			{
				label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.set-null-all"),
				value: "set-null"
			}
		];
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.delete"),
			await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.remove"),
			async mode => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.delete"));
				await this.portalsCmsSvc.deleteLinkAsync(
					this.link.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Link", Type: "Deleted", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.links.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error)),
					{ "x-children": mode }
				);
			},
			await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			this.link.childrenIDs === undefined || this.link.childrenIDs.length < 1 ? undefined : modes.map(mode => {
				return {
					type: "radio",
					label: mode.label,
					value: mode.value,
					checked: mode.value === "delete"
				};
			})
		);
	}

	async cancelAsync() {
		await this.configSvc.navigateBackAsync();
	}

}
