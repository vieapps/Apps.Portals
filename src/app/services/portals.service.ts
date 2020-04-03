import { Dictionary } from "typescript-collections";
import { List } from "linqts";
import { Injectable } from "@angular/core";
import { AppStorage } from "../components/app.storage";
import { AppRTU, AppMessage } from "../components/app.apis";
import { AppEvents } from "../components/app.events";
import { AppUtility } from "../components/app.utility";
import { PlatformUtility } from "../components/app.utility.platform";
import { AppCustomCompleter } from "../components/app.completer";
import { AppPagination } from "../components/app.pagination";
import { AppFormsControlConfig, AppFormsService } from "../components/forms.service";
import { Organization } from "../models/portals.organization";
import { Base as BaseService } from "./base.service";
import { ConfigurationService } from "./configuration.service";

@Injectable()
export class PortalsService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService
	) {
		super("Portals");
		this.initialize();
	}

	private initialize() {
	}

	public async initializeAsync(onNext?: () => void) {
	}

	public get organizationCompleterDataSource() {
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("organization", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(o => {
				const organization = Organization.deserialize(o);
				return {
					title: organization.Title,
					description: organization.Description,
					originalObject: organization
				};
			})
		);
	}

	public searchOrganization(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("organization", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(o => Organization.update(o));
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
					(data.Objects as Array<any>).forEach(o => Organization.update(o));
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
			super.getURI("organization", body.ID),
			body,
			onNext,
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new organization", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public getOrganizationAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		const organization = Organization.instances.getValue(id);
		if (organization !== undefined) {
			return new Promise<void>(onNext !== undefined ? () => onNext(organization) : () => {});
		}
		else {
			return super.readAsync(
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
				}
			);
		}
	}

	public updateOrganizationAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.updateAsync(
			super.getURI("organization", body.ID),
			body,
			onNext,
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

	public async GetEmailNotificationControlConfigAsync(allowInheritFromParent: boolean = true, additionalBodyDescription?: string) {
		const placeholder = await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.toAddresses.placeholder");
		const config: AppFormsControlConfig = {
			Name: "Emails",
			Options: {
				Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.label"),
			},
			SubControls: {
				Controls: [
					{
						Name: "ToAddresses",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.toAddresses.label"),
							PlaceHolder: placeholder,
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.toAddresses.description")
						}
					},
					{
						Name: "CcAddresses",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.ccAddresses.label"),
							PlaceHolder: placeholder,
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.ccAddresses.description")
						}
					},
					{
						Name: "BccAddresses",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.bccAddresses.label"),
							PlaceHolder: placeholder,
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.bccAddresses.description")
						}
					},
					{
						Name: "Subject",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.subject.label")
						}
					},
					{
						Name: "Body",
						Type: "TextArea",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.body.label"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.emails.body.description") + (additionalBodyDescription !== undefined ? `<br/>${additionalBodyDescription}}` : ""),
							Rows: 10
						}
					}
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				config.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.inheritFromParent"),
						Type: "toggle",
						OnChanged: (event, control) =>  control.parent.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		return config;
	}

	public async GetWebHookNotificationControlConfigAsync(allowInheritFromParent: boolean = true) {
		const config: AppFormsControlConfig = {
			Name: "WebHooks",
			Options: {
				Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.label"),
			},
			SubControls: {
				Controls: [
					{
						Name: "EndpointURLs",
						Type: "TextArea",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.endpointURLs.label"),
							PlaceHolder: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.endpointURLs.placeholder"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.endpointURLs.description")
						}
					},
					{
						Name: "SignAlgorithm",
						Type: "Select",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signAlgorithm.label"),
							SelectOptions: {
								Interface: "popover",
								Values: ["MD5", "SHA1", "SHA256", "SHA384", "SHA512", "RIPEMD160", "BLAKE128", "BLAKE256", "BLAKE384", "BLAKE512"].map(value => {
									return {
										Value: value,
										Label: value
									};
								})
							}
						}
					},
					{
						Name: "SignKey",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signKey.label"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signKey.description")
						}
					},
					{
						Name: "SignatureName",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signatureName.label"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signatureName.description")
						}
					},
					{
						Name: "SignatureAsHex",
						Type: "YesNo",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signatureAsHex.label"),
							Type: "toggle"
						}
					},
					{
						Name: "SignatureInQuery",
						Type: "YesNo",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.signatureInQuery.label"),
							Type: "toggle"
						}
					},
					{
						Name: "AdditionalQuery",
						Type: "TextArea",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.additionalQuery.label"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.additionalQuery.description"),
							Rows: 10
						}
					},
					{
						Name: "AdditionalHeader",
						Type: "TextArea",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.additionalHeader.label"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.webhooks.additionalHeader.description"),
							Rows: 10
						}
					}
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				config.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.inheritFromParent"),
						Type: "toggle",
						OnChanged: (event, control) =>  control.parent.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		return config;
	}

	public async GetNotificationsControlConfigAsync(name: string, segment?: string, events?: Array<string>, methods?: Array<string>, allowInheritFromParent: boolean = true, additionalBodyDescription?: string) {
		const config: AppFormsControlConfig = {
			Name: name,
			Segment: segment,
			SubControls: {
				Controls: [
					{
						Name: "Events",
						Type: "Select",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.events"),
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
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.notifications.methods"),
							SelectOptions: {
								Multiple: true,
								AsBoxes: true,
								Values: (methods || ["Email", "WebHook"]).map(value => {
									return {
										Value: value,
										Label: value
									};
								})
							}
						}
					}
				]
			}
		};

		if (methods === undefined || methods.findIndex(method => method === "Email") > -1) {
			config.SubControls.Controls.push(await this.GetEmailNotificationControlConfigAsync(allowInheritFromParent, additionalBodyDescription));
		}

		if (methods === undefined || methods.findIndex(method => method === "WebHook") > -1) {
			config.SubControls.Controls.push(await this.GetWebHookNotificationControlConfigAsync(allowInheritFromParent));
		}

		return config;
	}

	public async GetEmailSettingsControlConfigAsync(name: string, segment?: string, allowInheritFromParent: boolean = true) {
		const config: AppFormsControlConfig = {
			Name: name,
			Segment: segment,
			Options: {
				Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.label"),
			},
			SubControls: {
				Controls: [
					{
						Name: "From",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.from.label"),
							PlaceHolder: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.from.placeholder"),
							MaxLength: 250
						}
					},
					{
						Name: "ReplyTo",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.replyTo"),
							PlaceHolder: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.from.placeholder"),
							MaxLength: 250
						}
					},
					{
						Name: "Signature",
						Type: "TextArea",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.signature.label"),
							Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.signature.description")
						}
					},
					{
						Name: "Smtp",
						Options: {
							Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.label")
						},
						SubControls: {
							Controls: [
								{
									Name: "Host",
									Options: {
										Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.host.label"),
										Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.host.description"),
										MaxLength: 250
									}
								},
								{
									Name: "Port",
									Options: {
										Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.port.label"),
										Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.port.description"),
										Type: "number",
										MinValue: 25,
										MaxValue: 65535
									}
								},
								{
									Name: "EnableSsl",
									Type: "YesNo",
									Options: {
										Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.enableSsl"),
										Type: "toggle"
									}
								},
								{
									Name: "UserName",
									Options: {
										Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.userName.label"),
										Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.userName.description"),
										MaxLength: 250
									}
								},
								{
									Name: "UserPassword",
									Options: {
										Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.userPassword.label"),
										Description: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.smtp.userPassword.description"),
										MaxLength: 250,
										Type: "password"
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
				config.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.inheritFromParent"),
						Type: "toggle",
						OnChanged: (event, control) =>  control.parent.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		return config;
	}

}
