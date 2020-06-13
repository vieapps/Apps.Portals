import { Injectable } from "@angular/core";
import { AppRTU, AppMessage } from "@components/app.apis";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { AppCustomCompleter } from "@components/app.completer";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControlConfig, AppFormsControlLookupOptionsConfig, AppFormsLookupValue, AppFormsControl, AppFormsService } from "@components/forms.service";
import { AppFormsControlComponent } from "@components/forms.control.component";
import { FilesProcessorModalPage } from "@controls/common/file.processor.modal.page";
import { FileOptions } from "@services/files.service";
import { Base as BaseService } from "@services/base.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { UsersService } from "@services/users.service";
import { AttachmentInfo } from "@models/base";
import { Account } from "@models/account";
import { PortalBase as BaseModel } from "@models/portals.base";
import { PortalCmsBase as CmsBaseModel } from "@models/portals.cms.base";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Expression } from "@models/portals.core.expression";
import { Role } from "@models/portals.core.role";
import { Site } from "@models/portals.core.site";
import { Desktop } from "@models/portals.core.desktop";
import { Portlet } from "@models/portals.core.portlet";

@Injectable()
export class PortalsCoreService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private appFormsSvc: AppFormsService
	) {
		super("Portals");
		this.initialize();
	}

	private _themes: Array<{ name: string, description: string; author: string; intro: string; screenshots: Array<string> }>;

	public get moduleDefinitions() {
		return BaseModel.moduleDefinitions;
	}

	public get contentTypeDefinitions() {
		return BaseModel.contentTypeDefinitions;
	}

	public get activeOrganization() {
		if (Organization.active === undefined) {
			Organization.active = Organization.instances.size() > 0 ? Organization.all[0] : undefined;
			if (Organization.active !== undefined && Organization.active.modules.length < 1) {
				this.getOrganizationAsync(Organization.active.ID);
			}
		}
		return Organization.active;
	}

	private initialize() {
		AppRTU.registerAsObjectScopeProcessor(this.name, "Organization", message => this.processOrganizationUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Organization", message => this.processOrganizationUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Role", message => this.processRoleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Role", message => this.processRoleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Desktop", message => this.processDesktopUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Desktop", message => this.processDesktopUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Portlet", message => this.processPortletUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Portlet", message => this.processPortletUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Site", message => this.processSiteUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Site", message => this.processSiteUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Module", message => this.processModuleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Module", message => this.processModuleUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "ContentType", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.ContentType", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Expression", message => this.processExpressionUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Expression", message => this.processExpressionUpdateMessage(message));
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
			this.getDefinitionsAsync();
			this.getActiveOrganizationAsync(false);
		}
		else {
			AppEvents.on("App", info => {
				if (info.args.Type === "Initialized") {
					this.getDefinitionsAsync();
					this.getActiveOrganizationAsync(false);
				}
			});
		}
	}

	public async initializeAysnc() {
		await this.getDefinitionsAsync(() => {
			if (this.configSvc.isDebug) {
				console.log("[Portal]: The definitions were initialized", BaseModel.moduleDefinitions);
			}
		});
		if (Organization.active === undefined) {
			await this.getActiveOrganizationAsync(false);
			if (this.configSvc.isDebug) {
				console.log("[Portal]: The active organization was initialized", Organization.active);
			}
		}
		else if (Organization.active.modules.length < 1) {
			await this.getActiveOrganizationAsync(false);
			if (this.configSvc.isDebug) {
				console.log("[Portal]: Modules of the active organization were initialized", Organization.active.modules);
			}
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

	public async getDefinitionsAsync(onNext?: () => void) {
		if (BaseModel.moduleDefinitions === undefined) {
			const path = this.configSvc.getDefinitionPath(this.name, "module.definitions");
			BaseModel.moduleDefinitions = this.configSvc.getDefinition(path);
			if (BaseModel.moduleDefinitions === undefined) {
				BaseModel.moduleDefinitions = await this.configSvc.fetchDefinitionAsync(path, false);
				BaseModel.moduleDefinitions.forEach(definition => {
					definition.ContentTypeDefinitions.forEach(contentTypeDefinition => contentTypeDefinition.ModuleDefinition = definition);
					definition.ObjectDefinitions.forEach(objectDefinition => objectDefinition.ModuleDefinition = definition);
				});
			}
			if (onNext !== undefined) {
				onNext();
			}
		}
		return BaseModel.moduleDefinitions;
	}

	public async getThemesAsync(onNext?: () => void) {
		if (this._themes === undefined) {
			const path = this.configSvc.getDefinitionPath(this.name, "themes");
			this._themes = this.configSvc.getDefinition(path) || await this.configSvc.fetchDefinitionAsync(path, false);
			if (onNext !== undefined) {
				onNext();
			}
		}
		return this._themes;
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

	public setLookupOptions(lookupOptions: AppFormsControlLookupOptionsConfig, lookupModalPage: any, contentType: ContentType, multiple?: boolean, nested?: boolean, onPreCompleted?: (options: AppFormsControlLookupOptionsConfig) => void) {
		lookupOptions.ModalOptions = lookupOptions.ModalOptions || {};
		if (lookupModalPage !== undefined) {
			lookupOptions.ModalOptions.Component = lookupModalPage;
		}
		lookupOptions.ModalOptions.ComponentProps = lookupOptions.ModalOptions.ComponentProps || {};
		lookupOptions.ModalOptions.ComponentProps.organizationID = contentType === undefined ? this.activeOrganization.ID : contentType.SystemID;
		lookupOptions.ModalOptions.ComponentProps.moduleID = contentType === undefined ? undefined : contentType.RepositoryID;
		lookupOptions.ModalOptions.ComponentProps.contentTypeID = contentType === undefined ? undefined : contentType.ID;
		if (multiple !== undefined) {
			lookupOptions.ModalOptions.ComponentProps.multiple = AppUtility.isTrue(multiple);
		}
		if (nested !== undefined) {
			lookupOptions.ModalOptions.ComponentProps.nested = AppUtility.isTrue(nested);
		}
		if (onPreCompleted !== undefined) {
			onPreCompleted(lookupOptions);
		}
	}

	public setUISettingsControlOptions(controlConfig: AppFormsControlConfig, replacePattern: string, fileOptions: FileOptions) {
		controlConfig.Options.Label = controlConfig.Options.Label === undefined ? undefined : controlConfig.Options.Label.replace(replacePattern, "portals.common.controls.UISettings");
		controlConfig.Options.Description = controlConfig.Options.Description === undefined ? undefined : controlConfig.Options.Description.replace(replacePattern, "portals.common.controls.UISettings");
		controlConfig.Options.PlaceHolder = controlConfig.Options.PlaceHolder === undefined ? undefined : controlConfig.Options.PlaceHolder.replace(replacePattern, "portals.common.controls.UISettings");
		controlConfig.SubControls.Controls.forEach(ctrl => {
			ctrl.Options.Label = ctrl.Options.Label === undefined ? undefined : ctrl.Options.Label.replace(replacePattern, "portals.common.controls.UISettings");
			ctrl.Options.Description = ctrl.Options.Description === undefined ? undefined : ctrl.Options.Description.replace(replacePattern, "portals.common.controls.UISettings");
			ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder === undefined ? undefined : ctrl.Options.PlaceHolder.replace(replacePattern, "portals.common.controls.UISettings");
		});
		controlConfig.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "BackgroundImageURI")).Options.LookupOptions = {
			AsModal: true,
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: FilesProcessorModalPage,
				ComponentProps: {
					mode: "select",
					fileOptions: fileOptions,
					allowSelect: true,
					multiple: false,
					handlers: { predicate: (attachment: AttachmentInfo) => attachment.isImage, onSelect: () => {} }
				},
				OnDismiss: (attachments: AttachmentInfo[], formControl: AppFormsControlComponent) => {
					const uri = attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined;
					if (uri !== undefined) {
						formControl.setValue(uri);
						formControl.lookupDisplayValues = [{ Value: uri, Label: uri }];
					}
					else {
						formControl.setValue(undefined);
						formControl.lookupDisplayValues = undefined;
					}
				}
			}
		};
	}

	public setTemplateControlOptions(control: AppFormsControlConfig | AppFormsControl, name: string, mainDirectory?: string, subDirectory?: string) {
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => formControl.setValue(await this.getTemplateAsync(name, mainDirectory, subDirectory))
		};
	}

	public async getTemplateAsync(name: string, mainDirectory?: string, subDirectory?: string) {
		let template: string;
		await super.fetchAsync(super.getURI("definitions", "template", "x-request=" + AppUtility.toBase64Url({ Name: name, MainDirectory: mainDirectory, SubDirectory: subDirectory })), data => template = data.Template);
		return template || "";
	}

	public async getTemplateZonesAsync(dekstopID: string) {
		let zones: Array<string>;
		await super.fetchAsync(super.getURI("definitions", "template", "x-request=" + AppUtility.toBase64Url({ Mode: "Zones", DesktopID: dekstopID })), data => zones = data);
		return zones || [];
	}

	public getAppUrl(contentType: ContentType, action?: string, title?: string, params?: { [key: string]: any }, objectName?: string, path?: string) {
		objectName = objectName || (contentType !== undefined ? contentType.getObjectName() : "unknown");
		return `/portals/${path || "cms"}/`
			+ (AppUtility.isEquals(objectName, "Category") ? "categories" : `${objectName}s`).toLowerCase() + "/"
			+ (action || "list").toLowerCase() + "/"
			+ AppUtility.toANSI(title || (contentType !== undefined ? contentType.ansiTitle : "untitled"), true)
			+ `?x-request=${AppUtility.toBase64Url(params || { RepositoryEntityID: contentType !== undefined ? contentType.ID : undefined })}`;
	}

	public getPortalUrl(object: CmsBaseModel, parent?: CmsBaseModel): string {
		let uri = parent !== undefined ? this.getPortalUrl(parent) : undefined;
		if (uri === undefined) {
			const organization = Organization.get(object.SystemID);
			const module = Module.get(object.RepositoryID);
			const contentType = ContentType.get(object.RepositoryEntityID);
			const desktop = Desktop.get(object["DesktopID"]) || Desktop.get(contentType === undefined ? undefined : contentType.DesktopID) || Desktop.get(module === undefined ? undefined : module.DesktopID) || Desktop.get(organization === undefined ? undefined : organization.HomeDesktopID);
			uri = `${this.configSvc.appConfig.URIs.portals}~${(organization !== undefined ? organization.Alias : "")}/${(desktop !== undefined ? desktop.Alias : "-default")}`;
		}
		return uri + `/${object["Alias"] || object.ID}`;
	}

	public getPaginationPrefix(objectName: string) {
		return `${objectName}@${this.name}`.toLowerCase();
	}

	public getEmailNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const placeholder = "{{portals.common.controls.notifications.emails.toAddresses.placeholder}}";
		const controlConfig: AppFormsControlConfig = {
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
				controlConfig.SubControls.Controls,
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

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public getWebHookNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
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
				controlConfig.SubControls.Controls,
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

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public getNotificationsFormControl(name: string, segment?: string, events?: Array<string>, methods?: Array<string>, allowInheritFromParent: boolean = true, inheritEventsAndMethodsFromParent: boolean = false, inheritEmailFromParent: boolean = false, inheritWebHookFromParent: boolean = false, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
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
				controlConfig.SubControls.Controls,
				{
					Name: "InheritFromParent",
					Type: "YesNo",
					Options: {
						Label: "{{portals.common.controls.notifications.inheritFromParent}}",
						Type: "toggle",
						OnChanged: (event, formControl) => formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name === "Events" || ctrl.Name === "Methods").forEach(ctrl => ctrl.Hidden = event.detail.checked)
					}
				},
				0
			);
		}

		if (methods === undefined || methods.indexOf("Email") > -1) {
			controlConfig.SubControls.Controls.push(this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmailFromParent));
		}

		if (methods === undefined || methods.indexOf("WebHook") > -1) {
			controlConfig.SubControls.Controls.push(this.getWebHookNotificationFormControl(allowInheritFromParent, inheritWebHookFromParent));
		}

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public getEmailSettingsFormControl(name: string, segment?: string, allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const buttonsConfig = this.appFormsSvc.getButtonControls(
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
		buttonsConfig.Hidden = inheritFromParent;
		const controlConfig: AppFormsControlConfig = {
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
					buttonsConfig
				]
			}
		};

		if (allowInheritFromParent) {
			AppUtility.insertAt(
				controlConfig.SubControls.Controls,
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

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public getUploadFormControl(fileOptions: FileOptions, segment?: string, label?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = this.appFormsSvc.getButtonControls(
			segment || "attachments",
			{
				Name: "Upload",
				Label: label || "{{files.attachments.upload}}",
				OnClick: async () => await this.appFormsSvc.showModalAsync(
					FilesProcessorModalPage,
					{
						mode: "upload",
						fileOptions: fileOptions
					}
				),
				Options: {
					Fill: "clear",
					Color: "primary",
					Css: "ion-float-end",
					Icon: {
						Name: "cloud-upload",
						Slot: "start"
					}
				}
			}
		);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public getAuditFormControl(ojbect: BaseModel, segment?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		return this.usersSvc.getAuditFormControl(ojbect.Created, ojbect.CreatedID, ojbect.LastModified, ojbect.LastModifiedID, segment, onCompleted);
	}

	public async getAuditInfoAsync(ojbect: BaseModel) {
		return this.usersSvc.getAuditInfoAsync(ojbect.Created, ojbect.CreatedID, ojbect.LastModified, ojbect.LastModifiedID);
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

	public lookup(objectName: string, request: any, onNext: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return super.search(super.getSearchURI(objectName, this.configSvc.relatedQuery), request, onNext, onError, true, headers);
	}

	public async lookupAsync(objectName: string, request: any, onNext: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await super.searchAsync(super.getSearchURI(objectName, this.configSvc.relatedQuery), request, onNext, onError, true, false, headers);
	}

	public async getAsync(objectName: string, id: string, onNext: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await super.readAsync(super.getURI(objectName, id), onNext, onError, headers, true);
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
		if (Organization.contains(id) && Organization.get(id).modules.length > 0) {
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
		if (organization !== undefined && organization.modules.length < 1) {
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
		if (desktop !== undefined && (desktop.childrenIDs === undefined || desktop.portlets === undefined)) {
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
			if (AppUtility.isArray(json.Portlets, true)) {
				desktop.portlets = (json.Portlets as Array<any>).map(p => Portlet.update(p));
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

	public get portletCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const portlet = data !== undefined
				? data instanceof Portlet
					? data as Portlet
					: Portlet.deserialize(data)
				: undefined;
			return portlet !== undefined
				? { title: portlet.Title, originalObject: portlet }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("portlet", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Portlet.contains(obj.ID) ? convertToCompleterItem(Portlet.get(obj.ID)) : convertToCompleterItem(Portlet.update(Portlet.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchPortlet(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("portlet", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Portlet.contains(obj.ID)) {
							Portlet.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching portlet(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchPortletAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination?: boolean, useXHR: boolean = false) {
		await super.searchAsync(
			super.getSearchURI("portlet", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!Portlet.contains(obj.ID)) {
							Portlet.update(obj);
						}
					});
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching portlet(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			dontProcessPagination,
			useXHR
		);
	}

	public async createPortletAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("portlet"),
			body,
			data => {
				Portlet.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new portlet", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getPortletAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Portlet.contains(id) && Portlet.get(id).otherDesktops !== undefined) {
			if (onNext) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("portlet", id),
				data => {
					Portlet.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a portlet", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updatePortletAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("portlet", body.ID),
			body,
			data => {
				Portlet.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a portlet", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deletePortletAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.deleteAsync(
			super.getURI("portlet", id),
			data => {
				Portlet.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a portlet", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private processPortletUpdateMessage(message: AppMessage) {
		let desktop: Desktop;
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				const portlet = Portlet.update(message.Data);
				desktop = Desktop.get(message.Data.DesktopID);
				if (desktop !== undefined && desktop.portlets !== undefined) {
					const index = desktop.portlets.findIndex(p => p.ID === message.Data.ID);
					if (index < 0) {
						desktop.portlets.push(portlet);
					}
					else {
						desktop.portlets[index] = portlet;
					}
				}
				console.log("Update portlet into desktop", message.Data.ID, portlet, desktop);
				break;

			case "Delete":
				Portlet.instances.remove(message.Data.ID);
				desktop = Desktop.get(message.Data.DesktopID);
				if (desktop !== undefined && desktop.portlets !== undefined) {
					AppUtility.removeAt(desktop.portlets, desktop.portlets.findIndex(p => p.ID === message.Data.ID));
				}
				console.log("Remove portlet from desktop", message.Data.ID, desktop);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a portlet"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Portlet", Type: `${message.Type.Event}d`, ID: message.Data.ID, DesktopID: message.Data.DesktopID });
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
				console.warn(super.getLogMessage("Got an update message of a module"), message);
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
				console.error(super.getErrorMessage("Error occurred while searching content type(s)", error));
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
				console.error(super.getErrorMessage("Error occurred while searching content type(s)", error));
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
				console.error(super.getErrorMessage("Error occurred while creating new content type", error));
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
					console.error(super.getErrorMessage("Error occurred while getting a content type", error));
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
				console.error(super.getErrorMessage("Error occurred while updating a content type", error));
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
				console.error(super.getErrorMessage("Error occurred while deleting a content type", error));
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
				console.warn(super.getLogMessage("Got an update message of a content type"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Content.Type", Type: `${message.Type.Event}d`, ID: message.Data.ID });
	}

	public get expressionCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const expression = data !== undefined
				? data instanceof Expression
					? data as Expression
					: Expression.deserialize(data)
				: undefined;
			return expression !== undefined
				? { title: expression.Title, description: expression.Description, originalObject: expression }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(super.getSearchURI("expression", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Expression.contains(obj.ID) ? convertToCompleterItem(Expression.get(obj.ID)) : convertToCompleterItem(Expression.update(Expression.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchExpression(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("expression", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Expression.update(obj));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching expression(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchExpressionAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("expression", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Expression.update(obj));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching expression(s)", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createExpressionAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("expression"),
			body,
			data => {
				Expression.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new expression", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getExpressionAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Expression.contains(id)) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("expression", id),
				data => {
					Expression.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting an expression", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateExpressionAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("expression", body.ID),
			body,
			data => {
				Expression.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating an expression", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteExpressionAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.deleteAsync(
			super.getURI("expression", id),
			data => {
				Expression.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting an expression", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	private processExpressionUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Expression.update(message.Data);
				break;

			case "Delete":
				if (Expression.contains(message.Data.ID)) {
					Expression.instances.remove(message.Data.ID);
				}
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of an expression"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "Content.Type", Type: `${message.Type.Event}d`, ID: message.Data.ID });
	}

}
