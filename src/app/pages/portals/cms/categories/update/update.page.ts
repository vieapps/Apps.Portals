import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { AttachmentInfo } from "@app/models/base";
import { Privileges } from "@app/models/privileges";
import { EmailNotificationSettings } from "@app/models/portals.base";
import { Organization, Module, ContentType, Desktop } from "@app/models/portals.core.all";
import { Category } from "@app/models/portals.cms.category";
import { DesktopsSelectorModalPage } from "@app/controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@app/controls/portals/role.selector.modal.page";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-categories-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsCategoriesUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private filesSvc: FilesService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private category: Category;
	private emailsByApprovalStatus = {} as { [status: string]: EmailNotificationSettings };
	private hash = "";

	title = {
		page: "Category",
		track: "Category"
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
		this.category = Category.get(this.configSvc.requestParams["ID"]);

		this.contentType = this.category !== undefined
			? this.category.contentType
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.category !== undefined
			? Organization.get(this.category.SystemID)
			: this.contentType !== undefined
				? Organization.get(this.contentType.SystemID)
				: await this.portalsCoreSvc.getActiveOrganizationAsync();

		this.title.track = await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(this.category !== undefined && AppUtility.isNotEmpty(this.category.ID) ? "update" : "create")}`);
		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = this.category !== undefined
				? this.category.contentType
				: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
			if (this.contentType === undefined) {
				this.trackAsync(`${this.title.track} | Invalid Content Type`, "Check");
				this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"), "/portals/core/content.types/list/all"));
				return;
			}
		}

		this.module = Module.get(this.contentType.RepositoryID);

		const canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", this.category !== undefined ? this.category.Privileges : this.module.Privileges);
		if (!canUpdate) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.category = this.category || new Category(this.organization.ID, this.module.ID, this.contentType.ID, this.configSvc.requestParams["ParentID"]);
		this.configSvc.appTitle = this.title.page = this.title.track + (AppUtility.isNotEmpty(this.category.ID) ? ` [${this.category.FullTitle}]` : "");

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.category.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title.track).then(() => {
			if (AppUtility.isNotEmpty(this.category.ID) && this.category.childrenIDs === undefined) {
				this.portalsCmsSvc.refreshCategoryAsync(this.category.ID, () => this.appFormsSvc.showToastAsync("The category was freshen-up"));
			}
		});
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.categories.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.cms.categories.update.segments.privileges")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.cms.categories.update.segments.notifications"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.category", undefined, { "x-content-type-id": this.contentType.ID });

		formConfig.insert({
			Name: "Info",
			Type: "Text",
			Segment: "basic",
			Extras: { Text: `${this.organization.Title} - ${this.module.Title}` },
			Options: {
				Label: "{{portals.cms.categories.controls.Info}}",
				ReadOnly: true
			}
		}, 0);

		let parentCategory = this.category.Parent;
		if (parentCategory === undefined && AppUtility.isNotEmpty(this.category.ParentID)) {
			await this.portalsCmsSvc.getCategoryAsync(this.category.ParentID, _ => parentCategory = this.category.Parent, undefined, true);
		}

		let control = formConfig.find(ctrl => ctrl.Name === "ParentID");
		control.Required = false;
		control.Extras = { LookupDisplayValues: parentCategory !== undefined ? [{ Value: parentCategory.ID, Label: parentCategory.FullTitle }] : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.contentType, false, true, options => {
			options.ModalOptions.ComponentProps.excludedIDs = AppUtility.isNotEmpty(this.category.ID) ? [this.category.ID] : undefined;
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories);
			options.Multiple = false;
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = (values, formControl) => {
				if (AppUtility.isArray(values, true) && values[0].ID !== formControl.value) {
					const category = Category.get(values[0].ID);
					if (category !== undefined) {
						formControl.setValue(category.ID);
						formControl.lookupDisplayValues = [{ Value: category.ID, Label: category.FullTitle }];
					}
				}
			};
		});

		let desktop = Desktop.get(this.category.DesktopID);
		if (desktop === undefined && AppUtility.isNotEmpty(this.category.DesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.category.DesktopID, _ => desktop = Desktop.get(this.category.DesktopID), undefined, true);
		}

		control = formConfig.find(ctrl => ctrl.Name === "DesktopID");
		control.Type = "Lookup";
		control.Extras = { LookupDisplayValues: desktop !== undefined ? [{ Value: desktop.ID, Label: desktop.FullTitle }] : undefined };
		control.Options.LookupOptions = {
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: DesktopsSelectorModalPage,
				ComponentProps: {
					multiple: false,
					organizationID: this.organization.ID
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						const selectedDesktop = Desktop.get(data[0]);
						formControl.setValue(selectedDesktop.ID);
						formControl.lookupDisplayValues = [{ Value: selectedDesktop.ID, Label: selectedDesktop.FullTitle }];
					}
				}
			}
		};

		control = formConfig.find(ctrl => ctrl.Name === "OpenBy");
		control.Options.SelectOptions.AsBoxes = true;
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values, "#;") as Array<string>).map(value => ({
				Value: value,
				Label: `{{portals.cms.categories.controls.OpenBy.${value}}}`
			}));
		}

		formConfig.push(
			{
				Name: "OriginalPrivileges",
				Type: "Custom",
				Segment: "privileges",
				Extras: { AllowInheritFromParent: true, RolesSelector: this.portalsCoreSvc.getRolesSelector(RolesSelectorModalPage, { organizationID: this.organization.ID }) },
				Options: {
					Type: "object-privileges"
				}
			},
			this.portalsCoreSvc.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, true, this.portalsCoreSvc.getNotificationInheritStates(this.category.Notifications)/*, notificationsControl => notificationsControl.SubControls.Controls.find(ctl => ctl.Name === "EmailsByApprovalStatus").SubControls.Controls.find(ctl => ctl.Name === "Status").Options.OnChanged = event => this.onStatusChanged(event.detail.value)*/),
			this.portalsCoreSvc.getEmailSettingsFormControl("EmailSettings", "notifications", true, AppUtility.isNull(this.category.EmailSettings))
		);

		control = formConfig.find(ctrl => ctrl.Name === "Notifications");
		this.portalsCoreSvc.prepareNotificationsFormControl(control, this.emailsByApprovalStatus);

		control = formConfig.find(ctrl => ctrl.Name === "Title");
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.category.ID)) {
			formConfig.insert(
				this.filesSvc.getThumbnailFormControl("Thumbnails", "basic", true, true, controlConfig => controlConfig.Options.FilePickerOptions.OnDelete = (_, formControl) => {
					formControl.setValue({ current: AppUtility.isObject(formControl.value, true) ? formControl.value.current : undefined, new: undefined, identity: AppUtility.isObject(formControl.value, true) ? formControl.value.identity : undefined }, { onlySelf: true });
					this.hash = AppCrypto.hash(this.form.value);
				}),
				formConfig.findIndex(ctrl => ctrl.Name === "OrderIndex")
			);
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.category, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.cms.categories.update.buttons.delete}}",
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
			control.Options.OnBlur = (_, formControl) => this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		formConfig.find(ctrl => ctrl.Name === "Description").Options.Rows = 2;
		formConfig.find(ctrl => ctrl.Name === "Notes").Options.Rows = 2;

		if (AppUtility.isNotEmpty(this.category.ID)) {
			control = formConfig.find(ctrl => ctrl.Name === "ID");
			control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
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
		this.form.patchValue(AppUtility.clone(this.category, false, ["Notifications", "EmailSettings"], obj => {
			delete obj["Privileges"];
			obj.OriginalPrivileges = Privileges.clonePrivileges(this.category.OriginalPrivileges);
			obj.Notifications = this.portalsCoreSvc.getNotificationSettings(this.category.Notifications, this.emailsByApprovalStatus);
			obj.EmailSettings = this.portalsCoreSvc.getEmailSettings(this.category.EmailSettings);
		}));
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(() => {
			if (AppUtility.isNotEmpty(this.category.ID)) {
				if (this.category.thumbnails !== undefined) {
					this.prepareThumbnails(this.category.thumbnails);
					this.hash = AppCrypto.hash(this.form.value);
				}
				else {
					this.filesSvc.searchThumbnailsAsync(this.portalsCmsSvc.getFileOptions(this.category), thumbnails => {
						this.category.updateThumbnails(thumbnails);
						this.prepareThumbnails(thumbnails);
						this.hash = AppCrypto.hash(this.form.value);
					});
				}
			}
		});
	}

	private prepareThumbnails(thumbnails?: Array<AttachmentInfo>) {
		this.filesSvc.prepareAttachmentsFormControl(this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails")), true, thumbnails);
	}

	save() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				this.appFormsSvc.showLoadingAsync(this.title.track);

				const category = this.form.value;
				category.OriginalPrivileges = Privileges.getPrivileges(category.OriginalPrivileges);
				this.portalsCoreSvc.normalizeNotificationSettings(category.Notifications, this.emailsByApprovalStatus);
				this.portalsCoreSvc.normalizeEmailSettings(category.EmailSettings);

				if (AppUtility.isNotEmpty(category.ID)) {
					const oldParentID = this.category.ParentID;
					this.portalsCmsSvc.updateCategoryAsync(
						category,
						async data => {
							const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "Thumbnails"));
							if (control !== undefined && AppUtility.isObject(control.value, true) && AppUtility.isNotEmpty(control.value.new)) {
								await this.filesSvc.uploadThumbnailAsync(
									control.value.new,
									this.portalsCmsSvc.getFileOptions(this.category, options => options.Extras["x-attachment-id"] = control.value.identity),
									() => this.trackAsync(this.title.track, "Upload", "Thumbnail").then(() => this.portalsCmsSvc.refreshCategoryAsync(category.ID))
								);
							}
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							if (oldParentID !== data.ParentID) {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Updated", ID: oldParentID });
							}
							await this.trackAsync(this.title.track, "Update").then(() => async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.success.update")));
							await this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
						},
						error => this.trackAsync(this.title.track, "Update").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
					);
				}
				else {
					this.portalsCmsSvc.createCategoryAsync(
						category,
						data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Created", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							this.trackAsync(this.title.track).then(() => async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.success.new")));
							this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
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
			const removeButton = await this.configSvc.getResourceAsync("portals.cms.categories.update.buttons.delete");
			const cancelButton = await this.configSvc.getResourceAsync("common.buttons.cancel");
			const deleteMessage = await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.confirm.delete");
			const removeMessage = await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.confirm.remove");
			const successMessage = await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.success.delete");
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
			this.portalsCoreSvc.confirmAsync(
				deleteMessage,
				() => this.appFormsSvc.showAlertAsync(
					undefined,
					deleteMessage,
					removeMessage,
					mode => {
						this.appFormsSvc.showLoadingAsync(deleteButton).then(() => this.portalsCmsSvc.deleteCategoryAsync(
							this.category.ID,
							data => {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Deleted", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
								this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showToastAsync(successMessage)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
							},
							error => this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showErrorAsync(error)),
							{ "x-children": mode }
						));
					},
					removeButton,
					cancelButton,
					this.category.childrenIDs === undefined || this.category.childrenIDs.length < 1 ? undefined : modes.map(mode => ({
						type: "radio",
						label: mode.label,
						value: mode.value,
						checked: mode.value === "delete"
					}))
				),
				true,
				deleteButton
			);
		});
	}

	cancel(message?: string, url?: string) {
		const changed = this.hash !== AppCrypto.hash(this.form.value);
		if (message === undefined && !changed) {
			this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url));
		}
		else {
			AppUtility.invoke(async () => this.portalsCoreSvc.confirmAsync(
				message || await this.configSvc.getResourceAsync(`portals.cms.categories.update.messages.confirm.${AppUtility.isNotEmpty(this.contentType.ID) ? "cancel" : "new"}`),
				() => this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url)),
				message !== undefined || changed || AppUtility.isEmpty(this.contentType.ID)
			));
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Category", action: action || (this.category !== undefined && AppUtility.isNotEmpty(this.category.ID) ? "Edit" : "Create") });
	}

}
