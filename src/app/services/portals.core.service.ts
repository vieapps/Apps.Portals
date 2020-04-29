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
import { Role } from "@models/portals.core.role";
import { Desktop } from "@models/portals.core.desktop";
import { Site } from "@models/portals.core.site";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { ModuleDefinition } from "@models/portals.base";

@Injectable()
export class PortalsCoreService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService
	) {
		super("Portals");
		this.initialize();
		AppRTU.registerAsObjectScopeProcessor(this.name, "Organization", message => this.processOrganizationUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Role", message => this.processRoleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Desktop", message => this.processDesktopUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Site", message => this.processSiteUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Module", message => this.processModuleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "ContentType", message => this.processContentTypeUpdateMessage(message));
	}

	public get activeOrganization() {
		if (Organization.active === undefined) {
			Organization.active = Organization.instances.size() > 0 ? Organization.instances.values()[0] : undefined;
		}
		return Organization.active;
	}

	private initialize() {
	}

	public async initializeAsync(onNext?: () => void) {
	}

	public canManageOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization === undefined || !AppUtility.isNotEmpty(organization.ID)
			? this.authSvc.isAdministrator(this.name, "Organization", undefined, account)
			: AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isAdministrator(this.name, "Organization", organization.Privileges, account);
	}

	public canModerateOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization === undefined || !AppUtility.isNotEmpty(organization.ID)
			? this.authSvc.isModerator(this.name, "Organization", undefined, account)
			: AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isModerator(this.name, "Organization", organization.Privileges, account);
	}

	public async getDefinitionsAsync() {
		return await this.configSvc.getDefinitionAsync(this.name, "module.definitions") as ModuleDefinition[];
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
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name === "Events" || ctrl.Name === "Methods").forEach(ctrl => ctrl.Hidden = event.detail.checked)
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
				Name: "TestEmail",
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

	public searchOrganizationAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.searchAsync(
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

	public createOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
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

	public getOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Organization.contains(id)
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
					super.getURI("organization", id),
					data => {
						Organization.update(data);
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

	public updateOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
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

	public deleteOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.deleteAsync(
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
				AppEvents.broadcast("Portals", { Object: "Organization", Type: "Updated", ID: message.Data.ID });
				break;

			case "Delete":
				if (Organization.contains(message.Data.ID)) {
					Organization.instances.remove(message.Data.ID);
					AppEvents.broadcast("Portals", { Object: "Organization", Type: "Deleted", ID: message.Data.ID });
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of an organization"), message);
				break;
		}
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

	public searchRoleAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.searchAsync(
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

	public createRoleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
			super.getURI("role"),
			body,
			data => {
				this.updateRole(data);
				this.broadcastRoleUpdatedEventMessage(body.ID, body.ParentID);
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

	public getRoleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const role = Role.get(id);
		return role !== undefined && role.childrenIDs !== undefined
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
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

	public updateRoleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("role", body.ID),
			body,
			data => {
				const oldParentID = Role.contains(body.ID) ? Role.get(body.ID).ParentID : undefined;
				this.updateRole(data, oldParentID);
				this.broadcastRoleUpdatedEventMessage(body.ID, body.ParentID);
				if (oldParentID !== body.ParentID) {
					this.broadcastRoleUpdatedEventMessage(body.ID, oldParentID);
				}
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

	public deleteRoleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return super.deleteAsync(
			super.getURI("role", id),
			data => {
				const parentID = Role.contains(id) ? Role.get(id).ParentID : undefined;
				this.deleteRole(data, parentID);
				this.broadcastRoleUpdatedEventMessage(id, parentID, "Deleted");
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

	private broadcastRoleUpdatedEventMessage(id: string, parentID: string, type?: string) {
		type = type || "Updated";
		AppEvents.broadcast("Portals", { Object: "Role", Type: type, ID: id, ParentID: AppUtility.isNotEmpty(parentID) ? parentID : undefined });
		if (AppUtility.isNotEmpty(parentID)) {
			AppEvents.broadcast("Portals", { Object: "Role", Type: type, ID: id, ParentID: undefined });
		}
}

	private processRoleUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Update":
				this.updateRole(message.Data, message.Data.ParentID);
				this.broadcastRoleUpdatedEventMessage(message.Data.ID, message.Data.ParentID);
				break;

			case "Delete":
				this.deleteRole(message.Data.ID, message.Data.ParentID);
				this.broadcastRoleUpdatedEventMessage(message.Data.ID, message.Data.ParentID, "Deleted");
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a role"), message);
				break;
		}
	}

	private fetchRole(role: Role) {
		if (role !== undefined && role.childrenIDs === undefined) {
			this.getRoleAsync(role.ID, _ => {
				const r = Role.get(role.ID);
				if (r.childrenIDs !== undefined && r.childrenIDs.length > 0) {
					r.Children.forEach(c => this.fetchRole(c));
				}
			});
		}
		return role;
	}

	private updateRole(json: any, oldParentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const role = Role.set(Role.deserialize(json, Role.get(json.ID)));
			if (AppUtility.isArray(json.Children, true)) {
				role.childrenIDs = [];
				(json.Children as Array<any>).map(c => this.updateRole(c)).filter(r => r !== undefined).forEach(r => role.childrenIDs.push(r.ID));
				role.childrenIDs = role.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			let parentRole = Role.get(oldParentID);
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

	public searchDesktopAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.searchAsync(
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

	public createDesktopAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
			super.getURI("desktop"),
			body,
			data => {
				this.updateDesktop(data);
				this.broadcastDesktopUpdatedEventMessage(body.ID, body.ParentID);
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

	public getDesktopAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const desktop = Desktop.get(id);
		return desktop !== undefined && desktop.childrenIDs !== undefined
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
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

	public updateDesktopAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("desktop", body.ID),
			body,
			data => {
				const oldParentID = Desktop.contains(body.ID) ? Desktop.get(body.ID).ParentID : undefined;
				this.updateDesktop(data, oldParentID);
				this.broadcastDesktopUpdatedEventMessage(body.ID, body.ParentID);
				if (oldParentID !== body.ParentID) {
					this.broadcastDesktopUpdatedEventMessage(body.ID, oldParentID);
				}
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

	public deleteDesktopAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return super.deleteAsync(
			super.getURI("desktop", id),
			data => {
				const parentID = Desktop.contains(id) ? Desktop.get(id).ParentID : undefined;
				this.deleteDesktop(data, parentID);
				this.broadcastDesktopUpdatedEventMessage(id, parentID, "Deleted");
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

	private broadcastDesktopUpdatedEventMessage(id: string, parentID: string, type?: string) {
		type = type || "Updated";
		AppEvents.broadcast("Portals", { Object: "Desktop", Type: type, ID: id, ParentID: AppUtility.isNotEmpty(parentID) ? parentID : undefined });
		if (AppUtility.isNotEmpty(parentID)) {
			AppEvents.broadcast("Portals", { Object: "Desktop", Type: type, ID: id, ParentID: undefined });
		}
}

	private processDesktopUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Update":
				this.updateDesktop(message.Data, message.Data.ParentID);
				this.broadcastDesktopUpdatedEventMessage(message.Data.ID, message.Data.ParentID);
				break;

			case "Delete":
				this.deleteDesktop(message.Data.ID, message.Data.ParentID);
				this.broadcastDesktopUpdatedEventMessage(message.Data.ID, message.Data.ParentID, "Deleted");
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a desktop"), message);
				break;
		}
	}

	private fetchDesktop(desktop: Desktop) {
		if (desktop !== undefined && desktop.childrenIDs === undefined) {
			this.getDesktopAsync(desktop.ID, _ => {
				const d = Desktop.get(desktop.ID);
				if (d.childrenIDs !== undefined && d.childrenIDs.length > 0) {
					d.Children.forEach(c => this.fetchDesktop(c));
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
				(json.Children as Array<any>).map(c => this.updateDesktop(c)).filter(d => d !== undefined).forEach(d => desktop.childrenIDs.push(d.ID));
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

	public searchSiteAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.searchAsync(
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

	public createSiteAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
			super.getURI("site"),
			body,
			data => {
				Site.update(data);
				AppEvents.broadcast("Portals", { Object: "Site", Type: "Updated", ID: data.ID });
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

	public getSiteAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Site.contains(id)
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
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

	public updateSiteAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("site", body.ID),
			body,
			data => {
				Site.update(data);
				AppEvents.broadcast("Portals", { Object: "Site", Type: "Updated", ID: data.ID });
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

	public deleteSiteAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.deleteAsync(
			super.getURI("site", id),
			data => {
				Site.instances.remove(data.ID);
				AppEvents.broadcast("Portals", { Object: "Site", Type: "Deleted", ID: data.ID });
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
				AppEvents.broadcast("Portals", { Object: "Site", Type: "Updated", ID: message.Data.ID });
				break;

			case "Delete":
				if (Site.contains(message.Data.ID)) {
					Site.instances.remove(message.Data.ID);
					AppEvents.broadcast("Portals", { Object: "Site", Type: "Deleted", ID: message.Data.ID });
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a site"), message);
				break;
		}
	}

	public get moduleCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const modul = data !== undefined
				? data instanceof Module
					? data as Module
					: Module.deserialize(data)
				: undefined;
			return modul !== undefined
				? { title: modul.Title, description: modul.Description, originalObject: modul }
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

	public searchModuleAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination?: boolean, useXHR: boolean = false) {
		return super.searchAsync(
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

	public createModuleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
			super.getURI("module"),
			body,
			data => {
				Module.update(data);
				AppEvents.broadcast("Portals", { Object: "Module", Type: "Updated", ID: data.ID });
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

	public getModuleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Module.contains(id)
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
					super.getURI("module", id),
					data => {
						Module.update(data);
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

	public updateModuleAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("module", body.ID),
			body,
			data => {
				Module.update(data);
				AppEvents.broadcast("Portals", { Object: "Module", Type: "Updated", ID: data.ID });
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

	public deleteModuleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.deleteAsync(
			super.getURI("module", id),
			data => {
				Module.instances.remove(data.ID);
				AppEvents.broadcast("Portals", { Object: "Module", Type: "Deleted", ID: data.ID });
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
				AppEvents.broadcast("Portals", { Object: "Module", Type: "Updated", ID: message.Data.ID });
				break;

			case "Delete":
				if (Module.contains(message.Data.ID)) {
					Module.instances.remove(message.Data.ID);
					AppEvents.broadcast("Portals", { Object: "Module", Type: "Deleted", ID: message.Data.ID });
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a modul"), message);
				break;
		}
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

	public searchContentTypeAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.searchAsync(
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

	public createContentTypeAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.createAsync(
			super.getURI("content.type"),
			body,
			data => {
				ContentType.update(data);
				AppEvents.broadcast("Portals", { Object: "ContentType", Type: "Updated", ID: data.ID });
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

	public getContentTypeAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return ContentType.contains(id)
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
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

	public updateContentTypeAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("content.type", body.ID),
			body,
			data => {
				ContentType.update(data);
				AppEvents.broadcast("Portals", { Object: "ContentType", Type: "Updated", ID: data.ID });
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

	public deleteContentTypeAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.deleteAsync(
			super.getURI("content.type", id),
			data => {
				ContentType.instances.remove(data.ID);
				AppEvents.broadcast("Portals", { Object: "ContentType", Type: "Deleted", ID: data.ID });
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
				AppEvents.broadcast("Portals", { Object: "ContentType", Type: "Updated", ID: message.Data.ID });
				break;

			case "Delete":
				if (ContentType.contains(message.Data.ID)) {
					ContentType.instances.remove(message.Data.ID);
					AppEvents.broadcast("Portals", { Object: "ContentType", Type: "Deleted", ID: message.Data.ID });
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a content-type"), message);
				break;
		}
	}

}
