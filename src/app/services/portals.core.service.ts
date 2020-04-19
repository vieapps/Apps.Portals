import { Injectable } from "@angular/core";
import { AppRTU, AppMessage } from "../components/app.apis";
import { AppEvents } from "../components/app.events";
import { AppUtility } from "../components/app.utility";
import { PlatformUtility } from "../components/app.utility.platform";
import { AppCustomCompleter } from "../components/app.completer";
import { AppPagination } from "../components/app.pagination";
import { AppFormsControlConfig, AppFormsLookupValue } from "../components/forms.service";
import { Base as BaseService } from "./base.service";
import { ConfigurationService } from "./configuration.service";
import { AuthenticationService } from "./authentication.service";
import { Account } from "../models/account";
import { Organization } from "../models/portals.core.organization";
import { Role } from "../models/portals.core.role";

@Injectable()
export class PortalsCoreService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService
	) {
		super("Portals");
		this.initialize();
		AppRTU.registerAsObjectScopeProcessor(this.name, "Organization", message => this.processOrganizationUpdateMessageAsync(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Role", message => this.processRoleUpdateMessageAsync(message));
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
		return organization === undefined || organization.ID === ""
			? this.authSvc.isAdministrator(this.name, "Organization", undefined, account)
			: AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isAdministrator(this.name, "Organization", organization.Privileges, account);
	}

	public canModerateOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization === undefined || organization.ID === ""
			? this.authSvc.isModerator(this.name, "Organization", undefined, account)
			: AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isModerator(this.name, "Organization", organization.Privileges, account);
	}

	public getEmailNotificationFormControl(allowInheritFromParent: boolean = true, onPreCompleted?: (formConfig: AppFormsControlConfig) => void) {
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
						Options: {
							Label: "{{portals.common.controls.notifications.emails.toAddresses.label}}",
							PlaceHolder: placeholder,
							Description: "{{portals.common.controls.notifications.emails.toAddresses.description}}"
						}
					},
					{
						Name: "CcAddresses",
						Options: {
							Label: "{{portals.common.controls.notifications.emails.ccAddresses.label}}",
							PlaceHolder: placeholder,
							Description: "{{portals.common.controls.notifications.emails.ccAddresses.description}}"
						}
					},
					{
						Name: "BccAddresses",
						Options: {
							Label: "{{portals.common.controls.notifications.emails.bccAddresses.label}}",
							PlaceHolder: placeholder,
							Description: "{{portals.common.controls.notifications.emails.bccAddresses.description}}"
						}
					},
					{
						Name: "Subject",
						Options: {
							Label: "{{portals.common.controls.notifications.emails.subject.label}}"
						}
					},
					{
						Name: "Body",
						Type: "TextArea",
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
						Label: "{{portals.common.controls.notifications.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		if (onPreCompleted !== undefined) {
			onPreCompleted(formConfig);
		}
		return formConfig;
	}

	public getWebHookNotificationFormControl(allowInheritFromParent: boolean = true, onPreCompleted?: (formConfig: AppFormsControlConfig) => void) {
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
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.endpointURLs.label}}",
							PlaceHolder: "{{portals.common.controls.notifications.webhooks.endpointURLs.placeholder}}",
							Description: "{{portals.common.controls.notifications.webhooks.endpointURLs.description}}"
						}
					},
					{
						Name: "SignAlgorithm",
						Type: "Select",
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
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signKey.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.signKey.description}}"
						}
					},
					{
						Name: "SignatureName",
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signatureName.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.signatureName.description}}"
						}
					},
					{
						Name: "SignatureAsHex",
						Type: "YesNo",
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signatureAsHex.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "SignatureInQuery",
						Type: "YesNo",
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.signatureInQuery.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "AdditionalQuery",
						Type: "TextArea",
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.additionalQuery.label}}",
							Description: "{{portals.common.controls.notifications.webhooks.additionalQuery.description}}",
							Rows: 10
						}
					},
					{
						Name: "AdditionalHeader",
						Type: "TextArea",
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
						Label: "{{portals.common.controls.notifications.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		if (onPreCompleted !== undefined) {
			onPreCompleted(formConfig);
		}
		return formConfig;
	}

	public getNotificationsFormControl(name: string, segment?: string, events?: Array<string>, methods?: Array<string>, allowInheritFromParent: boolean = true, onPreCompleted?: (formConfig: AppFormsControlConfig) => void) {
		const formConfig: AppFormsControlConfig = {
			Name: name,
			Segment: segment,
			SubControls: {
				Controls: [
					{
						Name: "Events",
						Type: "Select",
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

		if (methods === undefined || methods.indexOf("Email") > -1) {
			formConfig.SubControls.Controls.push(this.getEmailNotificationFormControl(allowInheritFromParent));
		}

		if (methods === undefined || methods.indexOf("WebHook") > -1) {
			formConfig.SubControls.Controls.push(this.getWebHookNotificationFormControl(allowInheritFromParent));
		}

		if (onPreCompleted !== undefined) {
			onPreCompleted(formConfig);
		}
		return formConfig;
	}

	public getEmailSettingsFormControl(name: string, segment?: string, allowInheritFromParent: boolean = true, onPreCompleted?: (formConfig: AppFormsControlConfig) => void) {
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
						Options: {
							Label: "{{portals.common.controls.emails.sender.label}}",
							PlaceHolder: "{{portals.common.controls.emails.sender.placeholder}}",
							MaxLength: 250
						}
					},
					{
						Name: "Signature",
						Type: "TextArea",
						Options: {
							Label: "{{portals.common.controls.emails.signature.label}}",
							Description: "{{portals.common.controls.emails.signature.description}}"
						}
					},
					{
						Name: "Smtp",
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
					{
						Name: "Buttons",
						Type: "Buttons",
						SubControls: {
							Controls: [
								{
									Name: "TestEmail",
									Options: {
										Label: "{{portals.common.controls.emails.test.label}}",
										ButtonOptions: {
											OnClick: (control, formGroup) => {
												console.log("Test send email", AppUtility.clone(formGroup.parent.value, ["InheritFromParent", "Buttons"]));
											},
											Fill: "solid",
											Color: "primary",
											Icon: {
												Name: "send",
												Slot: "start"
											}
										}
									}
								}
							]
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
						Label: "{{portals.common.controls.emails.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		if (onPreCompleted !== undefined) {
			onPreCompleted(formConfig);
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
			if (data === undefined) {
				return undefined;
			}
			const organization = data instanceof Organization ? data as Organization : Organization.deserialize(data);
			return {
				title: organization.Title,
				description: organization.Description,
				originalObject: organization
			};
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("organization", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => {
				if (!Organization.contains(obj.ID)) {
					const organization = Organization.deserialize(obj);
					Organization.update(organization);
					return convertToCompleterItem(organization);
				}
				else {
					return convertToCompleterItem(Organization.get(obj.ID));
				}
			}),
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
				console.error(super.getErrorMessage("Error occurred while searching organization", error));
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
				console.error(super.getErrorMessage("Error occurred while searching organization", error));
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

	private async processOrganizationUpdateMessageAsync(message: AppMessage) {
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
			if (data === undefined) {
				return undefined;
			}
			const role = data instanceof Role ? data as Role : Role.deserialize(data);
			return {
				title: role.Title,
				description: role.Description,
				originalObject: role
			};
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("role", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => {
				if (Role.contains(obj.ID)) {
					return convertToCompleterItem(Role.get(obj.ID));
				}
				else {
					const role = Role.update(obj);
					this.fetchRole(role);
					return convertToCompleterItem(role);
				}
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
					(data.Objects as Array<any>).filter(obj => !Role.contains(obj.ID)).forEach(obj => this.fetchRole(Role.update(obj)));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching role", error));
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
					(data.Objects as Array<any>).filter(obj => !Role.contains(obj.ID)).forEach(obj => this.fetchRole(Role.update(obj)));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching role", error));
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
						console.error(super.getErrorMessage("Error occurred while getting an role", error));
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
				this.updateRole(data, Role.contains(body.ID) ? Role.get(body.ID).ParentID : undefined);
				AppEvents.broadcast("Portals", { Object: "Role", Type: "Updated", ID: body.ID });
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating an role", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
	);
	}

	public deleteRoleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.deleteAsync(
			super.getURI("role", id),
			data => {
				this.deleteRole(data, Role.contains(id) ? Role.get(id).ParentID : undefined);
				AppEvents.broadcast("Portals", { Object: "Role", Type: "Deleted", ID: id });
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting an role", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private async processRoleUpdateMessageAsync(message: AppMessage) {
		switch (message.Type.Event) {
			case "Update":
				this.updateRole(message.Data, message.Data.ParentID);
				AppEvents.broadcast("Portals", { Object: "Role", Type: "Updated", ID: message.Data.ID });
				break;

			case "Delete":
				this.deleteRole(message.Data.ID, message.Data.ParentID);
				AppEvents.broadcast("Portals", { Object: "Role", Type: "Deleted", ID: message.Data.ID });
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
	}

	private updateRole(json: any, oldParentID?: string) {
		const role = Role.set(Role.deserialize(json, Role.get(json.ID)));
		if (AppUtility.isObject(json, true) && AppUtility.isArray(json.Children, true)) {
			role.childrenIDs = [];
			(json.Children as Array<any>).forEach(cdata => {
				const crole = this.updateRole(cdata);
				crole.ParentID = role.ID;
				role.childrenIDs.push(crole.ID);
			});
			role.childrenIDs = role.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
		}
		let parentRole = oldParentID !== undefined ? Role.get(oldParentID) : undefined;
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

	private deleteRole(id: string, parentID?: string) {
		if (Role.contains(id)) {
			const parentRole = parentID !== undefined ? Role.get(parentID) : undefined;
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined) {
				AppUtility.removeAt(parentRole.childrenIDs, parentRole.childrenIDs.indexOf(id));
			}
			Role.all.filter(role => role.ParentID === id).forEach(role => this.deleteRole(role.ID));
			Role.instances.remove(id);
		}
	}

}
