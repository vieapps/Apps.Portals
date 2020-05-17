import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { UsersService } from "@services/users.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Privileges } from "@models/privileges";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Desktop } from "@models/portals.core.desktop";
import { Category } from "@models/portals.cms.category";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@controls/portals/role.selector.modal.page";
import { DataLookupModalPage } from "@controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-categories-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsCategoriesUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	private organization: Organization;
	private module: Module;
	private contentType: ContentType;
	private category: Category;
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.category = Category.get(this.configSvc.requestParams["ID"]);

		this.contentType = this.category !== undefined
			? this.category.ContentType
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);

		this.organization = this.category !== undefined
			? Organization.get(this.category.SystemID)
			: this.contentType !== undefined
				? Organization.get(this.contentType.SystemID)
				: await this.portalsCoreSvc.getActiveOrganizationAsync();

		if (this.organization === undefined) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all");
			return;
		}

		if (this.contentType === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.organization.ID, undefined, undefined, true);
			this.contentType = this.category !== undefined
				? this.category.ContentType
				: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"] || this.configSvc.requestParams["ContentTypeID"]);
			if (this.contentType === undefined) {
				await this.cancelAsync(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"), "/portals/core/content.types/list/all");
				return;
			}
		}

		this.module = Module.get(this.contentType.RepositoryID);

		const canUpdate = this.portalsCoreSvc.canModerateOrganization(this.organization) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", this.category !== undefined ? this.category.Privileges : this.module.Privileges);
		if (canUpdate) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.category = this.category || new Category(this.organization.ID, this.module.ID, this.contentType.ID, this.configSvc.requestParams["ParentID"]);

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.cms.categories.title.${(AppUtility.isNotEmpty(this.category.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.category.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (!AppUtility.isNotEmpty(this.category.ID)) {

		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
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
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.category", "form-controls");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Info",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: `${this.organization.Title} - ${this.module.Title}` },
				Options: {
					Label: "{{portals.cms.categories.controls.Info}}",
					ReadOnly: true
				}
			},
			0
		);

		let parentCategory = this.category.Parent;
		if (parentCategory === undefined && AppUtility.isNotEmpty(this.category.ParentID)) {
			await this.portalsCmsSvc.getCategoryAsync(this.category.ParentID, _ => parentCategory = this.category.Parent, undefined, true);
		}

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID"));
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;

		let desktop = Desktop.get(this.category.DesktopID);
		if (desktop === undefined && AppUtility.isNotEmpty(this.category.DesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.category.DesktopID, _ => desktop = Desktop.get(this.category.DesktopID), undefined, true);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "DesktopID"));
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OpenBy"));
		control.Options.SelectOptions.AsBoxes = true;
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{portals.cms.categories.controls.OpenBy.${value}}}` };
			});
		}

		const inheritEventsAndMethods = AppUtility.isNull(this.category.Notifications) || (AppUtility.isNull(this.category.Notifications.Events) && AppUtility.isNull(this.category.Notifications.Methods));
		const inheritEmailSettings = AppUtility.isNull(this.category.Notifications) || AppUtility.isNull(this.category.Notifications.Emails);
		const inheritWebHookSettings = AppUtility.isNull(this.category.Notifications) || AppUtility.isNull(this.category.Notifications.WebHooks);

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
			this.portalsCoreSvc.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, true, inheritEventsAndMethods, inheritEmailSettings, inheritWebHookSettings),
			this.portalsCoreSvc.getEmailSettingsFormControl("EmailSettings", "notifications", true, AppUtility.isNull(this.category.EmailSettings))
		);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (AppUtility.isNotEmpty(this.category.ID)) {
			formConfig.push(
				await this.usersSvc.getAuditFormControlAsync(this.category.Created, this.category.CreatedID, this.category.LastModified, this.category.LastModifiedID, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.cms.categories.update.buttons.delete}}",
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
				)
			);
		}
		else {
			control.Options.OnBlur = (_, formControl) => this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	onFormInitialized() {
		const category = AppUtility.clone(this.category, false);
		delete category["Privileges"];
		category.OriginalPrivileges = Privileges.clonePrivileges(this.category.OriginalPrivileges);
		category.Notifications = category.Notifications || {};
		category.Notifications.InheritFromParent = AppUtility.isNull(this.category.Notifications) || (AppUtility.isNull(this.category.Notifications.Events) && AppUtility.isNull(this.category.Notifications.Methods));
		category.Notifications.Emails = category.Notifications.Emails || {};
		category.Notifications.Emails.InheritFromParent = AppUtility.isNull(this.category.Notifications) || AppUtility.isNull(this.category.Notifications.Emails);
		category.Notifications.WebHooks = category.Notifications.WebHooks || {};
		category.Notifications.WebHooks.InheritFromParent = AppUtility.isNull(this.category.Notifications) || AppUtility.isNull(this.category.Notifications.WebHooks);
		category.EmailSettings = category.EmailSettings || {};
		category.EmailSettings.InheritFromParent = AppUtility.isNull(this.category.EmailSettings);
		category.EmailSettings.Smtp = category.EmailSettings.Smtp || { Port: 25, EnableSsl: false };

		this.form.patchValue(category);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync();
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const category = this.form.value;
				category.OriginalPrivileges = Privileges.getPrivileges(category.OriginalPrivileges);

				if (category.Notifications && category.Notifications.InheritFromParent) {
					category.Notifications.Events = undefined;
					category.Notifications.Methods = undefined;
				}
				if (category.Notifications && category.Notifications.Emails && category.Notifications.Emails.InheritFromParent) {
					category.Notifications.Emails = undefined;
				}
				if (category.Notifications && category.Notifications.WebHooks && category.Notifications.WebHooks.InheritFromParent) {
					category.Notifications.WebHooks = undefined;
				}
				if (category.EmailSettings && category.EmailSettings.InheritFromParent) {
					category.EmailSettings = undefined;
				}

				if (AppUtility.isNotEmpty(category.ID)) {
					const oldParentID = this.category.ParentID;
					await this.portalsCmsSvc.updateCategoryAsync(
						category,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Updated", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							if (oldParentID !== data.ParentID) {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Updated", ID: oldParentID });
							}
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCmsSvc.createCategoryAsync(
						category,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Created", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.confirm.delete"),
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
			await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.confirm.delete"),
			await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.confirm.remove"),
			async mode => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.buttons.delete"));
				await this.portalsCmsSvc.deleteCategoryAsync(
					this.category.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "CMS.Category", Type: "Deleted", ID: data.ID, ParentID: AppUtility.isNotEmpty(data.ParentID) ? data.ParentID : undefined });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.categories.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error)),
					{ "x-children": mode }
				);
			},
			await this.configSvc.getResourceAsync("portals.cms.categories.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			this.category.childrenIDs === undefined || this.category.childrenIDs.length < 1 ? undefined : modes.map(mode => {
				return {
					type: "radio",
					label: mode.label,
					value: mode.value,
					checked: mode.value === "delete"
				};
			})
		);
	}

	async cancelAsync(message?: string, url?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.cms.categories.update.messages.confirm.${AppUtility.isNotEmpty(this.category.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(url),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
