import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Category, Content } from "@app/models/portals.cms.all";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-contents-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsContentsUpdatePage implements OnInit, OnDestroy {

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
	private category: Category;
	private content: Content;
	private canModerate = false;
	private hash = {
		content: "",
		full: ""
	};

	title = {
		page: "Content",
		track: "Content"
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
	button = {
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
		if (AppUtility.isNotEmpty(this.content.ID)) {
			AppEvents.off(this.filesSvc.name, "CMS.Contents:Edit:Refresh");
		}
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const contentID = this.configSvc.requestParams["ID"];
		if (AppUtility.isNotEmpty(contentID)) {
			this.content = Content.get(contentID);
			if (this.content === undefined) {
				await this.portalsCmsSvc.getContentAsync(contentID, _ => this.content = Content.get(contentID), undefined, true);
			}
		}

		this.contentType = this.content !== undefined
			? this.content.contentType
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.content !== undefined
			? this.content.organization
			: this.contentType !== undefined
				? Organization.get(this.contentType.SystemID)
				: await this.portalsCoreSvc.getActiveOrganizationAsync();

		this.title.track = await this.configSvc.getResourceAsync(`portals.cms.contents.title.${this.content !== undefined && AppUtility.isNotEmpty(this.content.ID) ? "update" : "create"}`);
		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check").then(() =>  this.appFormsSvc.hideLoadingAsync());
			this.cancel(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all");
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = this.content !== undefined
				? this.content.contentType
				: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
			if (this.contentType === undefined) {
				this.trackAsync(`${this.title.track} | Invalid Content Type`, "Check").then(() => this.appFormsSvc.hideLoadingAsync());
				this.cancel(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"), "/portals/core/content.types/list/all");
				return;
			}
		}

		this.module = Module.get(this.contentType.RepositoryID);
		this.category = this.content !== undefined ? this.content.category : Category.get(this.configSvc.requestParams["CategoryID"]);

		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Content", this.category !== undefined ? this.category.Privileges : this.module.Privileges);
		let canUpdate = this.canModerate || this.authSvc.isEditor(this.portalsCoreSvc.name, "Content", this.category !== undefined ? this.category.Privileges : this.module.Privileges);
		if (!canUpdate && this.content !== undefined && (AppUtility.isEquals(this.content.Status, "Draft") || AppUtility.isEquals(this.content.Status, "Pending"))) {
			canUpdate = AppUtility.isEquals(this.content.CreatedID, this.configSvc.getAccount().id);
		}

		if (!canUpdate) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.content = this.content || new Content(this.organization.ID, this.module.ID, this.contentType.ID, this.category !== undefined ? this.category.ID : undefined, new Date());
		this.configSvc.appTitle = this.title.page = this.title.track + (AppUtility.isNotEmpty(this.content.ID) ? ` [${this.content.Title}]` : "");

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.content.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track);

		if (AppUtility.isNotEmpty(this.content.ID)) {
			AppEvents.on(this.filesSvc.name, info => {
				if (info.args.Object === "Attachment" && this.content.ID === info.args.ObjectID) {
					this.prepareAttachments("Attachments", undefined, info.args.Event === "Delete" ? undefined : this.filesSvc.prepareAttachment(info.args.Data), info.args.Event === "Delete" ? this.filesSvc.prepareAttachment(info.args.Data) : undefined);
				}
			}, "CMS.Contents:Edit:Refresh");
		}
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: Array<AppFormsSegment>) => void) {
		const formSegments = [
			new AppFormsSegment("management", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.management")),
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.basic")),
			new AppFormsSegment("related", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.related"))
		];
		if (AppUtility.isNotEmpty(this.content.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfCategory(this.module);
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.content", undefined, { "x-content-type-id": this.contentType.ID });

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		this.portalsCoreSvc.prepareApprovalStatusControl(control, "popover");
		if (!this.canModerate) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => ctrl.Name === "CategoryID");
		control.Extras = { LookupDisplayValues: this.category !== undefined ? [{ Value: this.category.ID, Label: this.category.FullTitle }] : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, contentType, false, true, options => {
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = async (data, formControl) => {
				if (AppUtility.isArray(data, true) && data[0].ID !== formControl.value) {
					const category = Category.get(data[0].ID);
					formControl.setValue(category.ID);
					formControl.lookupDisplayValues = [{ Value: category.ID, Label: category.FullTitle }];
				}
			};
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories, true);
		});

		const otherCategories = new Array<AppFormsLookupValue>();
		if (AppUtility.isArray(this.content.OtherCategories, true)) {
			await Promise.all(this.content.OtherCategories.map(async id => {
				let category = Category.get(id);
				if (category === undefined) {
					await this.portalsCmsSvc.getCategoryAsync(id, _ => category = Category.get(id), undefined, true);
				}
				if (category !== undefined) {
					otherCategories.push({ Value: category.ID, Label: category.FullTitle });
				}
			}));
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OtherCategories"));
		control.Extras = { LookupDisplayValues: otherCategories.length > 0 ? otherCategories.sortBy("Label") : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, contentType, true, true, options => {
			options.OnDelete = (data, formControl) => {
				const lookupDisplayValues = formControl.lookupDisplayValues;
				data.forEach(id => lookupDisplayValues.removeAt(lookupDisplayValues.findIndex(item => item.Value === id)));
				formControl.setValue(lookupDisplayValues.sortBy("Label").map(item => item.Value));
				formControl.lookupDisplayValues = lookupDisplayValues;
			};
			options.ModalOptions.OnDismiss = (data, formControl) => {
				if (AppUtility.isArray(data, true)) {
					const lookupDisplayValues = formControl.lookupDisplayValues;
					(data as Array<any>).forEach(info => {
						const category = Category.get(info.ID);
						if (category !== undefined && lookupDisplayValues.findIndex(item => item.Value === category.ID) < 0) {
							lookupDisplayValues.push({ Value: category.ID, Label: category.FullTitle });
						}
					});
					formControl.setValue(lookupDisplayValues.sortBy("Label").map(item => item.Value));
					formControl.lookupDisplayValues = lookupDisplayValues;
				}
			};
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories, true);
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "StartDate"));
		control.Required = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "EndDate"));
		control.Required = false;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "PublishedTime"));
		control.Required = false;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AllowComments"));
		control.Options.Type = "toggle";
		control.Hidden = !this.contentType.AllowComments;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Summary"));
		control.Options.Rows = 5;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "SourceURL"));
		control.Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURL(formControl.value)
		};

		const linkSelectorOptions = {
			content: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.content"),
				sortBy: { StartDate: "Descending", PublishedTime: "Descending" },
				preProcess: (contents: Array<any>) => contents.forEach(data => {
					const content = Content.update(data);
					if (content.category === undefined) {
						this.portalsCmsSvc.getCategoryAsync(content.CategoryID, _ => {
							const category = Category.get(content.CategoryID);
							if (category !== undefined) {
								this.portalsCmsSvc.fetchCategoryDesktops(category);
							}
						});
					}
				})
			},
			file: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.file")
			}
		};
		const linkSelector = this.portalsCmsSvc.getLinkSelector(this.content, DataLookupModalPage, linkSelectorOptions);
		const mediaSelector = this.portalsCmsSvc.getMediaSelector(this.content, await this.appFormsSvc.getResourceAsync("portals.cms.common.links.media"));

		formConfig.filter(ctrl => AppUtility.isEquals(ctrl.Type, "TextEditor")).forEach(ctrl => {
			ctrl.Extras["ckEditorLinkSelector"] = linkSelector;
			ctrl.Extras["ckEditorMediaSelector"] = mediaSelector;
			ctrl.Extras["ckEditorSimpleUpload"] = AppUtility.isNotEmpty(this.content.ID) ? this.portalsCmsSvc.getFileHeaders(this.content) : undefined;
			ctrl.Extras["ckEditorTrustedHosts"] = this.configSvc.appConfig.URIs.medias;
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Details"));
		control.Extras["ckEditorPageBreakIsAvailable"] = true;

		const relateds = new Array<AppFormsLookupValue>();
		if (AppUtility.isArray(this.content.Relateds, true)) {
			await Promise.all(this.content.Relateds.map(async id => {
				let content = Content.get(id);
				if (content === undefined) {
					await this.portalsCmsSvc.getContentAsync(id, _ => content = Content.get(id), undefined, true);
				}
				if (content !== undefined) {
					relateds.push({ Value: content.ID, Label: content.Title });
				}
			}));
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Relateds"));
		control.Extras = { LookupDisplayValues: relateds.length > 0 ? relateds : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.contentType, true, false, options => {
			options.OnDelete = (data, formControl) => {
				const lookupDisplayValues = formControl.lookupDisplayValues;
				data.forEach(id => lookupDisplayValues.removeAt(lookupDisplayValues.findIndex(item => item.Value === id)));
				formControl.setValue(lookupDisplayValues.map(item => item.Value));
				formControl.lookupDisplayValues = lookupDisplayValues;
			};
			options.ModalOptions.OnDismiss = (data, formControl) => {
				if (AppUtility.isArray(data, true)) {
					const lookupDisplayValues = formControl.lookupDisplayValues;
					(data as Array<any>).forEach(info => {
						const content = Content.get(info.ID);
						if (content !== undefined && lookupDisplayValues.findIndex(item => item.Value === content.ID) < 0) {
							lookupDisplayValues.push({ Value: content.ID, Label: content.Title });
						}
					});
					formControl.setValue(lookupDisplayValues.map(item => item.Value));
					formControl.lookupDisplayValues = lookupDisplayValues;
				}
			};
			options.ModalOptions.ComponentProps.excludedIDs = AppUtility.isNotEmpty(this.content.ID) ? [this.content.ID] : undefined;
			options.ModalOptions.ComponentProps.sortBy = { StartDate: "Descending", PublishedTime: "Descending" };
			options.ModalOptions.ComponentProps.preProcess = (contents: Array<any>) => contents.forEach(data => {
				const content = Content.update(data);
				if (content.category === undefined) {
					this.portalsCmsSvc.getCategoryAsync(content.CategoryID, _ => {
						const category = Category.get(content.CategoryID);
						if (category !== undefined) {
							this.portalsCmsSvc.fetchCategoryDesktops(category);
						}
					});
				}
			});
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExternalRelateds"));
		control.SubControls.Controls[0].SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Summary")).Options.Rows = 2;
		control.SubControls.Controls[0].SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "URL")).Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURL(formControl.value)
		};

		if (AppUtility.isArray(this.content.ExternalRelateds, true) && this.content.ExternalRelateds.length > 1) {
			while (control.SubControls.Controls.length <= this.content.ExternalRelateds.length) {
				control.SubControls.Controls.push(this.appFormsSvc.cloneControl(control.SubControls.Controls[0], ctrl => {
					ctrl.Name = `${control.Name}_${control.SubControls.Controls.length}`;
					ctrl.Order = control.SubControls.Controls.length;
				}));
			}
		}
		control.SubControls.Controls.forEach((ctrl, index) => ctrl.Options.Label = `#${index + 1}`);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.content.ID)) {
			formConfig.push(
				this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments", true, true, controlConfig => controlConfig.Options.FilePickerOptions.OnDelete = (_, formControl) => {
					formControl.setValue({ current: AppUtility.isObject(formControl.value, true) ? formControl.value.current : undefined, new: undefined, identity: AppUtility.isObject(formControl.value, true) ? formControl.value.identity : undefined }, { onlySelf: true });
					this.hash.full = AppCrypto.hash(this.form.value);
				}),
				this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label"), false, true, true, FilesProcessorModalPage),
				this.portalsCmsSvc.getUploadFormControl(this.content, "attachments"),
				this.portalsCmsSvc.getPermanentLinkFormControl(this.content, "management"),
				this.portalsCoreSvc.getAuditFormControl(this.content, "management"),
				this.appFormsSvc.getButtonControls("management", {
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
		else {
			control.Options.OnBlur = (_, formControl) => this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
			formConfig.push(this.filesSvc.getThumbnailFormControl("Thumbnails", "basic", true, true));
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.content.ID)) {
			formConfig.insert({
				Name: "RepositoryEntity",
				Type: "Text",
				Segment: "management",
				Extras: { Text: this.contentType !== undefined ? this.contentType.Title : "" },
				Options: {
					Label: "{{portals.cms.contents.list.current}}",
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === "Audits") + 1);
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
			control.Segment = "management";
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}
		else {
			formConfig.insert({
				Name: "RepositoryEntity",
				Type: "Text",
				Segment: "management",
				Extras: { Text: this.contentType !== undefined ? this.contentType.Title : "" },
				Options: {
					Label: "{{portals.cms.contents.list.current}}",
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === "ID"));
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	onFormInitialized() {
		this.form.patchValue(AppUtility.clone(this.content, false, ["StartDate", "EndDate", "PublishedTime"], obj => Content.normalizeClonedProperties(this.content, obj, () => {
			obj.StartDate = AppUtility.toIsoDate(this.content.StartDate);
			obj.EndDate = AppUtility.toIsoDate(this.content.EndDate);
			obj.PublishedTime = AppUtility.toIsoDateTime(this.content.PublishedTime, true);
		})));
		this.hash.content = AppCrypto.hash(this.form.value);

		this.appFormsSvc.hideLoadingAsync(() => {
			if (AppUtility.isNotEmpty(this.content.ID)) {
				if (this.content.thumbnails !== undefined) {
					this.prepareAttachments("Thumbnails", this.content.thumbnails);
					this.hash.full = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.content), thumbnails => {
						this.content.updateThumbnails(thumbnails);
						this.prepareAttachments("Thumbnails", thumbnails);
						this.hash.full = AppCrypto.hash(this.form.value);
					});
				}
				if (this.content.attachments !== undefined) {
					this.prepareAttachments("Attachments", this.content.attachments);
					this.hash.full = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchAttachmentsAsync(this.portalsCmsSvc.getFileOptions(this.content), attachments => {
						this.content.updateAttachments(attachments);
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

				const content = this.form.value;
				delete content["Thumbnails"];
				delete content["Attachments"];
				delete content["Upload"];

				content.StartDate = AppUtility.toStrDate(content.StartDate);
				content.EndDate = AppUtility.toStrDate(content.EndDate);
				content.PublishedTime = AppUtility.toIsoDateTime(content.PublishedTime, true);

				if (AppUtility.isNotEmpty(content.ID)) {
					if (this.hash.content === AppCrypto.hash(content)) {
						const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
						if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
							this.filesSvc.uploadThumbnailAsync(
								control.value.new,
								this.portalsCmsSvc.getFileOptions(this.content, options => options.Extras["x-attachment-id"] = control.value.identity),
								async () => {
									await this.portalsCmsSvc.refreshContentAsync(content.ID);
									await Promise.all([
										this.trackAsync(this.title.track, "Upload", "Thumbnail"),
										this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.update")),
										this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())
									]);
								},
								error => this.trackAsync(this.title.track, "Upload", "Thumbnail").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
							);
						}
						else {
							this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
						}
					}
					else {
						const oldCategoryID = this.content.CategoryID;
						this.portalsCmsSvc.updateContentAsync(
							content,
							async data => {
								const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
								if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
									await this.filesSvc.uploadThumbnailAsync(control.value.new, this.portalsCmsSvc.getFileOptions(this.content, options => options.Extras["x-attachment-id"] = control.value.identity), () => this.trackAsync(this.title.track, "Upload", "Thumbnail"));
								}
								if (oldCategoryID !== data.CategoryID) {
									AppEvents.broadcast(this.portalsCmsSvc.name, { Object: "CMS.Content", Type: "Updated", ID: data.ID, SystemID: data.SystemID, RepositoryID: data.RepositoryID, RepositoryEntityID: data.RepositoryEntityID, CategoryID: oldCategoryID });
								}
								await Promise.all([
									this.trackAsync(this.title.track, "Update"),
									this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.update")),
									this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())
								]);
							},
							error => this.trackAsync(this.title.track, "Update").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
				}
				else {
					this.portalsCmsSvc.createContentAsync(
						content,
						async data => {
							const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
							if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
								await this.filesSvc.uploadThumbnailAsync(control.value.new, this.portalsCmsSvc.getFileOptions(Content.get(data.ID)), () => this.trackAsync(this.title.track, "Upload", "Thumbnail"));
							}
							await Promise.all([
								this.trackAsync(this.title.track),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.contents.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())
							]);
						},
						error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
					);
				}
			}
		}
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
					_ => this.trackAsync(title, "Delete").then(() => this.appFormsSvc.showToastAsync(success)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())),
					error => this.trackAsync(title, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
				)),
				button,
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
				message || await this.configSvc.getResourceAsync(`portals.cms.contents.update.messages.confirm.${AppUtility.isNotEmpty(this.content.ID) ? "cancel" : "new"}`),
				() => this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url)),
				undefined,
				message === undefined ? "{{default}}" : undefined
			));
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Content", action: action || (this.content !== undefined && AppUtility.isNotEmpty(this.content.ID) ? "Edit" : "Create") });
	}

}
