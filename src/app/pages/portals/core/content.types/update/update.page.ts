import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { HashSet } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment, AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Privileges } from "@app/models/privileges";
import { ModuleDefinition, ExtendedPropertyDefinition, ExtendedControlDefinition, EmailNotificationSettings } from "@app/models/portals.base";
import { Organization, Module, ContentType, Desktop } from "@app/models/portals.core.all";
import { DesktopsSelectorModalPage } from "@app/controls/portals/desktop.selector.modal.page";
import { RolesSelectorModalPage } from "@app/controls/portals/role.selector.modal.page";

@Component({
	selector: "page-portals-core-content-types-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsContentTypesUpdatePage implements OnInit, OnDestroy {
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
	buttons = {
		save: "Save",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "Content.Type" && info.args.Type === "Deleted" && info.args.ID === this.contentType.ID) {
				this.configSvc.navigateBackAsync();
			}
		}, "ContentTypes:Edit");
	}

	ngOnDestroy() {
		AppEvents.off(this.portalsCoreSvc.name, "ContentTypes:Edit");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.contentType = ContentType.get(this.configSvc.requestParams["ID"]);

		this.organization = this.contentType !== undefined
			? Organization.get(this.contentType.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined && this.contentType !== undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.contentType.SystemID, _ => this.organization = Organization.get(this.contentType.SystemID), undefined, true);
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.contenttypes.title.${this.contentType !== undefined ? "update" : "create"}`);

		this.canModerateOrganization = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined) || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			this.trackAsync(`${this.title} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm....")).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
			return;
		}

		this.contentType = this.contentType || new ContentType(this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.contentType.SystemID) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check").then(() => this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"))));
			return;
		}

		if (!!!this.organization.modules.length) {
			const request = AppPagination.buildRequest(
				{ And: [{ SystemID: { Equals: this.organization.ID } }] },
				{ Title: "Ascending" },
				{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
			);
			await this.portalsCoreSvc.searchModulesAsync(request, undefined, undefined, true, true);
		}

		if (!!!this.organization.modules.length) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check").then(() => this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.contenttypes.list.invalid"))));
			return;
		}

		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.contentType.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.definitions = await this.portalsCoreSvc.getDefinitionsAsync();
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			const contentTypeDefinition = this.getContentTypeDefinitions(this.contentType.RepositoryID).find(definition => definition.ID === this.contentType.ContentTypeDefinitionID);
			this.isAdvancedMode = this.canModerateOrganization && AppUtility.isTrue(this.configSvc.requestParams["Advanced"]);
			this.extendable = contentTypeDefinition !== undefined && contentTypeDefinition.Extendable;
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		this.trackAsync(this.title);
	}

	private getModuleDefinition(moduleID: string) {
		const current = Module.instances.first(module => module.ID === moduleID);
		return current !== undefined ? this.definitions.find(definition => definition.ID === current.ModuleDefinitionID) : undefined;
	}

	private getContentTypeDefinitions(moduleID: string) {
		const moduleDefinition = this.getModuleDefinition(moduleID);
		return moduleDefinition !== undefined ? moduleDefinition.ContentTypeDefinitions : [];
	}

	private getRepositories() {
		return Module.instances.toArray(module => module.SystemID === this.organization.ID)
			.sortBy("Title")
			.map(module => ({
				Value: module.ID,
				Label: module.Title,
				Description: module.Description
			} as AppFormsLookupValue));
	}

	private getDefinitions(moduleID: string, onlyMultiple: boolean = false) {
		let contentTypeDefinitions = this.getContentTypeDefinitions(moduleID).sortBy("Title");
		if (onlyMultiple) {
			const contentTypeIDs = ContentType.instances.toArray(o => o.RepositoryID === moduleID).map(o => o.ContentTypeDefinitionID);
			contentTypeDefinitions = contentTypeDefinitions.filter(o => o.MultipleIntances || (!o.MultipleIntances && contentTypeIDs.indexOf(o.ID) < 0));
		}
		return contentTypeDefinitions.map(definition => ({
				Value: definition.ID,
				Label: definition.Title,
				Description: definition.Description
			} as AppFormsLookupValue));
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
		const repository = AppUtility.isNotEmpty(this.contentType.ID)
			? this.getRepositories().find(repo => repo.Value === this.contentType.RepositoryID)
			: undefined;
		const contentTypeDefinition = AppUtility.isNotEmpty(this.contentType.ID)
			? this.getDefinitions(this.contentType.RepositoryID).find(definition => definition.Value === this.contentType.ContentTypeDefinitionID)
			: undefined;

		const trackings: Array<string> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "trackings");
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "content.type");
		this.portalsCoreSvc.addOrganizationControl(formConfig, "{{portals.contenttypes.controls.Organization}}", this.organization);

		let control = formConfig.find(ctrl => ctrl.Name === "Title");
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => ctrl.Name === "Description");
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => ctrl.Name === "RepositoryID");
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			control.Hidden = true;
			formConfig.insert(
				{
					Name: "Repository",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: repository !== undefined ? repository.Label : "" },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}
		else {
			control.Options.SelectOptions.Values = this.getRepositories();
			control.Options.OnChanged = (_, formControl) => {
				const definitions = this.getDefinitions(formControl.value, true);
				const definition = definitions.first();
				formControl.control.next.Options.SelectOptions.Values = definitions;
				formControl.control.next.controlRef.setValue(definition.Value, { onlySelf: true });
				this.form.controls.Title.setValue(definition.Label, { onlySelf: true });
				this.form.controls.Description.setValue(definition.Description, { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => ctrl.Name === "ContentTypeDefinitionID");
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			control.Hidden = true;
			formConfig.insert({
				Name: "ContentTypeDefinition",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: contentTypeDefinition !== undefined ? contentTypeDefinition.Label : "" },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}
		else {
			const module = this.portalsCoreSvc.activeModule || Module.instances.first(mod => mod.SystemID === this.organization.ID);
			control.Options.SelectOptions.Values = this.getDefinitions(module !== undefined ? module.ID : undefined, true);
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

		["CreateNewVersionWhenUpdated", "AllowComments", "UseSocialNetworkComments"].forEach(name => formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, name)).Options.Type = "toggle");

		control = formConfig.find(ctrl => ctrl.Name === "DefaultCommentStatus");
		this.portalsCoreSvc.prepareApprovalStatusControl(control, "popover");

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

		control = formConfig.find(ctrl => ctrl.Name === "Notifications");
		this.portalsCoreSvc.prepareNotificationsFormControl(control, this.emailsByApprovalStatus);

		if (AppUtility.isNotEmpty(this.contentType.ID)) {
			if (this.extendable) {
				const amount = formConfig.length - formConfig.findIndex(ctrl => ctrl.Name === "SubTitleFormula");
				const restOf = formConfig.take(0, amount);
				formConfig.clear(amount).push(
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
				formConfig.merge(restOf).find(ctrl => ctrl.Name === "SubTitleFormula").Options.ReadOnly = !this.isAdvancedMode;
			}
			else {
				formConfig.filter(ctrl => ctrl.Segment === "extend").forEach(ctrl => ctrl.Hidden = true);
			}
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.contentType, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.contenttypes.update.buttons.delete}}",
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

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.contentType.ID)) {
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
		const contentType = AppUtility.clone(this.contentType, false, ["ExtendedPropertyDefinitions", "ExtendedControlDefinitions", "StandardControlDefinitions", "Notifications", "EmailSettings"], obj => delete obj["Privileges"]);
		contentType.OriginalPrivileges = Privileges.clonePrivileges(this.contentType.OriginalPrivileges);
		contentType.Notifications = this.portalsCoreSvc.getNotificationSettings(this.contentType.Notifications, this.emailsByApprovalStatus);
		contentType.EmailSettings = this.portalsCoreSvc.getEmailSettings(this.contentType.EmailSettings);
		if (this.extendable) {
			contentType.ExtendedPropertyDefinitions = AppUtility.isArray(this.contentType.ExtendedPropertyDefinitions, true) ? AppUtility.stringify(this.contentType.ExtendedPropertyDefinitions) : undefined;
			contentType.ExtendedControlDefinitions = AppUtility.isArray(this.contentType.ExtendedControlDefinitions, true) ? AppUtility.stringify(this.contentType.ExtendedControlDefinitions) : undefined;
			contentType.StandardControlDefinitions = AppUtility.isArray(this.contentType.StandardControlDefinitions, true) ? AppUtility.stringify(this.contentType.StandardControlDefinitions) : undefined;
		}
		else {
			contentType.ExtendedPropertyDefinitions = contentType.ExtendedControlDefinitions = contentType.StandardControlDefinitions = undefined;
		}

		this.form.patchValue(contentType);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(() => {
			if (!AppUtility.isNotEmpty(this.contentType.ID) && Module.instances.size > 0) {
				this.form.controls.RepositoryID.setValue(Module.instances.toArray()[0].ID, { onlySelf: true });
				const control = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
				if (control.Options.SelectOptions.Values.length > 0) {
					const first = control.Options.SelectOptions.Values[0];
					this.form.controls.ContentTypeDefinitionID.setValue(first.Value, { onlySelf: true });
					this.form.controls.Title.setValue(first.Label, { onlySelf: true });
					this.form.controls.Description.setValue(first.Description, { onlySelf: true });
				}
				this.hash = AppCrypto.hash(this.form.value);
			}
		});
	}

	save() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				this.configSvc.navigateBackAsync();
			}
			else {
				this.appFormsSvc.showLoadingAsync(this.title).then(() => {
					this.processing = true;
					const contentType = this.form.value;
					contentType.OriginalPrivileges = Privileges.getPrivileges(contentType.OriginalPrivileges);
					this.portalsCoreSvc.normalizeNotificationSettings(contentType.Notifications, this.emailsByApprovalStatus);
					this.portalsCoreSvc.normalizeEmailSettings(contentType.EmailSettings);

					if (this.extendable && this.isAdvancedMode) {
						if (AppUtility.isNotEmpty(contentType.ExtendedPropertyDefinitions)) {
							try {
								contentType.ExtendedPropertyDefinitions = AppUtility.parse(contentType.ExtendedPropertyDefinitions);
								if (!AppUtility.isArray(contentType.ExtendedPropertyDefinitions, true)) {
									throw new Error("JSON is not array");
								}
							}
							catch (error) {
								this.processing = false;
								console.error("Error occurred while parsing JSON of extended property definitions", error);
								AppUtility.invoke(async () => this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.extendedProperty") }, undefined, _ => {
									const control = this.formControls.find(ctrl => ctrl.Name === "ExtendedPropertyDefinitions");
									this.formSegments.current = control.Segment;
									control.focus();
								}));
								return;
							}
						}
						else {
							contentType.ExtendedPropertyDefinitions = undefined;
						}

						if (AppUtility.isNotEmpty(contentType.ExtendedControlDefinitions)) {
							try {
								contentType.ExtendedControlDefinitions = AppUtility.parse(contentType.ExtendedControlDefinitions);
								if (!AppUtility.isArray(contentType.ExtendedControlDefinitions, true)) {
									throw new Error("JSON is not array");
								}
							}
							catch (error) {
								this.processing = false;
								console.error("Error occurred while parsing JSON of extended control definitions", error);
								AppUtility.invoke(async () => this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.extendedControl") }, undefined, _ => {
									const control = this.formControls.find(ctrl => ctrl.Name === "ExtendedControlDefinitions");
									this.formSegments.current = control.Segment;
									control.focus();
								}));
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
								const names = new HashSet<string>(extendedPropertyDefinitions.map(definition => definition.Name));
								let index = 0;
								while (!gotError && index < extendedControlDefinitions.length) {
									gotError = !names.contains(extendedControlDefinitions[index].Name);
									index++;
								}
							}

							if (gotError) {
								this.processing = false;
								console.error("JSON of extended property definition is not matched with JSON of extended control definitions");
								AppUtility.invoke(async () => this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.extendedNotMatched") }, undefined, _ => {
									const control = this.formControls.find(ctrl => ctrl.Name === "ExtendedPropertyDefinitions");
									this.formSegments.current = control.Segment;
									control.focus();
								}));
								return;
							}
						}

						if (AppUtility.isNotEmpty(contentType.StandardControlDefinitions)) {
							try {
								contentType.StandardControlDefinitions = AppUtility.parse(contentType.StandardControlDefinitions);
								if (!AppUtility.isArray(contentType.StandardControlDefinitions, true)) {
									throw new Error("JSON is not array");
								}
							}
							catch (error) {
								this.processing = false;
								console.error("Error occurred while parsing JSON of standard control definitions", error);
								AppUtility.invoke(async () => this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.json.standardControl") }, undefined, _ => {
									const control = this.formControls.find(ctrl => ctrl.Name === "StandardControlDefinitions");
									this.formSegments.current = control.Segment;
									control.focus();
								}));
								return;
							}
						}
						else {
							contentType.StandardControlDefinitions = undefined;
						}
					}

					if (AppUtility.isNotEmpty(contentType.ID)) {
						this.portalsCoreSvc.updateContentTypeAsync(
							contentType,
							data => {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Content.Type", Type: "Updated", ID: data.ID });
								this.configSvc.removeDefinition(this.portalsCoreSvc.name, ContentType.get(data.ID).getObjectName(true), undefined, { "x-content-type-id": data.ID });
								this.configSvc.removeDefinition(this.portalsCoreSvc.name, ContentType.get(data.ID).getObjectName(true), undefined, { "x-content-type-id": data.ID, "x-view-controls": "x" });
								this.trackAsync(this.title, "Update")
									.then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.update")))
									.then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
							},
							error => this.trackAsync(this.title, "Update").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
					else {
						this.portalsCoreSvc.createContentTypeAsync(
							contentType,
							data => {
								AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Content.Type", Type: "Created", ID: data.ID });
								this.trackAsync(this.title)
									.then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.new")))
									.then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
							},
							error => this.trackAsync(this.title).then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
				});
			}
		}
	}

	delete() {
		AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.confirm.delete"),
			async () => this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.confirm.delete"),
				await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.confirm.remove"),
				async () => this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.buttons.delete"))
					.then(() => this.portalsCoreSvc.deleteContentTypeAsync(
						this.contentType.ID,
						data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Content.Type", Type: "Deleted", ID: data.ID });
							this.trackAsync(this.title, "Delete")
								.then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.contenttypes.update.messages.success.delete")))
								.then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()));
						},
						error => this.trackAsync(this.title, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
					)
				),
				await this.configSvc.getResourceAsync("portals.contenttypes.update.buttons.remove"),
				await this.configSvc.getResourceAsync("common.buttons.cancel")
			),
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			"{{default}}"
		));
	}

	cancel(message?: string) {
		const changed = this.hash !== AppCrypto.hash(this.form.value);
		if (message === undefined && !changed) {
			this.trackAsync(this.title, "Cancel").then(() => this.configSvc.navigateBackAsync());
		}
		else {
			AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
				message || await this.configSvc.getResourceAsync(`portals.contenttypes.update.messages.confirm.${AppUtility.isNotEmpty(this.contentType.ID) ? "cancel" : "new"}`),
				() => this.trackAsync(this.title, "Cancel").then(() => this.configSvc.navigateBackAsync()),
				undefined,
				message !== undefined || changed || AppUtility.isEmpty(this.contentType.ID) ? "{{default}}" : undefined
			));
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "ContentType", action: action || (this.contentType !== undefined && AppUtility.isNotEmpty(this.contentType.ID) ? "Edit" : "Create") });
	}

}
