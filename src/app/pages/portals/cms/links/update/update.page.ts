import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { NestedObject } from "@app/models/portals.base";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Link, Category } from "@app/models/portals.cms.all";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-links-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsLinksUpdatePage implements OnInit {
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
	private link: Link;
	private canModerate = false;
	private hash = {
		content: "",
		full: ""
	};

	title = {
		page: "Link",
		track: "Link"
	};
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
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

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.link = Link.get(this.configSvc.requestParams["ID"]);

		this.contentType = this.link !== undefined
			? this.link.contentType
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.link !== undefined
			? Organization.get(this.link.SystemID)
			: this.contentType !== undefined
				? Organization.get(this.contentType.SystemID)
				: await this.portalsCoreSvc.getActiveOrganizationAsync();

		this.title.track = await this.configSvc.getResourceAsync(`portals.cms.links.title.${(this.link !== undefined && AppUtility.isNotEmpty(this.link.ID) ? "update" : "create")}`);
		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = this.link !== undefined
				? this.link.contentType
				: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
			if (this.contentType === undefined) {
				this.trackAsync(`${this.title.track} | Invalid Content Type`, "Check");
				this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"), "/portals/core/content.types/list/all"));
				return;
			}
		}

		this.module = Module.get(this.contentType.RepositoryID);

		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Link", this.contentType !== undefined ? this.contentType.Privileges : this.module.Privileges);
		let canUpdate = this.canModerate || this.authSvc.isEditor(this.portalsCoreSvc.name, "Link", this.contentType !== undefined ? this.contentType.Privileges : this.module.Privileges);
		if (!canUpdate && this.link !== undefined && (AppUtility.isEquals(this.link.Status, "Draft") || AppUtility.isEquals(this.link.Status, "Pending"))) {
			canUpdate = AppUtility.isEquals(this.link.CreatedID, this.configSvc.getAccount().id);
		}
		if (!canUpdate) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.link = this.link || new Link(this.organization.ID, this.module.ID, this.contentType.ID, this.configSvc.requestParams["ParentID"]);
		this.configSvc.appTitle = this.title.page = this.title.track + (AppUtility.isNotEmpty(this.link.ID) ? ` [${this.link.FullTitle}]` : "");

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.link.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track).then(() => {
			if (AppUtility.isNotEmpty(this.link.ID) && this.link.ChildrenMode === "Normal" && this.link.childrenIDs === undefined) {
				this.portalsCmsSvc.refreshLinkAsync(this.link.ID, () => this.appFormsSvc.showToastAsync("The link was freshen-up"));
			}
		});
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.contents.update.segments.basic"))
		];
		if (AppUtility.isNotEmpty(this.link.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("files.attachments.segment")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.link", undefined, { "x-content-type-id": this.contentType.ID });

		let parentLink = this.link.Parent;
		if (parentLink === undefined && AppUtility.isNotEmpty(this.link.ParentID)) {
			await this.portalsCmsSvc.getLinkAsync(this.link.ParentID, _ => parentLink = this.link.Parent, undefined, true);
		}

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID"));
		control.Required = false;
		control.Extras = { LookupDisplayValues: parentLink !== undefined ? [{ Value: parentLink.ID, Label: parentLink.FullTitle }] : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.contentType, false, true, options => {
			options.ModalOptions.ComponentProps.excludedIDs = AppUtility.isNotEmpty(this.link.ID) ? [this.link.ID] : undefined;
			options.ModalOptions.ComponentProps.preProcess = (links: Array<any>) => this.portalsCmsSvc.processLinks(links);
			options.Multiple = false;
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = (values, formControl) => {
				if (AppUtility.isArray(values, true) && values[0].ID !== formControl.value) {
					const link = Link.get(values[0].ID);
					if (link !== undefined) {
						formControl.setValue(link.ID);
						formControl.lookupDisplayValues = [{ Value: link.ID, Label: link.FullTitle }];
					}
				}
			};
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ChildrenMode"));
		control.Options.SelectOptions.AsBoxes = true;
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values, "#;") as Array<string>).map(value => {
				return { Value: value, Label: `{{portals.cms.links.controls.ChildrenMode.${value}}}` };
			});
		}
		control.Options.OnChanged = (_, formControl) => {
			const moduleFormControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryID"));
			const contentTypeFormControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryEntityID"));
			moduleFormControl.Options.Disabled = contentTypeFormControl.Options.Disabled = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryObjectID")).Options.Disabled = AppUtility.isEquals(formControl.value, "Normal");
			if (!moduleFormControl.Options.Disabled) {
				moduleFormControl.Options.SelectOptions.Values = this.organization.modules.map(module => {
					return { Value: module.ID, Label: module.Title };
				});
				moduleFormControl.controlRef.setValue(AppUtility.isNotEmpty(this.form.value.LookupRepositoryID) && moduleFormControl.Options.SelectOptions.Values.findIndex(info => info.Value === this.form.value.LookupRepositoryID) > -1 ? this.form.value.LookupRepositoryID : moduleFormControl.Options.SelectOptions.Values.length > 0 ? moduleFormControl.Options.SelectOptions.Values[0].Value : undefined);
			}
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryID"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = this.organization.modules.map(module => {
			return { Value: module.ID, Label: module.Title };
		});
		control.Options.OnChanged = (_, formControl) => {
			const contentTypeFormControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryEntityID"));
			contentTypeFormControl.Options.SelectOptions.Values = Module.get(formControl.value).contentTypes.filter(contentType => contentType.contentTypeDefinition.NestedObject).map(contentType => {
				return { Value: contentType.ID, Label: contentType.Title };
			});
			contentTypeFormControl.controlRef.setValue(AppUtility.isNotEmpty(this.form.value.LookupRepositoryEntityID) && contentTypeFormControl.Options.SelectOptions.Values.findIndex(info => info.Value === this.form.value.LookupRepositoryEntityID) > -1 ? this.form.value.LookupRepositoryEntityID : contentTypeFormControl.Options.SelectOptions.Values.length > 0 ? contentTypeFormControl.Options.SelectOptions.Values[0].Value : undefined);
			this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryObjectID")).Options.LookupOptions.ModalOptions.ComponentProps.moduleID = formControl.value;
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryEntityID"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = this.module.contentTypes.filter(contentType => contentType.contentTypeDefinition.NestedObject).map(contentType => {
			return { Value: contentType.ID, Label: contentType.Title };
		});
		control.Options.OnChanged = async (_, formControl) => {
			const contentType = ContentType.get(formControl.value);
			const objectFormControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryObjectID"));
			objectFormControl.Options.LookupOptions.ModalOptions.ComponentProps.contentTypeID = contentType.ID;
			objectFormControl.Options.LookupOptions.ModalOptions.ComponentProps.objectName = contentType.getObjectName(true);
			objectFormControl.Options.LookupOptions.ModalOptions.ComponentProps.preProcess = objectFormControl.Options.LookupOptions.ModalOptions.ComponentProps.objectName === "CMS.Link"
				? (links: Array<any>) => this.portalsCmsSvc.processLinks(links)
				: objectFormControl.Options.LookupOptions.ModalOptions.ComponentProps.objectName === "CMS.Category"
					? (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories)
					: undefined;
			if (AppUtility.isNotEmpty(objectFormControl.value)) {
				let nestedObject: NestedObject = Link.get(objectFormControl.value) || Category.get(objectFormControl.value);
				if (nestedObject === undefined) {
					await this.portalsCmsSvc.getAsync(contentType.getObjectName(true), objectFormControl.value, data => nestedObject = Link.get(data.ID) || Category.get(data.ID) || data);
				}
				if (nestedObject === undefined || contentType.ID !== nestedObject["RepositoryEntityID"]) {
					objectFormControl.controlRef.setValue(undefined);
					objectFormControl.controlRef.lookupDisplayValues = undefined;
				}
				else {
					objectFormControl.controlRef.setValue(nestedObject.ID);
					objectFormControl.controlRef.lookupDisplayValues = [{ Value: nestedObject.ID, Label: nestedObject.FullTitle || nestedObject.Title }];
				}
			}
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "LookupRepositoryObjectID"));
		const lookupContentType = ContentType.get(this.link.LookupRepositoryEntityID);
		this.portalsCoreSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, lookupContentType, false, true, options => {
			options.ModalOptions.ComponentProps.objectName = lookupContentType !== undefined ? lookupContentType.getObjectName(true) : undefined;
			options.ModalOptions.ComponentProps.excludedIDs = AppUtility.isNotEmpty(this.link.ID) ? [this.link.ID] : undefined;
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = (values, formControl) => {
				if (AppUtility.isArray(values, true) && values[0].ID !== formControl.value) {
					formControl.setValue(values[0].ID);
					const nestedObject: NestedObject = Link.get(values[0].ID) || Category.get(values[0].ID || values[0]);
					formControl.lookupDisplayValues = [{ Value: nestedObject.ID, Label: nestedObject.FullTitle || nestedObject.Title }];
				}
			};
		});
		if (AppUtility.isNotEmpty(this.link.ID) && AppUtility.isNotEmpty(this.link.LookupRepositoryObjectID)) {
			let nestedObject: NestedObject = Link.get(this.link.LookupRepositoryObjectID) || Category.get(this.link.LookupRepositoryObjectID);
			if (nestedObject === undefined) {
				let contentType = ContentType.get(this.link.LookupRepositoryEntityID);
				if (contentType === undefined) {
					await this.portalsCoreSvc.getContentTypeAsync(this.link.LookupRepositoryEntityID, _ => contentType = ContentType.get(this.link.LookupRepositoryEntityID), undefined, true);
				}
				if (contentType !== undefined) {
					control.Options.LookupOptions.ModalOptions.ComponentProps.objectName = contentType.getObjectName(true);
					await this.portalsCmsSvc.getAsync(contentType.getObjectName(true), this.link.LookupRepositoryObjectID, data => nestedObject = Link.get(data.ID) || Category.get(data.ID) || data);
				}
			}
			if (nestedObject !== undefined) {
				control.Extras.LookupDisplayValues = [{ Value: nestedObject.ID, Label: nestedObject.FullTitle || nestedObject.Title }];
			}
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		this.portalsCoreSvc.prepareApprovalStatusControl(control, "popover");
		if (!this.canModerate) {
			control.Options.Disabled = true;
		}

		const linkSelectorOptions = {
			file: {
				label: await this.appFormsSvc.getResourceAsync("portals.cms.common.links.file")
			}
		};
		const linkSelector = this.portalsCmsSvc.getLinkSelector(this.link, DataLookupModalPage, linkSelectorOptions);
		const mediaSelector = this.portalsCmsSvc.getMediaSelector(this.link, await this.appFormsSvc.getResourceAsync("portals.cms.common.links.media"));

		formConfig.filter(ctrl => AppUtility.isEquals(ctrl.Type, "TextEditor")).forEach(ctrl => {
			ctrl.Extras["ckEditorLinkSelector"] = linkSelector;
			ctrl.Extras["ckEditorMediaSelector"] = mediaSelector;
			ctrl.Extras["ckEditorSimpleUpload"] = AppUtility.isNotEmpty(this.link.ID) ? this.portalsCmsSvc.getFileHeaders(this.link) : undefined;
			ctrl.Extras["ckEditorTrustedHosts"] = this.configSvc.appConfig.URIs.medias;
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Summary"));
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "URL"));
		control.Options.Icon = {
			Name: "globe",
			Fill: "clear",
			Color: "medium",
			Slot: "end",
			OnClick: (_, formControl) => PlatformUtility.openURL(AppUtility.isNotEmpty(formControl.value) ? formControl.value.replace("~/", `${this.configSvc.appConfig.URIs.portals}~${this.organization.Alias}/`) : undefined)
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.link.ID)) {
			formConfig.push(
				this.filesSvc.getThumbnailFormControl("Thumbnails", "attachments", true, true, controlConfig => controlConfig.Options.FilePickerOptions.OnDelete = (_, formControl) => {
					formControl.setValue({ current: AppUtility.isObject(formControl.value, true) ? formControl.value.current : undefined, new: undefined, identity: AppUtility.isObject(formControl.value, true) ? formControl.value.identity : undefined }, { onlySelf: true });
					this.hash.full = AppCrypto.hash(this.form.value);
				}),
				this.filesSvc.getAttachmentsFormControl("Attachments", "attachments", await this.appFormsSvc.getResourceAsync("files.attachments.label"), false, true, true, FilesProcessorModalPage),
				this.portalsCmsSvc.getUploadFormControl(this.link, "attachments"),
				this.portalsCoreSvc.getAuditFormControl(this.link, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.cms.links.update.buttons.delete}}",
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

		formConfig.forEach((ctrl, index) => ctrl.Order = index);

		if (AppUtility.isNotEmpty(this.link.ID)) {
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
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
		this.form.patchValue(AppUtility.clone(this.link, false, undefined, link => Link.normalizeClonedProperties(this.link, link)));
		this.hash.content = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(() => {
			if (AppUtility.isNotEmpty(this.link.ID)) {
				if (this.link.thumbnails !== undefined) {
					this.prepareAttachments("Thumbnails", this.link.thumbnails);
					this.hash.full = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.link), thumbnails => {
						this.link.updateThumbnails(thumbnails);
						this.prepareAttachments("Thumbnails", thumbnails);
						this.hash.full = AppCrypto.hash(this.form.value);
					});
				}
				if (this.link.attachments !== undefined) {
					this.prepareAttachments("Attachments", this.link.attachments);
					this.hash.full = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchAttachmentsAsync(this.portalsCmsSvc.getFileOptions(this.link), attachments => {
						this.link.updateAttachments(attachments);
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

				const link = this.form.value;
				delete link["Thumbnails"];
				delete link["Attachments"];
				delete link["Upload"];
				if (link.ChildrenMode !== "Normal" && !AppUtility.isNotEmpty(link.LookupRepositoryObjectID)) {
					link.ChildrenMode = "Normal";
					link.LookupRepositoryID = link.LookupRepositoryEntityID = link.LookupRepositoryObjectID = undefined;
				}

				if (AppUtility.isNotEmpty(link.ID)) {
					if (this.hash.content === AppCrypto.hash(link)) {
						const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
						if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
							this.filesSvc.uploadThumbnailAsync(
								control.value.new,
								this.portalsCmsSvc.getFileOptions(this.link, options => options.Extras["x-attachment-id"] = control.value.identity),
								() => this.portalsCmsSvc.refreshLinkAsync(link.ID).then(async () => await Promise.all([
									this.trackAsync(this.title.track, "Upload", "Thumbnail"),
									this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.links.update.messages.success.update")),
									this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())
								])),
								error => this.trackAsync(this.title.track, "Upload", "Thumbnail").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
							);
						}
						else {
							this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
						}
					}
					else {
						const oldParentID = this.link.ParentID;
						this.portalsCmsSvc.updateLinkAsync(
							link,
							async data => {
								data = AppUtility.isArray(data.Objects) ? data.Objects.first() : data;
								const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
								if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
									await this.filesSvc.uploadThumbnailAsync(control.value.new, this.portalsCmsSvc.getFileOptions(this.link, options => options.Extras["x-attachment-id"] = control.value.identity), () => this.trackAsync(this.title.track, "Upload", "Thumbnail"));
								}
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Link", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
								if (oldParentID !== data.ParentID) {
									AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Link", Type: "Updated", ID: oldParentID });
								}
								await Promise.all([
									this.trackAsync(this.title.track, "Update"),
									this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.links.update.messages.success.update")),
									this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())
								]);
							},
							error => this.trackAsync(this.title.track, "Update").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
				}
				else {
					this.portalsCmsSvc.createLinkAsync(
						link,
						async data => {
							data = AppUtility.isArray(data.Objects) ? data.Objects.first() : data;
							const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
							if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
								await this.filesSvc.uploadThumbnailAsync(control.value.new, this.portalsCmsSvc.getFileOptions(Link.get(data.ID)), () => this.trackAsync(this.title.track, "Upload", "Thumbnail"));
							}
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Link", Type: "Created", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							await Promise.all([
								this.trackAsync(this.title.track),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.links.update.messages.success.new")),
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
			const deleteButton = await this.configSvc.getResourceAsync("common.buttons.delete");
			const removeButton = await this.configSvc.getResourceAsync("portals.cms.links.update.buttons.delete");
			const cancelButton = await this.configSvc.getResourceAsync("common.buttons.cancel");
			const deleteMessage = await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.delete");
			const removeMessage = await this.configSvc.getResourceAsync("portals.cms.links.update.messages.confirm.remove");
			const successMessage = await this.configSvc.getResourceAsync("portals.cms.links.update.messages.success.delete");
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
			this.appFormsSvc.showConfirmAsync(
				deleteMessage,
				() => this.appFormsSvc.showAlertAsync(
					undefined,
					deleteMessage,
					removeMessage,
					mode => {
						this.appFormsSvc.showLoadingAsync(removeButton).then(() => this.portalsCmsSvc.deleteLinkAsync(
							this.link.ID,
							data => {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Link", Type: "Deleted", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
								this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showToastAsync(successMessage)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
							},
							error => this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showErrorAsync(error)),
							{ "x-children": mode }
						));
					},
					removeButton,
					cancelButton,
					this.link.childrenIDs === undefined || this.link.childrenIDs.length < 1 ? undefined : modes.map(mode => ({
						type: "radio",
						label: mode.label,
						value: mode.value,
						checked: mode.value === "delete"
					}))
				),
				deleteButton,
				cancelButton
			);
		});
	}

	cancel(message?: string, url?: string) {
		if (message === undefined && this.hash.full === AppCrypto.hash(this.form.value)) {
			this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url));
		}
		else {
			AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
				message || await this.configSvc.getResourceAsync(`portals.cms.links.update.messages.confirm.${AppUtility.isNotEmpty(this.link.ID) ? "cancel" : "new"}`),
				() => this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url)),
				undefined,
				message === undefined ? "{{default}}" : undefined
			));
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Link", action: action || (this.link !== undefined && AppUtility.isNotEmpty(this.link.ID) ? "Edit" : "Create") });
	}

}
