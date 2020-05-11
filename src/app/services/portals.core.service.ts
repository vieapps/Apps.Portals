import { Injectable } from "@angular/core";
import { AppRTU, AppMessage } from "@components/app.apis";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { AppCustomCompleter } from "@components/app.completer";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControlConfig, AppFormsLookupValue, AppFormsService } from "@components/forms.service";
import { Base as BaseService } from "@services/base.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { Account } from "@models/account";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Site } from "@models/portals.core.site";
import { Role } from "@models/portals.core.role";
import { Desktop } from "@models/portals.core.desktop";

@Injectable()
export class PortalsCoreService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService
	) {
		super("Portals");
		this.initialize();
	}

	public get activeOrganization() {
		if (Organization.active === undefined) {
			Organization.active = Organization.instances.size() > 0 ? Organization.all[0] : undefined;
			if (Organization.active !== undefined && Organization.active.Modules.length < 1) {
				this.getOrganizationAsync(Organization.active.ID);
			}
		}
		return Organization.active;
	}

	private initialize() {
		this.getDefinitionsAsync();
		AppRTU.registerAsObjectScopeProcessor(this.name, "Organization", message => this.processOrganizationUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Organization", message => this.processOrganizationUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Role", message => this.processRoleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Role", message => this.processRoleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Desktop", message => this.processDesktopUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Desktop", message => this.processDesktopUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Site", message => this.processSiteUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Site", message => this.processSiteUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Module", message => this.processModuleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Module", message => this.processModuleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "ContentType", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.ContentType", message => this.processContentTypeUpdateMessage(message));
		AppEvents.on("Portals", info => {
			if (info.args.Type === "RequestInfo" && AppUtility.isNotEmpty(info.args.ID)) {
				if (info.args.Object === "Organization") {
					this.getOrganizationAsync(info.args.ID);
				}
				else if (info.args.Object === "Module") {
					this.getModuleAsync(info.args.ID);
				}
				else if (info.args.Object === "ContentType") {
					this.getContentTypeAsync(info.args.ID);
				}
			}
		});
		if (this.configSvc.isReady) {
			this.getActiveOrganizationAsync(false);
		}
		else {
			AppEvents.on("App", info => {
				if (info.args.Type === "Initialized") {
					this.getActiveOrganizationAsync(false);
				}
			});
		}
	}

	public canManageOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization !== undefined && AppUtility.isNotEmpty(organization.ID)
			? AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isAdministrator(this.name, "Organization", organization.Privileges, account)
			: this.authSvc.isAdministrator(this.name, "Organization", undefined, account);
	}

	public canModerateOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization !== undefined && AppUtility.isNotEmpty(organization.ID)
			? AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isModerator(this.name, "Organization", organization.Privileges, account)
			: this.authSvc.isModerator(this.name, "Organization", undefined, account);
	}

	public async getDefinitionsAsync() {
		if (Organization.ModuleDefinitions === undefined) {
			const path = this.configSvc.getDefinitionPath(this.name, "module.definitions");
			Organization.ModuleDefinitions = this.configSvc.getDefinition(path);
			if (Organization.ModuleDefinitions === undefined) {
				Organization.ModuleDefinitions = await this.configSvc.fetchDefinitionAsync(path, false);
				Organization.ModuleDefinitions.forEach(definition => definition.ContentTypeDefinitions.forEach(contentTypeDefinition => contentTypeDefinition.ModuleDefinition = definition));
			}
		}
		return Organization.ModuleDefinitions;
	}

	public async getActiveOrganizationAsync(useXHR: boolean = true) {
		if (Organization.active === undefined) {
			const preferID: string = this.configSvc.appConfig.options.extras["organization"];
			if (AppUtility.isNotEmpty(preferID)) {
				Organization.active = Organization.get(preferID);
				if (Organization.active === undefined) {
					await this.getOrganizationAsync(preferID, _ => {
						Organization.active = Organization.get(preferID);
						if (Organization.active !== undefined && !useXHR) {
							AppEvents.broadcast(this.name, { Object: "Organization", Type: "Changed", ID: Organization.active.ID });
						}
					}, undefined, useXHR);
				}
			}
			else if (Organization.instances.size() > 0) {
				Organization.active = Organization.all[0];
			}
			if (Organization.active !== undefined) {
				AppEvents.broadcast(this.name, { Object: "Organization", Type: "Changed", ID: Organization.active.ID });
			}
		}
		return Organization.active;
	}

	public async setActiveOrganizationAsync(organizationID: string, onNext?: () => void) {
		if (AppUtility.isNotEmpty(organizationID) && Organization.contains(organizationID) && (Organization.active === undefined || Organization.active.ID !== organizationID)) {
			Organization.active = Organization.get(organizationID);
			this.configSvc.appConfig.options.extras["organization"] = Organization.active.ID;
			await this.configSvc.storeOptionsAsync();
			AppEvents.broadcast(this.name, { Object: "Organization", Type: "Changed", ID: Organization.active.ID });
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Organization.active;
	}

	public getPaginationPrefix(objectName: string) {
		return `${objectName}@${this.name}`.toLowerCase();
	}

	public getEmailNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (formConfig: AppFormsControlConfig) => void) {
		const placeholder = "{{portals.common.controls.notifications.emails.toAddresses.placeholder}}";
		const formConfig: AppFormsControlConfig = {
			Name: "Emails",
			Options: {
				Label: "{{portals.common.controls.notifications.emails.label}}",
			},
			SubControls: {
				Controls: [
					{
						Name: "ToAddresses",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.emails.toAddresses.label}}",
							PlaceHolder: placeholder,
							Description: "{{portals.common.controls.notifications.emails.toAddresses.description}}"
						}
					},
					{
						Name: "CcAddresses",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.emails.ccAddresses.label}}",
							PlaceHolder: placeholder,
							Description: "{{portals.common.controls.notifications.emails.ccAddresses.description}}"
						}
					},
					{
						Name: "BccAddresses",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.emails.bccAddresses.label}}",
							PlaceHolder: placeholder,
							Description: "{{portals.common.controls.notifications.emails.bccAddresses.description}}"
						}
					},
					{
						Name: "Subject",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.emails.subject.label}}"
						}
					},
					{
						Name: "Body",
						Type: "TextArea",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.emails.body.label}}",
							Description: "{{portals.common.controls.notifications.emails.body.description}}",
							Rows: 10
						}
					}
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				formConfig.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: "{{portals.common.controls.notifications.emails.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		formConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	public getWebHookNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (formConfig: AppFormsControlConfig) => void) {
		const formConfig: AppFormsControlConfig = {
			Name: "WebHooks",
			Options: {
				Label: "{{portals.common.controls.notifications.webhooks.label}}",
			},
			SubControls: {
				Controls: [
					{
						Name: "EndpointURLs",
						Type: "TextArea",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.endpointURLs.label}}",
							PlaceHolder: "{{portals.common.controls.notifications.webhooks.endpointURLs.placeholder}}",
							Description: "{{portals.common.controls.notifications.webhooks.endpointURLs.description}}"
						}
					},
					{
						Name: "SignAlgorithm",
						Type: "Select",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signAlgorithm.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.signAlgorithm.description}}",
							SelectOptions: {
								Interface: "popover",
								Values: ["MD5", "SHA1", "SHA256", "SHA384", "SHA512", "RIPEMD160", "BLAKE128", "BLAKE256", "BLAKE384", "BLAKE512"]
							}
						}
					},
					{
						Name: "SignKey",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signKey.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.signKey.description}}"
						}
					},
					{
						Name: "SignatureName",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signatureName.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.signatureName.description}}"
						}
					},
					{
						Name: "SignatureAsHex",
						Type: "YesNo",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signatureAsHex.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "SignatureInQuery",
						Type: "YesNo",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signatureInQuery.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "AdditionalQuery",
						Type: "TextArea",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.additionalQuery.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.additionalQuery.description}}",
							Rows: 10
						}
					},
					{
						Name: "AdditionalHeader",
						Type: "TextArea",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.additionalHeader.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.additionalHeader.description}}",
							Rows: 10
						}
					}
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				formConfig.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: "{{portals.common.controls.notifications.webhooks.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		formConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	public getNotificationsFormControl(name: string, segment?: string, events?: Array<string>, methods?: Array<string>, allowInheritFromParent: boolean = true, inheritEventsAndMethodsFromParent: boolean = false, inheritEmailFromParent: boolean = false, inheritWebHookFromParent: boolean = false, onCompleted?: (formConfig: AppFormsControlConfig) => void) {
		const formConfig: AppFormsControlConfig = {
			Name: name,
			Segment: segment,
			SubControls: {
				Controls: [
					{
						Name: "Events",
						Type: "Select",
						Hidden: inheritEventsAndMethodsFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.events}}",
							SelectOptions: {
								Multiple: true,
								AsBoxes: true,
								Values: (events || ["Create", "Update", "Delete", "Register", "Request"]).map(value => {
									return {
										Value: value,
										Label: `{{events.${value}}}`
									};
								})
							}
						}
					},
					{
						Name: "Methods",
						Type: "Select",
						Hidden: inheritEventsAndMethodsFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.methods}}",
							SelectOptions: {
								Multiple: true,
								AsBoxes: true,
								Values: methods || ["Email", "WebHook"]
							}
						}
					}
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				formConfig.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: "{{portals.common.controls.notifications.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) => formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name === "Events" || ctrl.Name === "Methods").forEach(ctrl => {
							ctrl.Hidden = event.detail.checked;
							formControl.formGroup.controls[ctrl.Name].setValue([], { onlySelf: true });
						})
					}
				},
				0
			);
		}

		if (methods === undefined || methods.indexOf("Email") > -1) {
			formConfig.SubControls.Controls.push(this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmailFromParent));
		}

		if (methods === undefined || methods.indexOf("WebHook") > -1) {
			formConfig.SubControls.Controls.push(this.getWebHookNotificationFormControl(allowInheritFromParent, inheritWebHookFromParent));
		}

		formConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	public getEmailSettingsFormControl(name: string, segment?: string, allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (formConfig: AppFormsControlConfig) => void) {
		const formButtons = this.appFormsSvc.getButtonControls(
			undefined,
			{
				Name: "TestEmailSettings",
				Label: "{{portals.common.controls.emails.test.label}}",
				OnClick: (event, formControl) => {
					console.warn("Test email settings", event, formControl);
				},
				Options: {
					Fill: "clear",
					Color: "primary",
					Css: "ion-float-end",
					Icon: {
						Name: "send",
						Slot: "end"
					}
				}
			}
		);
		formButtons.Hidden = inheritFromParent;
		const formConfig: AppFormsControlConfig = {
		Name: name,
			Segment: segment,
			Options: {
				Label: "{{portals.common.controls.emails.label}}",
			},
			SubControls: {
				Controls: [
					{
						Name: "Sender",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.emails.sender.label}}",
							PlaceHolder: "{{portals.common.controls.emails.sender.placeholder}}",
							MaxLength: 250
						}
					},
					{
						Name: "Signature",
						Type: "TextArea",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.emails.signature.label}}",
							Description: "{{portals.common.controls.emails.signature.description}}"
						}
					},
					{
						Name: "Smtp",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.emails.smtp.label}}"
						},
						SubControls: {
							Controls: [
								{
									Name: "Host",
									Options: {
										Label: "{{portals.common.controls.emails.smtp.host.label}}",
										Description: "{{portals.common.controls.emails.smtp.host.description}}",
										MaxLength: 250
									}
								},
								{
									Name: "Port",
									Options: {
										Label: "{{portals.common.controls.emails.smtp.port.label}}",
										Description: "{{portals.common.controls.emails.smtp.port.description}}",
										Type: "number",
										MinValue: 25,
										MaxValue: 65535
									}
								},
								{
									Name: "EnableSsl",
									Type: "YesNo",
									Options: {
										Label: "{{portals.common.controls.emails.smtp.enableSsl}}",
										Type: "toggle"
									}
								},
								{
									Name: "User",
									Options: {
										Label: "{{portals.common.controls.emails.smtp.user.label}}",
										Description: "{{portals.common.controls.emails.smtp.user.description}}",
										MaxLength: 250
									}
								},
								{
									Name: "UserPassword",
									Options: {
										Label: "{{portals.common.controls.emails.smtp.userPassword.label}}",
										Description: "{{portals.common.controls.emails.smtp.userPassword.description}}",
										MaxLength: 250,
										Type: "password"
									}
								}
							]
						}
					},
					formButtons
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				formConfig.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: "{{portals.common.controls.emails.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		formConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	public getRolesSelector(modalComponent: any, modalComponentProperties?: { [key: string]: any }) {
		return {
			prepare: async (role: AppFormsLookupValue) => {
				if (!Role.contains(role.Value)) {
					await this.getRoleAsync(role.Value, undefined, undefined, true);
				}
				role.Label = (Role.get(role.Value) || new Role("", "Unknown")).FullTitle;
			},
			modalComponent: modalComponent,
			modalComponentProperties: modalComponentProperties
		};
	}

	public get organizationCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const organization = data !== undefined
				? data instanceof Organization
					? data as Organization
					: Organization.deserialize(data)
				: undefined;
			return organization !== undefined
				? { title: organization.Title, description: organization.Description, originalObject: organization }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("organization", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Organization.contains(obj.ID) ? convertToCompleterItem(Organization.get(obj.ID)) : convertToCompleterItem(Organization.update(Organization.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchOrganization(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("organization", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Organization.contains(obj.ID)) {
							Organization.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching organization(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchOrganizationAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("organization", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Organization.contains(obj.ID)) {
							Organization.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching organization(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("organization"),
			body,
			data => {
				Organization.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Organization.contains(id) && Organization.get(id).Modules.length > 0) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("organization", id),
				data => {
					Organization.update(data);
					if (AppUtility.isArray(data.Modules, true)) {
						(data.Modules as Array<any>).forEach(module => {
							Module.update(module);
							if (AppUtility.isArray(module.ContentTypes, true)) {
								(module.ContentTypes as Array<any>).forEach(contentType => ContentType.update(contentType));
							}
						});
					}
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting an organization", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public getOrganization(id: string, getActiveOrganizationWhenNotFound: boolean = true) {
		const organization = Organization.get(id);
		if (organization !== undefined && (organization.Modules === undefined || organization.Modules.length < 1 || organization.ContentTypes === undefined || organization.ContentTypes.length < 1)) {
			this.getOrganizationAsync(organization.ID);
		}
		return organization || (getActiveOrganizationWhenNotFound ? this.activeOrganization : undefined);
	}

	public async updateOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("organization", body.ID),
			body,
			data => {
				Organization.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating an organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.deleteAsync(
			super.getURI("organization", id),
			data => {
				Organization.instances.remove(id);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting an organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private processOrganizationUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Organization.update(message.Data);
				break;

			case "Delete":
				Organization.instances.remove(message.Data.ID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of an organization"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Organization", Type: `${message.Type.Event}d`, ID: message.Data.ID });
	}

	public get roleCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const role = data !== undefined
				? data instanceof Role
					? data as Role
					: Role.deserialize(data)
				: undefined;
			return role !== undefined
				? { title: role.FullTitle, description: role.Description, originalObject: role }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("role", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => {
				const role = Role.get(obj.ID);
				return role === undefined
					? convertToCompleterItem(this.fetchRole(Role.update(obj)))
					: role.childrenIDs === undefined
						? convertToCompleterItem(this.fetchRole(role))
						: convertToCompleterItem(role);
			}),
			convertToCompleterItem
		);
	}

	public searchRole(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("role", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						const role = Role.get(obj.ID);
						if (role === undefined) {
							this.fetchRole(Role.update(obj));
						}
						else if (role.childrenIDs === undefined) {
							this.fetchRole(role);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching role(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchRoleAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("role", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						const role = Role.get(obj.ID);
						if (role === undefined) {
							this.fetchRole(Role.update(obj));
						}
						else if (role.childrenIDs === undefined) {
							this.fetchRole(role);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching role(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createRoleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("role"),
			body,
			data => {
				this.updateRole(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new role", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getRoleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const role = Role.get(id);
		if (role !== undefined && role.childrenIDs !== undefined) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("role", id),
				data => {
					this.updateRole(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a role", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateRoleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		const parentID = Role.contains(body.ID) ? Role.get(body.ID).ParentID : undefined;
		await super.updateAsync(
			super.getURI("role", body.ID),
			body,
			data => {
				this.updateRole(data, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a role", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteRoleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Role.contains(id) ? Role.get(id).ParentID : undefined;
		await super.deleteAsync(
			super.getURI("role", id),
			data => {
				this.deleteRole(data.ID, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a role", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	private processRoleUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				this.updateRole(message.Data);
				break;

			case "Delete":
				this.deleteRole(message.Data.ID, message.Data.ParentID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a role"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Role", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined });
		if (AppUtility.isNotEmpty(message.Data.ParentID)) {
			AppEvents.broadcast(this.name, { Object: "Role", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined });
		}
	}

	private fetchRole(role: Role) {
		if (role !== undefined && role.childrenIDs === undefined) {
			this.getRoleAsync(role.ID, _ => {
				const o = Role.get(role.ID);
				if (o.childrenIDs !== undefined && o.childrenIDs.length > 0) {
					o.Children.forEach(c => this.fetchRole(c));
				}
			});
		}
		return role;
	}

	private updateRole(json: any, parentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const role = Role.set(Role.deserialize(json, Role.get(json.ID)));
			if (AppUtility.isArray(json.Children, true)) {
				role.childrenIDs = [];
				(json.Children as Array<any>).map(c => this.updateRole(c)).filter(o => o !== undefined).forEach(o => role.childrenIDs.push(o.ID));
				role.childrenIDs = role.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			let parentRole = Role.get(parentID);
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined && parentRole.ID !== role.ParentID) {
				AppUtility.removeAt(parentRole.childrenIDs, parentRole.childrenIDs.indexOf(role.ID));
			}
			parentRole = role.Parent;
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined && parentRole.childrenIDs.indexOf(role.ID) < 0) {
				parentRole.childrenIDs.push(role.ID);
				parentRole.childrenIDs = parentRole.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			return role;
		}
		return undefined;
	}

	private deleteRole(id: string, parentID?: string) {
		if (Role.contains(id)) {
			const parentRole = Role.get(parentID);
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined) {
				AppUtility.removeAt(parentRole.childrenIDs, parentRole.childrenIDs.indexOf(id));
			}
			Role.all.filter(role => role.ParentID === id).forEach(role => this.deleteRole(role.ID));
			Role.instances.remove(id);
		}
	}

	public get desktopCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const desktop = data !== undefined
				? data instanceof Desktop
					? data as Desktop
					: Desktop.deserialize(data)
				: undefined;
			return desktop !== undefined
				? { title: desktop.FullTitle, description: desktop.Alias, originalObject: desktop }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("desktop", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => {
				const desktop = Desktop.get(obj.ID);
				return desktop === undefined
					? convertToCompleterItem(this.fetchDesktop(Desktop.update(obj)))
					: desktop.childrenIDs === undefined
						? convertToCompleterItem(this.fetchDesktop(desktop))
						: convertToCompleterItem(desktop);
			}),
			convertToCompleterItem
		);
	}

	public searchDesktop(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("desktop", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						const desktop = Desktop.get(obj.ID);
						if (desktop === undefined) {
							this.fetchDesktop(Desktop.update(obj));
						}
						else if (desktop.childrenIDs === undefined) {
							this.fetchDesktop(desktop);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching desktop(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchDesktopAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("desktop", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						const desktop = Desktop.get(obj.ID);
						if (desktop === undefined) {
							this.fetchDesktop(Desktop.update(obj));
						}
						else if (desktop.childrenIDs === undefined) {
							this.fetchDesktop(desktop);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching desktop(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createDesktopAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("desktop"),
			body,
			data => {
				this.updateDesktop(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new desktop", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getDesktopAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const desktop = Desktop.get(id);
		if (desktop !== undefined && desktop.childrenIDs !== undefined) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("desktop", id),
				data => {
					this.updateDesktop(data);
					if (onNext !== undefined) {
						onNext(data);
					}
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a desktop", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateDesktopAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		const parentID = Desktop.contains(body.ID) ? Desktop.get(body.ID).ParentID : undefined;
		await super.updateAsync(
			super.getURI("desktop", body.ID),
			body,
			data => {
				this.updateDesktop(data, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a desktop", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteDesktopAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Desktop.contains(id) ? Desktop.get(id).ParentID : undefined;
		await super.deleteAsync(
			super.getURI("desktop", id),
			data => {
				this.deleteDesktop(data.ID, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a desktop", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	private processDesktopUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				this.updateDesktop(message.Data);
				break;

			case "Delete":
				this.deleteDesktop(message.Data.ID, message.Data.ParentID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a desktop"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Desktop", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined });
		if (AppUtility.isNotEmpty(message.Data.ParentID)) {
			AppEvents.broadcast(this.name, { Object: "Desktop", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined });
		}
	}

	private fetchDesktop(desktop: Desktop) {
		if (desktop !== undefined && desktop.childrenIDs === undefined) {
			this.getDesktopAsync(desktop.ID, _ => {
				const o = Desktop.get(desktop.ID);
				if (o.childrenIDs !== undefined && o.childrenIDs.length > 0) {
					o.Children.forEach(c => this.fetchDesktop(c));
				}
			});
		}
		return desktop;
	}

	private updateDesktop(json: any, oldParentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const desktop = Desktop.set(Desktop.deserialize(json, Desktop.get(json.ID)));
			if (AppUtility.isArray(json.Children, true)) {
				desktop.childrenIDs = [];
				(json.Children as Array<any>).map(c => this.updateDesktop(c)).filter(o => o !== undefined).forEach(o => desktop.childrenIDs.push(o.ID));
				desktop.childrenIDs = desktop.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			let parentDesktop = Desktop.get(oldParentID);
			if (parentDesktop !== undefined && parentDesktop.childrenIDs !== undefined && parentDesktop.ID !== desktop.ParentID) {
				AppUtility.removeAt(parentDesktop.childrenIDs, parentDesktop.childrenIDs.indexOf(desktop.ID));
			}
			parentDesktop = desktop.Parent;
			if (parentDesktop !== undefined && parentDesktop.childrenIDs !== undefined && parentDesktop.childrenIDs.indexOf(desktop.ID) < 0) {
				parentDesktop.childrenIDs.push(desktop.ID);
				parentDesktop.childrenIDs = parentDesktop.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			return desktop;
		}
		return undefined;
	}

	private deleteDesktop(id: string, parentID?: string) {
		if (Desktop.contains(id)) {
			const parentDesktop = Desktop.get(parentID);
			if (parentDesktop !== undefined && parentDesktop.childrenIDs !== undefined) {
				AppUtility.removeAt(parentDesktop.childrenIDs, parentDesktop.childrenIDs.indexOf(id));
			}
			Desktop.all.filter(desktop => desktop.ParentID === id).forEach(desktop => this.deleteDesktop(desktop.ID));
			Desktop.instances.remove(id);
		}
	}

	public get siteCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const site = data !== undefined
				? data instanceof Site
					? data as Site
					: Site.deserialize(data)
				: undefined;
			return site !== undefined
				? { title: site.Title, description: `${site.SubDomain}.${site.PrimaryDomain}`, originalObject: site }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("site", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Site.contains(obj.ID) ? convertToCompleterItem(Site.get(obj.ID)) : convertToCompleterItem(Site.update(Site.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchSite(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("site", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Site.contains(obj.ID)) {
							Site.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching site(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchSiteAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("site", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Site.contains(obj.ID)) {
							Site.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching site(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createSiteAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("site"),
			body,
			data => {
				Site.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new site", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getSiteAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Site.contains(id)) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("site", id),
				data => {
					Site.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a site", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateSiteAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("site", body.ID),
			body,
			data => {
				Site.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a site", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteSiteAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.deleteAsync(
			super.getURI("site", id),
			data => {
				Site.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a site", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private processSiteUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Site.update(message.Data);
				break;

			case "Delete":
				Site.instances.remove(message.Data.ID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a site"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Site", Type: `${message.Type.Event}d`, ID: message.Data.ID });
	}

	public get moduleCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const module = data !== undefined
				? data instanceof Module
					? data as Module
					: Module.deserialize(data)
				: undefined;
			return module !== undefined
				? { title: module.Title, description: module.Description, originalObject: module }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("module", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Module.contains(obj.ID) ? convertToCompleterItem(Module.get(obj.ID)) : convertToCompleterItem(Module.update(Module.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchModule(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("module", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Module.contains(obj.ID)) {
							Module.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching module(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchModuleAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination?: boolean, useXHR: boolean = false) {
		await super.searchAsync(
			super.getSearchURI("module", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Module.contains(obj.ID)) {
							Module.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching module(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			dontProcessPagination,
			useXHR
		);
	}

	public async createModuleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("module"),
			body,
			data => {
				Module.update(data);
				if (AppUtility.isArray(data.ContentTypes, true)) {
					(data.ContentTypes as Array<any>).forEach(contentType => ContentType.update(contentType));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new module", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getModuleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Module.contains(id)) {
			if (onNext) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("module", id),
				data => {
					Module.update(data);
					if (AppUtility.isArray(data.ContentTypes, true)) {
						(data.ContentTypes as Array<any>).forEach(contentType => ContentType.update(contentType));
					}
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a module", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateModuleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("module", body.ID),
			body,
			data => {
				Module.update(data);
				if (AppUtility.isArray(data.ContentTypes, true)) {
					(data.ContentTypes as Array<any>).forEach(contentType => ContentType.update(contentType));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a module", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteModuleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.deleteAsync(
			super.getURI("module", id),
			data => {
				Module.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a module", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private processModuleUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Module.update(message.Data);
				break;

			case "Delete":
				Module.instances.remove(message.Data.ID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a modul"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Module", Type: `${message.Type.Event}d`, ID: message.Data.ID });
	}

	public get contentTypeCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const contentType = data !== undefined
				? data instanceof ContentType
					? data as ContentType
					: ContentType.deserialize(data)
				: undefined;
			return contentType !== undefined
				? { title: contentType.Title, description: contentType.Description, originalObject: contentType }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("content.type", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => ContentType.contains(obj.ID) ? convertToCompleterItem(ContentType.get(obj.ID)) : convertToCompleterItem(ContentType.update(ContentType.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchContentType(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("content.type", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!ContentType.contains(obj.ID)) {
							ContentType.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching content-type(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchContentTypeAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("content.type", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!ContentType.contains(obj.ID)) {
							ContentType.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching content-type(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createContentTypeAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("content.type"),
			body,
			data => {
				ContentType.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new content-type", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getContentTypeAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (ContentType.contains(id)) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("content.type", id),
				data => {
					ContentType.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a content-type", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateContentTypeAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("content.type", body.ID),
			body,
			data => {
				ContentType.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a content-type", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteContentTypeAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.deleteAsync(
			super.getURI("content.type", id),
			data => {
				ContentType.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a content-type", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private processContentTypeUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				ContentType.update(message.Data);
				break;

			case "Delete":
				if (ContentType.contains(message.Data.ID)) {
					ContentType.instances.remove(message.Data.ID);
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a content-type"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Content.Type", Type: `${message.Type.Event}d`, ID: message.Data.ID });
	}

}
