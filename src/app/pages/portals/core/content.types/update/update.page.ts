import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { UsersService } from "@services/users.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Privileges } from "@models/privileges";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Desktop } from "@models/portals.core.desktop";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@controls/portals/role.selector.modal.page";

@Component({
	selector: "page-portals-core-content-types-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class ContentTypesUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private moduleDefinitions: Array<any>;
	private contentType: ContentType;
	private organization: Organization;
	private isSystemModerator = false;
	private canModerateOrganization = false;
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
		this.contentType = ContentType.get(this.configSvc.requestParams["ID"]);

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.contentType.SystemID, _ => this.organization = Organization.get(this.contentType.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemModerator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (this.canModerateOrganization) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.contentType = this.contentType || new ContentType(this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.contentType.SystemID) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.contenttypes.title.${(AppUtility.isNotEmpty(this.contentType.ID) ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.contentType.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.moduleDefinitions = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "module.definitions");
		if (Module.all.filter(m => m.SystemID === this.organization.ID).length < 1) {
			const request = AppPagination.buildRequest(
				{ And: [{ SystemID: { Equals: this.organization.ID } }] },
				{ Title: "Ascending" },
				{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
			);
			await this.portalsCoreSvc.searchModuleAsync(request, undefined, undefined, true, true);
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private getRepositories() {
		return Module.all.filter(m => m.SystemID === this.organization.ID)
			.sort(AppUtility.getCompareFunction("Title"))
			.map(m => {
				return {
					Value: m.ID,
					Label: m.Title,
					Description: m.Description
				} as AppFormsLookupValue;
			});
	}

	private getContentTypeDefinitions(moduleID: string) {
		const current = Module.all.find(m => m.ID === moduleID);
		const moduleDefinition = this.moduleDefinitions.find(definition => definition.ID === current.ModuleDefinitionID);
		const contentTypeDefinitions: Array<any> = moduleDefinition !== undefined
			? moduleDefinition.ContentTypeDefinitions
			: [];
		return contentTypeDefinitions.sort(AppUtility.getCompareFunction("Title"))
			.map(definition => {
				return {
					Value: definition.ID,
					Label: definition.Title,
					Description: definition.Description
				} as AppFormsLookupValue;
			});
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.contenttypes.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.contenttypes.update.segments.privileges")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.contenttypes.update.segments.notifications")),
			new AppFormsSegment("emails", await this.configSvc.getResourceAsync("portals.contenttypes.update.segments.emails"))
		];
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			formSegments.push(new AppFormsSegment("extend", await this.configSvc.getResourceAsync("portals.contenttypes.update.segments.extend")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const trackings: Array<string> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "trackings");
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "content.type", "form-controls");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.organization.Title },
				Options: {
					Label: "{{portals.contenttypes.controls.Organization}}",
					ReadOnly: true
				}
			},
			0
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryID"));
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			control.Hidden = true;
			AppUtility.insertAt(
				formConfig,
				{
					Name: "Repository",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: this.getRepositories().find(repository => repository.Value === this.contentType.RepositoryID).Label },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryID"))
			);
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.getRepositories();
			control.Options.OnChanged = (_, formControl) => formControl.control.next.Options.SelectOptions.Values = this.getContentTypeDefinitions(formControl.value);
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			control.Hidden = true;
			AppUtility.insertAt(
				formConfig,
				{
					Name: "ContentTypeDefinition",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: this.getContentTypeDefinitions(this.contentType.RepositoryID).find(definition => definition.Value === this.contentType.ContentTypeDefinitionID).Label },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"))
			);
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.getContentTypeDefinitions(Module.instances.size() > 0 ? Module.all[0].ID : undefined);
			control.Options.OnBlur = (_, formControl) => {
				if (formControl.selectOptions.length > 0) {
					this.form.controls.Title.setValue(formControl.selectOptions[0].Label, { onlySelf: true });
				}
			};
		}

		let desktop = Desktop.get(this.contentType.DesktopID);
		if (desktop === undefined && AppUtility.isNotEmpty(this.contentType.DesktopID)) {
			await this.portalsCoreSvc.getDesktopAsync(this.contentType.DesktopID, _ => desktop = Desktop.get(this.contentType.DesktopID), undefined, true);
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

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CreateNewVersionWhenUpdated"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "AllowComments"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UseSocialNetworkComments"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "DefaultCommentStatus"));
		control.Options.SelectOptions.Interface = "popover";
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
		}

		const inheritEventsAndMethods = AppUtility.isNull(this.contentType.Notifications) || (AppUtility.isNull(this.contentType.Notifications.Events) && AppUtility.isNull(this.contentType.Notifications.Methods));
		const inheritEmailSettings = AppUtility.isNull(this.contentType.Notifications) || AppUtility.isNull(this.contentType.Notifications.Emails);
		const inheritWebHookSettings = AppUtility.isNull(this.contentType.Notifications) || AppUtility.isNull(this.contentType.Notifications.WebHooks);

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
			{
				Name: "Trackings",
				Segment: "emails",
				Options: {
					Label: "{{portals.contenttypes.controls.Trackings.label}}"
				},
				SubControls: {
					Controls: trackings.map(tracking => {
						return {
							Name: tracking,
							Options: {
								Label: `{{portals.contenttypes.controls.Trackings.${tracking}.label}}`,
								Description: `{{portals.contenttypes.controls.Trackings.${tracking}.description}}`
							}
						};
					})
				}
			},
			this.portalsCoreSvc.getEmailSettingsFormControl("EmailSettings", "emails", true, AppUtility.isNull(this.contentType.EmailSettings))
		);

		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			formConfig.push(
				await this.usersSvc.getAuditFormControlAsync(this.contentType.Created, this.contentType.CreatedID, this.contentType.LastModified, this.contentType.LastModifiedID, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.contenttypes.update.buttons.delete}}",
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

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	onFormInitialized() {
		const contentType = AppUtility.clone(this.contentType, false);
		delete contentType["Privileges"];
		contentType.OriginalPrivileges = Privileges.clonePrivileges(this.contentType.OriginalPrivileges);
		contentType.Notifications = contentType.Notifications || {};
		contentType.Notifications.InheritFromParent = AppUtility.isNull(this.contentType.Notifications) || (AppUtility.isNull(this.contentType.Notifications.Events) && AppUtility.isNull(this.contentType.Notifications.Methods));
		contentType.Notifications.Emails = contentType.Notifications.Emails || {};
		contentType.Notifications.Emails.InheritFromParent = AppUtility.isNull(this.contentType.Notifications) || AppUtility.isNull(this.contentType.Notifications.Emails);
		contentType.Notifications.WebHooks = contentType.Notifications.WebHooks || {};
		contentType.Notifications.WebHooks.InheritFromParent = AppUtility.isNull(this.contentType.Notifications) || AppUtility.isNull(this.contentType.Notifications.WebHooks);
		contentType.EmailSettings = contentType.EmailSettings || {};
		contentType.EmailSettings.InheritFromParent = AppUtility.isNull(this.contentType.EmailSettings);
		contentType.EmailSettings.Smtp = contentType.EmailSettings.Smtp || { Port: 25, EnableSsl: false };

		this.form.patchValue(contentType);
		this.hash = AppCrypto.hash(this.form.value);

		if (!AppUtility.isNotEmpty(this.contentType.ID) && Module.instances.size() > 0) {
			this.form.controls.RepositoryID.setValue(Module.all[0].ID, { onlySelf: true });
			const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
			if (control.Options.SelectOptions.Values.length > 0) {
				const first = control.Options.SelectOptions.Values[0];
				this.form.controls.ContentTypeDefinitionID.setValue(first.Value, { onlySelf: true });
				this.form.controls.Title.setValue(first.Label, { onlySelf: true });
				this.form.controls.Description.setValue(first.Description, { onlySelf: true });
			}
		}
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

				const contentType = this.form.value;
				contentType.OriginalPrivileges = Privileges.getPrivileges(contentType.OriginalPrivileges);

				if (contentType.Notifications && contentType.Notifications.Emails && contentType.Notifications.Emails.InheritFromParent) {
					contentType.Notifications.Emails = undefined;
				}
				if (contentType.Notifications && contentType.Notifications.WebHooks && contentType.Notifications.WebHooks.InheritFromParent) {
					contentType.Notifications.WebHooks = undefined;
				}
				if (contentType.EmailSettings && contentType.EmailSettings.InheritFromParent) {
					contentType.EmailSettings = undefined;
				}

				if (AppUtility.isNotEmpty(contentType.ID)) {
					await this.portalsCoreSvc.updateContentTypeAsync(
						contentType,
						async () => await Promise.all([
							TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.update")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCoreSvc.createContentTypeAsync(
						contentType,
						async () => await Promise.all([
							TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.new")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
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
			await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.confirm.delete"),
			undefined,
			() => PlatformUtility.invoke(async () => await this.removeAsync(), 123),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async removeAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.confirm.delete"),
			await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.confirm.remove"),
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.buttons.delete"));
				await this.portalsCoreSvc.deleteContentTypeAsync(
					this.contentType.ID,
					async () => await Promise.all([
						TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.buttons.delete"), this.configSvc.currentUrl),
						this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.delete")),
						this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
					]),
					async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error))
				);
			},
			await this.configSvc.getResourceAsync("portals.contenttypes.update.buttons.remove"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.contenttypes.update.messages.confirm.${AppUtility.isNotEmpty(this.contentType.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
