import { Injectable } from "@angular/core";
import { AppRTU, AppMessage } from "../components/app.apis";
import { AppEvents } from "../components/app.events";
import { AppUtility } from "../components/app.utility";
import { PlatformUtility } from "../components/app.utility.platform";
import { AppCustomCompleter } from "../components/app.completer";
import { AppPagination } from "../components/app.pagination";
import { AppFormsControlConfig, AppFormsSegment, AppFormsService } from "../components/forms.service";
import { Base as BaseService } from "./base.service";
import { ConfigurationService } from "./configuration.service";
import { UsersService } from "./users.service";
import { AuthenticationService } from "./authentication.service";
import { Account } from "../models/account";
import { UserProfile } from "../models/user";
import { Organization } from "../models/portals.core.organization";
import { Role } from "../models/portals.core.role";

@Injectable()
export class PortalsCoreService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
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

	public get organizationCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const organization = data instanceof Organization ? data as Organization : Organization.deserialize(data);
			return {
				title: organization.Title,
				description: organization.Description,
				originalObject: organization
			};
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("organization", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(organization => convertToCompleterItem(organization)),
			convertToCompleterItem
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

	public async getOrganizationFormSegmentsAsync(organization: Organization, onPreCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.organizations.update.segments.basic")),
			new AppFormsSegment("privileges", await this.configSvc.getResourceAsync("portals.organizations.update.segments.privileges")),
			new AppFormsSegment("notifications", await this.configSvc.getResourceAsync("portals.organizations.update.segments.notifications")),
			new AppFormsSegment("instructions", await this.configSvc.getResourceAsync("portals.organizations.update.segments.instructions")),
			new AppFormsSegment("socials", await this.configSvc.getResourceAsync("portals.organizations.update.segments.socials")),
			new AppFormsSegment("urls", await this.configSvc.getResourceAsync("portals.organizations.update.segments.urls")),
			new AppFormsSegment("emails", await this.configSvc.getResourceAsync("portals.organizations.update.segments.emails"))
		];
		if (organization !== undefined && AppUtility.isNotEmpty(organization.ID)) {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("portals.organizations.update.segments.attachments")));
		}
		if (onPreCompleted !== undefined) {
			onPreCompleted(formSegments);
		}
		return formSegments;
	}

	public async getOrganizationFormControlsAsync(organization: Organization, onPreCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const socials: Array<string> = await this.configSvc.getDefinitionAsync(this.name, "socials");
		const trackings: Array<string> = await this.configSvc.getDefinitionAsync(this.name, "trackings");
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.name, "organization", "form-controls");
		formConfig.forEach(ctrl => ctrl.Segment = "basic");

		formConfig.push(
			{
				Name: "Privileges",
				Type: "Custom",
				Segment: "privileges",
				Extras: { AllowInheritFromParent: false },
				Options: {
					Type: "object-privileges"
				}
			},
			this.getNotificationsFormControl("Notifications", "notifications", undefined, undefined, false),
			{
				Name: "Instructions",
				Segment: "instructions",
				Type: "Nothing",
				Options: {
					Description: "{{portals.organizations.controls.Instructions.description}}"
				},
				SubControls: {
					Controls: Organization.instructionElements.map(type => {
						return {
							Name: type,
							Options: {
								Label: `{{portals.organizations.controls.Instructions.${type}.label}}`
							},
							SubControls: {
								Controls: [
									{
										Name: "Language",
										Type: "Select",
										Options: {
											Label: "{{portals.organizations.controls.Instructions.language}}",
											SelectOptions: {
												Values: this.configSvc.appConfig.languages,
												Interface: "popover"
											}
										}
									},
									{
										Name: "Subject",
										Options: {
											Label: `{{portals.organizations.controls.Instructions.${type}.Subject}}`,
											MaxLength: 250
										}
									},
									{
										Name: "Body",
										Type: "TextArea",
										Options: {
											Label: `{{portals.organizations.controls.Instructions.${type}.Body}}`,
											Rows: 7
										}
									}
								]
							}
						};
					})
				}
			},
			{
				Name: "Socials",
				Segment: "socials",
				Type: "Select",
				Options: {
					Label: "{{portals.organizations.controls.Socials}}",
					SelectOptions: {
						Multiple: true,
						AsBoxes: true,
						Values: socials
					}
				}
			},
			{
				Name: "Trackings",
				Segment: "socials",
				Options: {
					Label: "{{portals.organizations.controls.Trackings.label}}"
				},
				SubControls: {
					Controls: trackings.map(tracking => {
						return {
							Name: tracking,
							Options: {
								Label: `{{portals.organizations.controls.Trackings.${tracking}.label}}`,
								Description: `{{portals.organizations.controls.Trackings.${tracking}.description}}`
							}
						};
					})
				}
			},
			{
				Name: "Others",
				Segment: "socials",
				Options: {
					Label: "{{portals.organizations.controls.Others.label}}"
				},
				SubControls: {
					Controls: [
						{
							Name: "MetaTags",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.Others.MetaTags.label}}",
								Description: "{{portals.organizations.controls.Others.MetaTags.description}}",
								Rows: 10
							}
						},
						{
							Name: "Scripts",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.Others.Scripts.label}}",
								Description: "{{portals.organizations.controls.Others.Scripts.description}}",
								Rows: 15
							}
						}
					]
				}
			},
			{
				Name: "RefreshUrls",
				Segment: "urls",
				Options: {
					Label: "{{portals.organizations.controls.RefreshUrls.label}}",
				},
					SubControls: {
					Controls: [
						{
							Name: "Addresses",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.RefreshUrls.Addresses.label}}",
								Description: "{{portals.organizations.controls.RefreshUrls.Addresses.description}}",
								Rows: 10
							}
						},
						{
							Name: "Interval",
							Type: "Range",
							Options: {
								Label: "{{portals.organizations.controls.RefreshUrls.Interval.label}}",
								Description: "{{portals.organizations.controls.RefreshUrls.Interval.description}}",
								Type: "number",
								MinValue: 5,
								MaxValue: 120,
								RangeOptions: {
									AllowPin: true,
									AllowSnaps: true,
									AllowTicks: true,
									Step: 5,
									Icons: {
										Start: "time"
									}
								}
							}
						}
					]
				}
			},
			{
				Name: "RedirectUrls",
				Segment: "urls",
				Options: {
					Label: await this.appFormsSvc.getResourceAsync("portals.organizations.controls.RedirectUrls.label")
				},
				SubControls: {
					Controls: [
						{
							Name: "Addresses",
							Type: "TextArea",
							Options: {
								Label: "{{portals.organizations.controls.RedirectUrls.Addresses.label}}",
								Description: "{{portals.organizations.controls.RedirectUrls.Addresses.description}}",
								Rows: 10
							}
						},
						{
							Name: "AllHttp404",
							Type: "YesNo",
							Options: {
								Label: "{{portals.organizations.controls.RedirectUrls.AllHttp404}}",
								Type: "toggle"
							}
						}
					]
				}
			},
			this.getEmailSettingsFormControl("EmailSettings", "emails", false),
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Type = "TextArea";
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "OwnerID"));
		control.Required = true;
		if (this.authSvc.isSystemAdministrator()) {
			let initialValue: any;
			if (organization !== undefined && AppUtility.isNotEmpty(organization.OwnerID)) {
				initialValue = UserProfile.get(organization.OwnerID);
				if (initialValue === undefined) {
					await this.usersSvc.getProfileAsync(organization.OwnerID, () => initialValue = UserProfile.get(organization.OwnerID), undefined, true);
				}
			}
			control.Type = "Lookup";
			control.Hidden = false;
			control.Options.LookupOptions = {
				AsCompleter: true,
				CompleterOptions: {
					DataSource: this.usersSvc.completerDataSource,
					InitialValue: initialValue,
					OnSelected: (event, formControl) => formControl.setValue(AppUtility.isObject(event, true) && event.originalObject !== undefined && AppUtility.isNotEmpty(event.originalObject.ID) ? event.originalObject.ID : undefined)
				}
			};
		}
		else {
			control.Type = "TextBox";
			control.Hidden = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Status"));
		control.Options.SelectOptions.Interface = "popover";
		if (AppUtility.isNotEmpty(control.Options.SelectOptions.Values)) {
			control.Options.SelectOptions.Values = (AppUtility.toArray(control.Options.SelectOptions.Values) as Array<string>).map(value => {
				return { Value: value, Label: `{{status.approval.${value}}}` };
			});
		}
		if (!this.authSvc.isSystemAdministrator()) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ExpiredDate"));
		control.Type = "DatePicker";
		control.Required = false;
		control.Options.DatePickerOptions = { AllowTimes: false };
		if (!this.authSvc.isSystemAdministrator()) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "FilesQuotes"));
		control.Type = "Range";
		control.Options.MinValue = 0;
		control.Options.MaxValue = 100;
		control.Options.RangeOptions = {
			AllowPin: true,
			AllowSnaps: true,
			AllowTicks: true,
			Step: 10,
			Icons: {
				Start: "cloud-done",
				End: "cloud"
			}
		};
		if (!this.authSvc.isSystemAdministrator()) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Required2FA"));
		control.Options.Type = "toggle";

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "TrackDownloadFiles"));
		control.Options.Type = "toggle";

		/*
		control = formConfig.find(c => AppUtility.isEquals(c.Name, "Theme"));
		control.Type = "Select";
		control.Options.Type = "dropdown";
		control.Options.SelectOptions = { Values: ["default", "blueocean"].map(value => {
			return { Value: value, Label: value };
		})};
		control.Options.OnChanged = (event, formControl) => console.log("SELECT", event, formControl.formControl, formControl.control);
		*/

		control = formConfig.find(ctrl => ctrl.Options !== undefined && ctrl.Options.AutoFocus) || formConfig.find(ctrl => AppUtility.isEquals(ctrl.Type, "TextBox") && !ctrl.Hidden);
		if (control !== undefined) {
			control.Options.AutoFocus = true;
		}

		if (onPreCompleted !== undefined) {
			onPreCompleted(formConfig);
		}
		return formConfig;
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

	public get roleCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const role = data instanceof Role ? data as Role : Role.deserialize(data);
			return {
				title: role.Title,
				description: role.Description,
				originalObject: role
			};
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("role", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(role => convertToCompleterItem(role)),
			convertToCompleterItem
		);
	}

	public searchRole(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("role", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(o => Role.update(o));
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
					(data.Objects as Array<any>).forEach(o => Role.update(o));
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
				Role.update(data);
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
		return Role.contains(id)
			? new Promise<void>(onNext !== undefined ? () => onNext() : () => {})
			: super.readAsync(
					super.getURI("role", id),
					data => {
						Role.update(data);
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
				Role.update(data);
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
				Role.instances.remove(id);
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
			case "Create":
			case "Update":
				Role.update(message.Data);
				AppEvents.broadcast("Portals", { Object: "Role", Type: "Updated", ID: message.Data.ID });
				break;

			case "Delete":
				if (Role.contains(message.Data.ID)) {
					Role.instances.remove(message.Data.ID);
					AppEvents.broadcast("Portals", { Object: "Role", Type: "Deleted", ID: message.Data.ID });
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a role"), message);
				break;
		}
	}

}
