import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Privileges } from "@models/privileges";
import { Organization } from "@models/portals.core.organization";
import { ModuleDefinition, ExtendedPropertyDefinition, ExtendedControlDefinition, StandardControlDefinition, EmailNotificationSettings } from "@models/portals.base";
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

export class PortalsContentTypesUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private contentType: ContentType;
	private organization: Organization;
	private definitions: Array<ModuleDefinition>;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private isAdvancedMode = false;
	private extendable = false;
	private emailsByApprovalStatus = {} as { [status: string]: EmailNotificationSettings };
	private hash = "";

	title = "";
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

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.contentType = ContentType.get(this.configSvc.requestParams["ID"]);

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.contentType.SystemID, _ => this.organization = Organization.get(this.contentType.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		this.contentType = this.contentType || new ContentType(this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.contentType.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.contenttypes.title.${(AppUtility.isNotEmpty(this.contentType.ID) ? "update" : "create")}`);

		if (Module.all.filter(o => o.SystemID === this.organization.ID).length < 1) {
			const request = AppPagination.buildRequest(
				{ And: [{ SystemID: { Equals: this.organization.ID } }] },
				{ Title: "Ascending" },
				{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
			);
			await this.portalsCoreSvc.searchModuleAsync(request, undefined, undefined, true, true);
		}

		if (Module.all.filter(o => o.SystemID === this.organization.ID).length < 1) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid")));
			return;
		}

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.contentType.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.definitions = await this.portalsCoreSvc.getDefinitionsAsync();
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			const contentTypeDefinition = this.getContentTypeDefinitions(this.contentType.RepositoryID).find(definition => definition.ID === this.contentType.ContentTypeDefinitionID);
			this.isAdvancedMode = this.isSystemModerator && AppUtility.isTrue(this.configSvc.requestParams["Advanced"]);
			this.extendable = contentTypeDefinition !== undefined && contentTypeDefinition.Extendable;
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private getModuleDefinition(moduleID: string) {
		const current = Module.all.find(o => o.ID === moduleID);
		return this.definitions.find(definition => definition.ID === current.ModuleDefinitionID);
	}

	private getContentTypeDefinitions(moduleID: string) {
		const moduleDefinition = this.getModuleDefinition(moduleID);
		return moduleDefinition !== undefined ? moduleDefinition.ContentTypeDefinitions : [];
	}

	private getRepositories() {
		return Module.all.filter(o => o.SystemID === this.organization.ID)
			.sort(AppUtility.getCompareFunction("Title"))
			.map(o => {
				return {
					Value: o.ID,
					Label: o.Title,
					Description: o.Description
				} as AppFormsLookupValue;
			});
	}

	private getDefinitions(moduleID: string, onlyMultiple: boolean = false) {
		let contentTypeDefinitions = this.getContentTypeDefinitions(moduleID).sort(AppUtility.getCompareFunction("Title"));
		if (onlyMultiple) {
			const contentTypeIDs = ContentType.all.filter(o => o.RepositoryID === moduleID).map(o => o.ContentTypeDefinitionID);
			contentTypeDefinitions = contentTypeDefinitions.filter(o => o.MultipleIntances || (!o.MultipleIntances && contentTypeIDs.indexOf(o.ID) < 0));
		}
		return contentTypeDefinitions.map(definition => {
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
		if (this.extendable) {
			formSegments.push(new AppFormsSegment("extend", await this.configSvc.getResourceAsync("portals.contenttypes.update.segments.extend")));
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const trackings: Array<string> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "trackings");
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "content.type");

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
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.getRepositories();
			control.Options.OnChanged = (_, formControl) => {
				const definitions = this.getDefinitions(formControl.value, true);
				formControl.control.next.Options.SelectOptions.Values = definitions;
				formControl.control.next.controlRef.setValue(definitions[0].Value, { onlySelf: true });
				this.form.controls.Title.setValue(definitions[0].Label, { onlySelf: true });
				this.form.controls.Description.setValue(definitions[0].Description, { onlySelf: true });
			};
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
					Extras: { Text: this.getDefinitions(this.contentType.RepositoryID).find(definition => definition.Value === this.contentType.ContentTypeDefinitionID).Label },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.getDefinitions(Module.instances.size() > 0 ? Module.all[0].ID : undefined, true);
			control.Options.OnChanged = (_, formControl) => {
				if (formControl.selectOptions.length > 0) {
					this.form.controls.Title.setValue(formControl.selectOptions.find(o => o.Value === formControl.value).Label, { onlySelf: true });
					this.form.controls.Description.setValue(formControl.selectOptions.find(o => o.Value === formControl.value).Description, { onlySelf: true });
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

		["CreateNewVersionWhenUpdated", "AllowComments", "UseSocialNetworkComments"].forEach(name => formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, name)).Options.Type = "toggle");

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "DefaultCommentStatus"));
		control.Options.SelectOptions.Interface = "popover";
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
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
			this.portalsCoreSvc.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, true, this.portalsCoreSvc.getNotificationInheritStates(this.contentType.Notifications)),
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
			if (this.extendable) {
				formConfig.push(
					{
						Name: "ExtendedPropertyDefinitions",
						Segment: "extend",
						Type: "TextArea",
						Options: {
							Label: "{{portals.contenttypes.controls.ExtendedPropertyDefinitions.label}}",
							Description: "{{portals.contenttypes.controls.ExtendedPropertyDefinitions.description}}",
							Rows: 15,
							ReadOnly: !this.isAdvancedMode
						}
					},
					{
						Name: "ExtendedControlDefinitions",
						Segment: "extend",
						Type: "TextArea",
						Options: {
							Label: "{{portals.contenttypes.controls.ExtendedControlDefinitions.label}}",
							Description: "{{portals.contenttypes.controls.ExtendedControlDefinitions.description}}",
							Rows: 15,
							ReadOnly: !this.isAdvancedMode
						}
					},
					{
						Name: "StandardControlDefinitions",
						Segment: "extend",
						Type: "TextArea",
						Options: {
							Label: "{{portals.contenttypes.controls.StandardControlDefinitions.label}}",
							Description: "{{portals.contenttypes.controls.StandardControlDefinitions.description}}",
							Rows: 15,
							ReadOnly: !this.isAdvancedMode
						}
					}
				);
			}
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.contentType, "basic"),
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
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
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
		const contentType = AppUtility.clone(this.contentType, false, ["ExtendedPropertyDefinitions", "ExtendedControlDefinitions", "StandardControlDefinitions", "Notifications", "EmailSettings"]);
		delete contentType["Privileges"];

		contentType.OriginalPrivileges = Privileges.clonePrivileges(this.contentType.OriginalPrivileges);
		contentType.Notifications = this.portalsCoreSvc.getNotificationSettings(this.contentType.Notifications, this.emailsByApprovalStatus);
		contentType.EmailSettings = this.portalsCoreSvc.getEmailSettings(this.contentType.EmailSettings);
		if (this.extendable) {
			contentType.ExtendedPropertyDefinitions = AppUtility.isArray(this.contentType.ExtendedPropertyDefinitions, true) ? JSON.stringify(this.contentType.ExtendedPropertyDefinitions) : undefined;
			contentType.ExtendedControlDefinitions = AppUtility.isArray(this.contentType.ExtendedControlDefinitions, true) ? JSON.stringify(this.contentType.ExtendedControlDefinitions) : undefined;
			contentType.StandardControlDefinitions = AppUtility.isArray(this.contentType.StandardControlDefinitions, true) ? JSON.stringify(this.contentType.StandardControlDefinitions) : undefined;
		}
		else {
			contentType.ExtendedPropertyDefinitions = contentType.ExtendedControlDefinitions = contentType.StandardControlDefinitions = undefined;
		}

		this.form.patchValue(contentType);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(() => {
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
		});
	}

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const contentType = this.form.value;
				contentType.OriginalPrivileges = Privileges.getPrivileges(contentType.OriginalPrivileges);
				this.portalsCoreSvc.normalizeNotificationSettings(contentType.Notifications, this.emailsByApprovalStatus);
				this.portalsCoreSvc.normalizeEmailSettings(contentType.EmailSettings);

				if (this.extendable && this.isAdvancedMode) {
					if (AppUtility.isNotEmpty(contentType.ExtendedPropertyDefinitions)) {
						try {
							contentType.ExtendedPropertyDefinitions = JSON.parse(contentType.ExtendedPropertyDefinitions);
							if (!AppUtility.isArray(contentType.ExtendedPropertyDefinitions, true)) {
								throw new Error("JSON is not array");
							}
						}
						catch (error) {
							this.processing = false;
							console.error("Error occurred while parsing JSON of extended property definitions", error);
							await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.extendedProperty") }, undefined, _ => {
								const control = this.formControls.find(ctrl => ctrl.Name === "ExtendedPropertyDefinitions");
								this.formSegments.current = control.Segment;
								control.focus();
							});
							return;
						}
					}
					else {
						contentType.ExtendedPropertyDefinitions = undefined;
					}

					if (AppUtility.isNotEmpty(contentType.ExtendedControlDefinitions)) {
						try {
							contentType.ExtendedControlDefinitions = JSON.parse(contentType.ExtendedControlDefinitions);
							if (!AppUtility.isArray(contentType.ExtendedControlDefinitions, true)) {
								throw new Error("JSON is not array");
							}
						}
						catch (error) {
							this.processing = false;
							console.error("Error occurred while parsing JSON of extended control definitions", error);
							await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.extendedControl") }, undefined, _ => {
								const control = this.formControls.find(ctrl => ctrl.Name === "ExtendedControlDefinitions");
								this.formSegments.current = control.Segment;
								control.focus();
							});
							return;
						}
					}
					else {
						contentType.ExtendedControlDefinitions = undefined;
					}

					if (contentType.ExtendedPropertyDefinitions !== undefined) {
						const extendedPropertyDefinitions: Array<ExtendedPropertyDefinition> = contentType.ExtendedPropertyDefinitions;
						const extendedControlDefinitions: Array<ExtendedControlDefinition> = contentType.ExtendedControlDefinitions;

						let gotError = false;
						if (extendedControlDefinitions === undefined || extendedControlDefinitions.length !== extendedPropertyDefinitions.length) {
							gotError = true;
						}

						if (!gotError) {
							const names = AppUtility.toSet(extendedPropertyDefinitions.map(definition => definition.Name));
							let index = 0;
							while (!gotError && index < extendedControlDefinitions.length) {
								gotError = !names.contains(extendedControlDefinitions[index].Name);
								index++;
							}
						}

						if (gotError) {
							this.processing = false;
							console.error("JSON of extended property definition is not matched with JSON of extended control definitions");
							await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.extendedNotMatched") }, undefined, _ => {
								const control = this.formControls.find(ctrl => ctrl.Name === "ExtendedPropertyDefinitions");
								this.formSegments.current = control.Segment;
								control.focus();
							});
							return;
						}
					}

					if (AppUtility.isNotEmpty(contentType.StandardControlDefinitions)) {
						try {
							contentType.StandardControlDefinitions = JSON.parse(contentType.StandardControlDefinitions);
							if (!AppUtility.isArray(contentType.StandardControlDefinitions, true)) {
								throw new Error("JSON is not array");
							}
						}
						catch (error) {
							this.processing = false;
							console.error("Error occurred while parsing JSON of standard control definitions", error);
							await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.standardControl") }, undefined, _ => {
								const control = this.formControls.find(ctrl => ctrl.Name === "StandardControlDefinitions");
								this.formSegments.current = control.Segment;
								control.focus();
							});
							return;
						}
					}
					else {
						contentType.StandardControlDefinitions = undefined;
					}

					if (contentType.StandardControlDefinitions !== undefined) {
						let gotError = false;
						const standardControlDefinitions: Array<StandardControlDefinition> = contentType.StandardControlDefinitions;
						const names = AppUtility.toSet(this.formControls.filter(ctrl => !ctrl.Hidden).map(ctrl => ctrl.Name));
						let index = 0;
						while (!gotError && index < standardControlDefinitions.length) {
							gotError = !names.contains(standardControlDefinitions[index].Name);
							index++;
						}

						if (gotError) {
							this.processing = false;
							console.error("JSON of standard control definitions is not matched with form controls");
							await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.standardNotMatched") }, undefined, _ => {
								const control = this.formControls.find(ctrl => ctrl.Name === "StandardControlDefinitions");
								this.formSegments.current = control.Segment;
								control.focus();
							});
							return;
						}
					}
				}

				if (AppUtility.isNotEmpty(contentType.ID)) {
					await this.portalsCoreSvc.updateContentTypeAsync(
						contentType,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Content.Type", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.showErrorAsync(error);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createContentTypeAsync(
						contentType,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Content.Type", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.showErrorAsync(error);
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
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Content.Type", Type: "Deleted", ID: data.ID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.showErrorAsync(error)
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
