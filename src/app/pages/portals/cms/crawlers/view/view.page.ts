import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { Crawler } from "@app/models/portals.cms.crawler";

@Component({
	selector: "page-portals-cms-crawlers-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class CmsCrawlersViewPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	private crawler: Crawler;
	canModerate = false;
	canEdit = false;
	processing = false;
	title = {
		page: "Crawler",
		track: "Crawler"
	};
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		crawlers: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
	formControls = new Array<AppFormsControl>();
	resources = {
		status: "Status",
		update: "Update",
		moderate: "Moderate",
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
			raw: this.crawler !== undefined ? this.crawler.Status : "Draft",
			normalized: control !== undefined ? control.value as string : this.crawler !== undefined ? this.crawler.Status : "Draft"
		};
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.crawler !== undefined) {
			AppEvents.off(this.portalsCoreSvc.name, "CMS.Crawlers:View:Refresh");
			AppEvents.off(this.filesSvc.name, "CMS.Crawlers:View:Refresh");
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const crawlerID = this.configSvc.requestParams["ID"];
		this.crawler = Crawler.get(crawlerID);
		if (this.crawler === undefined) {
			await this.portalsCmsSvc.getCrawlerAsync(crawlerID, _ => this.crawler = Crawler.get(crawlerID), undefined, true);
		}

		this.title.track = await this.configSvc.getResourceAsync("portals.cms.contents.title.view");

		if (this.crawler === undefined) {
			this.trackAsync(`${this.title.track} | No Content`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		let canView = false;
		const account = this.configSvc.getAccount();
		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.crawler.organization, account) || this.portalsCmsSvc.canModerate(this.crawler, account);

		if (AppUtility.isEquals(this.crawler.Status, "Draft") || AppUtility.isEquals(this.crawler.Status, "Pending") || AppUtility.isEquals(this.crawler.Status, "Rejected")) {
			this.canEdit = canView = this.canModerate || this.portalsCmsSvc.canEdit(this.crawler, account) || AppUtility.isEquals(this.crawler.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.crawler.Status, "Approved")) {
			this.canEdit = this.canModerate || this.portalsCmsSvc.canEdit(this.crawler, account);
			canView = this.canEdit || AppUtility.isEquals(this.crawler.CreatedID, account.id);
		}
		else if (AppUtility.isEquals(this.crawler.Status, "Published")) {
			this.canEdit = this.canModerate || this.portalsCmsSvc.canEdit(this.crawler, account);
			canView = this.portalsCmsSvc.canView(this.crawler, account);
		}
		else {
			this.canEdit = canView = this.canModerate;
		}

		if (!canView) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.configSvc.appTitle = this.title.page = this.title.track + ` [${this.crawler.Title}]`;

		this.resources = {
			status: await this.configSvc.getResourceAsync("portals.cms.contents.controls.Status.label"),
			update: await this.configSvc.getResourceAsync("common.buttons.update"),
			moderate: await this.configSvc.getResourceAsync("common.buttons.approve"),
			delete: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete"),
			deleteThumbnail: await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.deleteThumbnail")
		};

		if (this.canEdit) {
			this.actions = [
				this.appFormsSvc.getActionSheetButton(this.resources.update, "create", () => this.update()),
				this.appFormsSvc.getActionSheetButton(this.resources.moderate, "checkmark-done", () => this.moderate()),
				this.appFormsSvc.getActionSheetButton(this.resources.delete, "trash", () => this.delete())
			];
		}

		this.formSegments.crawlers = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track);

		AppEvents.on(this.portalsCoreSvc.name, info => {
			const args = info.args;
			if (args.Object === "CMS.Crawler" && this.crawler.ID === args.ID) {
				if (args.Type === "Updated") {
					this.formControls.filter(control => control.Hidden).forEach(control => control.Hidden = this.formConfig.find(cfg => cfg.Name === control.Name).Hidden ? true : false);
					this.prepareValues();
				}
				else if (args.Type === "Deleted" && !this.processing) {
					this.cancel();
				}
			}
		}, "CMS.Crawlers:View:Refresh");

		AppEvents.on(this.filesSvc.name, info => {
			const args = info.args;
			if (this.crawler.ID === args.ObjectID && (args.Object === "Attachment" || args.Object === "Thumbnail")) {
				this.prepareAttachments(`${args.Object}s`, undefined, args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(args.Data), args.Event === "Delete" ? this.filesSvc.prepareAttachment(args.Data) : undefined);
			}
		}, "CMS.Crawlers:View:Refresh");
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
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.crawler", undefined, { "x-content-type-id": this.crawler.RepositoryEntityID, "x-view-controls": "x" });
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
			this.portalsCmsSvc.getPermanentLinkFormControl(this.crawler, "basic"),
			this.portalsCoreSvc.getAuditFormControl(this.crawler, "basic")
		);

		formConfig.forEach((ctrl, index) => {
			ctrl.Order = index;
			if (ctrl.Options) {
				ctrl.Options.Label = ctrl.Options.Label ? ctrl.Options.Label.replace("portals.cms.crawlers", "portals.cms.contents") : undefined;
				ctrl.Options.Description = ctrl.Options.Description ? ctrl.Options.Description.replace("portals.cms.crawlers", "portals.cms.contents") : undefined;
				ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder ? ctrl.Options.PlaceHolder.replace("portals.cms.crawlers", "portals.cms.contents") : undefined;
			}
		});

		const control = formConfig.find(ctrl => ctrl.Name === "ID");
		control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
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
			if (this.crawler.thumbnails !== undefined) {
				this.prepareAttachments("Thumbnails", this.crawler.thumbnails);
			}
			else {
				this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.crawler), thumbnails => {
					this.crawler.updateThumbnails(thumbnails);
					this.prepareAttachments("Thumbnails", thumbnails);
				});
			}
			if (this.crawler.attachments !== undefined) {
				this.prepareAttachments("Attachments", this.crawler.attachments);
			}
			else {
				this.filesSvc.searchAttachmentsAsync(this.portalsCmsSvc.getFileOptions(this.crawler), attachments => {
					this.crawler.updateAttachments(attachments);
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
				? await this.portalsCoreSvc.getAuditInfoAsync(this.crawler)
				: this.crawler[control.Name];
			control.Hidden = AppUtility.isEmpty(control.value);
			if (!control.Hidden) {
				if (control.Type === "TextEditor") {
					control.value = this.portalsCmsSvc.normalizeRichHtml(control.value);
				}
				else if (control.Type === "TextArea") {
					control.value = (control.value || "").replaceAll("\r", "").replaceAll("\n", "<br/>");
				}
				else {
					switch (control.Name) {
						case "Status":
							control.value = await this.appFormsSvc.getResourceAsync(`status.approval.${control.value}`);
							break;

						case "AllowComments":
							control.Hidden = !this.crawler.contentType.AllowComments;
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
		this.configSvc.navigateForwardAsync(this.crawler.routerURI.replace("/view/", "/update/"));
	}

	moderate() {
		const availableStatuses = ["Draft", "Pending"];
		if (this.canEdit) {
			availableStatuses.push("Rejected", "Approved");
		}
		if (this.canModerate) {
			availableStatuses.push("Published", "Archieved");
		}
		const currentStatus = availableStatuses.indexOf(this.crawler.Status) > -1 ? this.crawler.Status : "Draft";
		this.portalsCoreSvc.showApprovalDialogAsync(this.crawler.contentType.ID, this.crawler.ID, currentStatus, availableStatuses);
	}

	delete() {
		AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.delete"),
			async () => {
				this.processing = true;
				this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.delete")).then(() => this.portalsCmsSvc.deleteCrawlerAsync(
					this.crawler.ID,
					() => this.trackAsync(this.resources.delete, "Delete")
						.then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.delete"))
						.then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())),
					error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.resources.delete, "Delete"))
				)));
			},
			await this.configSvc.getResourceAsync("portals.cms.contents.update.buttons.remove"),
			"{{default}}"
		));
	}

	deleteThumbnail() {
		this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail").then(async () => this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.confirm.deleteThumbnail"),
			undefined,
			() => this.filesSvc.deleteThumbnailAsync(
				this.crawler.thumbnails[0].ID,
				() => {
					this.prepareAttachments("Thumbnails", [], undefined, this.crawler.thumbnails[0]);
					this.crawler.thumbnails.removeAll();
					this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail");
				},
				error => this.appFormsSvc.showErrorAsync(error).then(() => this.trackAsync(this.resources.deleteThumbnail, "Delete", "Thumbnail")),
				this.portalsCoreSvc.getPortalFileHeaders(this.crawler)
			),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		));
	}

	cancel() {
		this.configSvc.navigateBackAsync();
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Crawler", action: action || "View" });
	}

}
