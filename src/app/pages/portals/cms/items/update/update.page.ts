import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Item } from "@app/models/portals.cms.item";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-items-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsItemsUpdatePage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private item: Item;
	private canModerate = false;
	private hash = {
		content: "",
		full: ""
	};

	title = {
		page: "Item",
		track: "Item"
	};
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
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

	ngOnDestroy() {
		if (AppUtility.isNotEmpty(this.item.ID)) {
			AppEvents.off(this.filesSvc.name, "CMS.Items:Edit:Refresh");
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const itemID = this.configSvc.requestParams["ID"];
		if (AppUtility.isNotEmpty(itemID)) {
			this.item = Item.get(itemID);
			if (this.item === undefined) {
				await this.portalsCmsSvc.getItemAsync(itemID, _ => this.item = Item.get(itemID), undefined, true);
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

		this.title.track = await this.configSvc.getResourceAsync(`portals.cms.contents.title.${(this.item !== undefined && AppUtility.isNotEmpty(this.item.ID) ? "update" : "create")}`);

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

		this.item = this.item || new Item(this.organization.ID, this.module.ID, this.contentType.ID);
		this.configSvc.appTitle = this.title.page = this.title.track + (AppUtility.isNotEmpty(this.item.ID) ? ` [${this.item.Title}]` : "");
		this.trackAsync(this.title.track);

		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.item.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();

		if (AppUtility.isNotEmpty(this.item.ID)) {
			AppEvents.on(this.filesSvc.name, info => {
				if (info.args.Object === "Attachment" && this.item.ID === info.args.ObjectID) {
					this.prepareAttachments("Attachments", undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
				}
			}, "CMS.Items:Edit:Refresh");
		}
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: Array<AppFormsSegment>) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.basic"))
		];
		if (AppUtility.isNotEmpty(this.item.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.item", undefined, { "x-content-type-id": this.contentType.ID });

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		this.portalsCoreSvc.prepareApprovalStatusControl(control, "popover");
		if (!this.canModerate) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AllowComments"));
		control.Options.Type = "toggle";
		control.Hidden = !this.contentType.AllowComments;

		const linkSelectorOptions = {
			content: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.content"),
				sortBy: { Created: "Descending" },
				preProcess: (objects: Array<any>) => objects.forEach(object => Item.update(object))
			},
			file: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.file")
			}
		};
		const linkSelector = this.portalsCmsSvc.getLinkSelector(this.item, DataLookupModalPage, linkSelectorOptions);
		const mediaSelector = this.portalsCmsSvc.getMediaSelector(this.item, await this.appFormsSvc.getResourceAsync("portals.cms.common.links.media"));

		formConfig.filter(ctrl => AppUtility.isEquals(ctrl.Type, "TextEditor")).forEach(ctrl => {
			ctrl.Extras["ckEditorLinkSelector"] = linkSelector;
			ctrl.Extras["ckEditorMediaSelector"] = mediaSelector;
			ctrl.Extras["ckEditorSimpleUpload"] = AppUtility.isNotEmpty(this.item.ID) ? this.portalsCmsSvc.getFileHeaders(this.item) : undefined;
			ctrl.Extras["ckEditorTrustedHosts"] = this.configSvc.appConfig.URIs.medias;
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		if (!control.Hidden) {
			control.Options.AutoFocus = true;
		}

		if (AppUtility.isNotEmpty(this.item.ID)) {
			formConfig.push(
				this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments", true, true, controlConfig => controlConfig.Options.FilePickerOptions.OnDelete = (_, formControl) => {
					formControl.setValue({ current: AppUtility.isObject(formControl.value, true) ? formControl.value.current : undefined, new: undefined, identity: AppUtility.isObject(formControl.value, true) ? formControl.value.identity : undefined }, { onlySelf: true });
					this.hash.full = AppCrypto.hash(this.form.value);
				}),
				this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label"), false, true, true, FilesProcessorModalPage),
				this.portalsCmsSvc.getUploadFormControl(this.item, "attachments"),
				this.portalsCmsSvc.getPermanentLinkFormControl(this.item, "basic"),
				this.portalsCoreSvc.getAuditFormControl(this.item, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
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
					}
				)
			);
		}
		else {
			formConfig.push(this.filesSvc.getThumbnailFormControl("Thumbnails", "basic", true, true));
		}

		formConfig.forEach((ctrl, index) => {
			ctrl.Order = index;
			if (ctrl.Options) {
				ctrl.Options.Label = ctrl.Options.Label ? ctrl.Options.Label.replace("portals.cms.items", "portals.cms.contents") : undefined;
				ctrl.Options.Description = ctrl.Options.Description ? ctrl.Options.Description.replace("portals.cms.items", "portals.cms.contents") : undefined;
				ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder ? ctrl.Options.PlaceHolder.replace("portals.cms.items", "portals.cms.contents") : undefined;
			}
		});

		if (AppUtility.isNotEmpty(this.item.ID)) {
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
			control.Segment = "basic";
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
		this.form.patchValue(AppUtility.clone(this.item, false, undefined, obj => Item.normalizeClonedProperties(this.item, obj)));
		this.hash.content = AppCrypto.hash(this.form.value);

		this.appFormsSvc.hideLoadingAsync(() => {
			if (AppUtility.isNotEmpty(this.item.ID)) {
				if (this.item.thumbnails !== undefined) {
					this.prepareAttachments("Thumbnails", this.item.thumbnails);
					this.hash.full = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.item), thumbnails => {
						this.item.updateThumbnails(thumbnails);
						this.prepareAttachments("Thumbnails", thumbnails);
						this.hash.full = AppCrypto.hash(this.form.value);
					});
				}
				if (this.item.attachments !== undefined) {
					this.prepareAttachments("Attachments", this.item.attachments);
					this.hash.full = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchAttachmentsAsync(this.portalsCmsSvc.getFileOptions(this.item), attachments => {
						this.item.updateAttachments(attachments);
						this.prepareAttachments("Attachments", attachments);
						this.hash.full = AppCrypto.hash(this.form.value);
					});
				}
			}
		});
	}

	private prepareAttachments(name: string, attachments?: Array<AttachmentInfo>, addedOrUpdated?: AttachmentInfo, deleted?: AttachmentInfo, onCompleted?: (control: AppFormsControl) => void) {
		const formControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, name));
		const isThumbnails = AppUtility.isEquals(name, "Thumbnails");
		this.filesSvc.prepareAttachmentsFormControl(formControl, isThumbnails, attachments, addedOrUpdated, deleted, onCompleted);
	}

	save() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash.full === AppCrypto.hash(this.form.value)) {
				this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				this.appFormsSvc.showLoadingAsync(this.title.track);

				const item = this.form.value;
				delete item["Thumbnails"];
				delete item["Attachments"];
				delete item["Upload"];

				if (AppUtility.isNotEmpty(item.ID)) {
					if (this.hash.content === AppCrypto.hash(item)) {
						const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
						if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
							this.filesSvc.uploadThumbnailAsync(
								control.value.new,
								this.portalsCmsSvc.getFileOptions(this.item, options => options.Extras["x-attachment-id"] = control.value.identity),
								() => {
									this.trackAsync(this.title.track, "Upload", "Thumbnail").then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.update")));
									this.portalsCmsSvc.refreshItemAsync(item.ID).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
								},
								error => this.trackAsync(this.title.track, "Upload", "Thumbnail").then(() => this.appFormsSvc.showErrorAsync(error))
							);
						}
						else {
							this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
						}
					}
					else {
						this.portalsCmsSvc.updateItemAsync(
							item,
							async data => {
								const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
								if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
									await this.filesSvc.uploadThumbnailAsync(control.value.new, this.portalsCmsSvc.getFileOptions(this.item, options => options.Extras["x-attachment-id"] = control.value.identity));
								}
								AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Item", Type: "Updated", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID });
								await this.trackAsync(this.title.track, "Update");
								await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.update"));
								await this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
							},
							error => this.trackAsync(this.title.track, "Update").then(() => this.appFormsSvc.showErrorAsync(error))
						);
					}
				}
				else {
					item.Alias = AppUtility.toANSI(this.item.Title, true);
					this.portalsCmsSvc.createItemAsync(
						item,
						async data => {
							const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
							if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
								await this.filesSvc.uploadThumbnailAsync(control.value.new, this.portalsCmsSvc.getFileOptions(Item.get(data.ID)));
							}
							AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Item", Type: "Created", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID });
							await this.trackAsync(this.title.track);
							await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.new"));
							await this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
						},
						error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error))
					);
				}
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
				() => this.appFormsSvc.showLoadingAsync(deleteButton).then(() => this.portalsCmsSvc.deleteItemAsync(
					this.item.ID,
					data => {
						AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Item", Type: "Deleted", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID });
						this.trackAsync(deleteButton, "Delete").then(() => this.appFormsSvc.showToastAsync(successMessage)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
					},
					error => this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
				)),
				removeButton,
				"{{default}}"
			);
		});
	}

	cancel(message?: string, url?: string) {
		if (message === undefined && this.hash.full === AppCrypto.hash(this.form.value)) {
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
		return TrackingUtility.trackAsync({ title: title, category: category || "Item", action: action || (this.item !== undefined && AppUtility.isNotEmpty(this.item.ID) ? "Edit" : "Create") });
	}

}
