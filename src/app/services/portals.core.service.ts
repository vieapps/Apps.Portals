import { Injectable } from "@angular/core";
import { AppRTU, AppMessage } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsControlConfig, AppFormsControlLookupOptionsConfig, AppFormsLookupValue, AppFormsControl, AppFormsService } from "@app/components/forms.service";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { FileOptions } from "@app/services/files.service";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { AttachmentInfo } from "@app/models/base";
import { Account } from "@app/models/account";
import { PortalBase as BaseModel, NotificationSettings, EmailNotificationSettings, WebHookNotificationSettings, EmailSettings } from "@app/models/portals.base";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";
import { Organization } from "@app/models/portals.core.organization";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";
import { Expression } from "@app/models/portals.core.expression";
import { Role } from "@app/models/portals.core.role";
import { Site } from "@app/models/portals.core.site";
import { Desktop } from "@app/models/portals.core.desktop";
import { Portlet } from "@app/models/portals.core.portlet";

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
			Organization.active = Organization.instances.first();
			if (Organization.active !== undefined && Organization.active.modules.length < 1) {
				this.getOrganizationAsync(Organization.active.ID);
			}
		}
		return Organization.active;
	}

	public get activeModules() {
		let modules: { [key: string]: string } = this.configSvc.appConfig.options.extras["modules"];
		if (modules === undefined) {
			modules = {};
			this.configSvc.appConfig.options.extras["modules"] = modules;
			this.configSvc.saveOptionsAsync();
		}
		return modules;
	}

	public get activeModule() {
		if (Module.active === undefined) {
			const systemID = this.activeOrganization !== undefined
				? this.activeOrganization.ID
				: undefined;
			const moduleID = systemID !== undefined
				? this.activeModules[systemID]
				: undefined;
			if (Module.contains(moduleID)) {
				Module.active = Module.get(moduleID);
			}
			else if (moduleID !== undefined) {
				this.getModuleAsync(moduleID, async _ => await this.setActiveModuleAsync(Module.get(moduleID)));
			}
		}
		return Module.active;
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
		AppRTU.registerAsObjectScopeProcessor(this.name, "Content.Type", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.ContentType", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Content.Type", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Expression", message => this.processExpressionUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Expression", message => this.processExpressionUpdateMessage(message));
		AppEvents.on(this.name, async info => {
			if (info.args.Type === "RequestInfo" && AppUtility.isNotEmpty(info.args.ID)) {
				if (info.args.Object === "Organization") {
					await this.getOrganizationAsync(info.args.ID);
				}
				else if (info.args.Object === "Module") {
					await this.getModuleAsync(info.args.ID);
				}
				else if (info.args.Object === "ContentType") {
					await this.getContentTypeAsync(info.args.ID);
				}
			}
		});
		AppEvents.on("Account", info => {
			if (AppUtility.isEquals(info.args.Type, "Updated")) {
				this.prepareSidebar();
			}
		});
	}

	public async initializeAysnc(onNext?: () => void) {
		await this.getDefinitionsAsync(async () => {
			if (this.configSvc.isDebug) {
				console.log("[Portals]: The definitions were fetched", BaseModel.moduleDefinitions);
			}
		});
		if (Organization.active === undefined) {
			await this.getActiveOrganizationAsync(undefined, true, () => {
				if (this.configSvc.isDebug) {
					console.log("[Portals]: The active organization was fetched", Organization.active);
				}
			});
		}
		if (Organization.active !== undefined && Organization.active.modules.length < 1) {
			await this.getActiveOrganizationAsync(undefined, true, () => {
				if (this.configSvc.isDebug) {
					console.log("[Portals]: The active organization and modules were fetched", Organization.active, Organization.active.modules);
				}
			});
		}
		this.prepareSidebar(onNext);
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
		}
		if (onNext !== undefined) {
			onNext();
		}
		return BaseModel.moduleDefinitions;
	}

	public async getThemesAsync(onNext?: () => void) {
		if (this._themes === undefined) {
			const path = this.configSvc.getDefinitionPath(this.name, "themes");
			this._themes = this.configSvc.getDefinition(path) || await this.configSvc.fetchDefinitionAsync(path, false);
		}
		if (onNext !== undefined) {
			onNext();
		}
		return this._themes;
	}

	public async getActiveOrganizationAsync(preferID?: string, useXHR: boolean = true, onNext?: () => void) {
		preferID = AppUtility.isNotEmpty(preferID) ? preferID : this.configSvc.appConfig.options.extras["organization"];
		if (AppUtility.isNotEmpty(preferID)) {
			if (Organization.active !== undefined && AppUtility.isEquals(Organization.active.ID, preferID)) {
				this.configSvc.appConfig.services.activeID = Organization.active.ID;
			}
			else {
				await this.getOrganizationAsync(preferID, async _ => await this.setActiveOrganizationAsync(Organization.get(preferID) || Organization.instances.first()), undefined, useXHR);
			}
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Organization.active;
	}

	public async getAvailableOrganizationsAsync() {
		const organizations = new Array<Organization>();
		const organizationIDs = this.configSvc.appConfig.options.extras["organizations"] as Array<string>;
		await Promise.all((organizationIDs || []).filter(id => AppUtility.isNotEmpty(id)).map(async id => {
			let organization = Organization.get(id);
			if (organization === undefined) {
				await this.getOrganizationAsync(id, _ => {
					organization = Organization.get(id);
				}, undefined, true);
			}
			if (organization !== undefined) {
				organizations.push(organization);
			}
		}));
		return organizations.sortBy("Title");
	}

	public async setActiveOrganizationAsync(organization: Organization, onNext?: () => void) {
		if (organization !== undefined) {
			if (this.configSvc.isDebug) {
				console.log("[Portals]: Active organization", organization);
			}
			this.configSvc.appConfig.services.activeID = organization.ID;
			this.configSvc.appConfig.options.extras["organization"] = organization.ID;
			let organizations = this.configSvc.appConfig.options.extras["organizations"] as Array<string>;
			if (organizations === undefined) {
				organizations = new Array<string>();
				this.configSvc.appConfig.options.extras["organizations"] = organizations;
			}
			if (organizations.indexOf(organization.ID) < 0) {
				organizations.push(organization.ID);
			}
			if (Organization.active === undefined || Organization.active.ID !== organization.ID) {
				Organization.active = organization;
				await this.getActiveModuleAsync();
				AppEvents.broadcast(this.name, { Object: "Organization", Type: "Changed", ID: Organization.active.ID });
				await this.configSvc.storeOptionsAsync();
			}
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Organization.active;
	}

	public async getActiveModuleAsync(preferID?: string, useXHR: boolean = true, onNext?: () => void) {
		const activeOrganization = this.activeOrganization;
		const systemID = activeOrganization !== undefined
			? activeOrganization.ID
			: undefined;

		Module.active = Module.active !== undefined && Module.active.SystemID === systemID
			? Module.active
			: undefined;

		if (Module.active === undefined) {
			preferID = AppUtility.isNotEmpty(preferID)
				? preferID
				: AppUtility.isNotEmpty(systemID) ? this.activeModules[systemID] : undefined;
			if (AppUtility.isNotEmpty(preferID)) {
				if (Module.contains(preferID)) {
					Module.active = Module.get(preferID);
				}
				else {
					await this.getModuleAsync(preferID, async _ => await this.setActiveModuleAsync(Module.get(preferID) || (activeOrganization !== undefined ? activeOrganization.defaultModule : undefined)), undefined, useXHR);
				}
			}
		}

		if (onNext !== undefined) {
			onNext();
		}
		return Module.active;
	}

	public async setActiveModuleAsync(module: Module, onNext?: () => void) {
		const store = this.activeModules[module.SystemID] === undefined;
		this.activeModules[module.SystemID] = module.ID;
		await (store ? this.configSvc.storeOptionsAsync() : this.configSvc.saveOptionsAsync());

		if (Module.active === undefined || Module.active.ID !== module.ID) {
			Module.active = module;
			AppEvents.broadcast(this.name, { Object: "Module", Type: "Changed", ID: Module.active.ID });
		}

		if (this.configSvc.isDebug) {
			console.log("[Portals]: Active module", Module.active);
		}
		if (onNext !== undefined) {
			onNext();
		}

		return Module.active;
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

	public setTemplateControlOptions(control: AppFormsControlConfig | AppFormsControl, name: string, theme?: string, mainDirectory?: string, subDirectory?: string) {
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => (formControl as AppFormsControlComponent).setValue(await this.getTemplateAsync(name, theme, mainDirectory, subDirectory))
		};
	}

	public async getTemplateAsync(name: string, theme?: string, mainDirectory?: string, subDirectory?: string) {
		let template: string;
		await super.fetchAsync(super.getURI("definitions", "template", "x-request=" + AppUtility.toBase64Url({ Name: name, Theme: theme, MainDirectory: mainDirectory, SubDirectory: subDirectory })), data => template = data.Template);
		return template || "";
	}

	public async getTemplateZonesAsync(dekstopID: string) {
		let zones: Array<string>;
		await super.fetchAsync(super.getURI("definitions", "template", "x-request=" + AppUtility.toBase64Url({ Mode: "Zones", DesktopID: dekstopID })), data => zones = data);
		return zones || [];
	}

	public getTheme(object: BaseModel) {
		let organization: Organization;
		let site: Site;
		let desktop: Desktop;
		let theme: string;
		if (object instanceof Portlet) {
			organization = Organization.get(object.SystemID);
			site = Site.instances.first(s => s.SystemID === organization.ID);
			desktop = (object as Portlet).originalDesktop;
		}
		else if (object instanceof Desktop) {
			organization = Organization.get(object.SystemID);
			site = Site.instances.first(s => s.SystemID === organization.ID);
			desktop = object as Desktop;
			theme  = desktop.Theme;
		}
		else if (object instanceof Site) {
			organization = Organization.get(object.SystemID);
			site = object as Site;
			theme = site.Theme;
		}
		else if (object instanceof Organization) {
			organization = object as Organization;
			theme = organization.Theme;
		}
		if (theme === undefined && desktop !== undefined) {
			theme = desktop.Theme;
		}
		if (theme === undefined && site !== undefined) {
			theme = site.Theme;
		}
		if (theme === undefined && organization !== undefined) {
			theme = organization.Theme;
		}
		return theme;
	}

	public getRouterLink(contentType: ContentType, action?: string, title?: string, objectName?: string, path?: string) {
		objectName = objectName || (contentType !== undefined ? contentType.getObjectName() : "unknown");
		return `/portals/${path || "cms"}/`
			+ (AppUtility.isEquals(objectName, "Category") ? "categories" : `${objectName}s`).toLowerCase() + "/"
			+ (action || "list").toLowerCase() + "/"
			+ AppUtility.toANSI(title || (contentType !== undefined ? contentType.ansiTitle : "untitled"), true);
	}

	public getRouterQueryParams(contentType: ContentType, params?: { [key: string]: any }) {
		return { "x-request": AppUtility.toBase64Url(params || { RepositoryEntityID: contentType !== undefined ? contentType.ID : undefined }) };
	}

	public getAppURL(contentType: ContentType, action?: string, title?: string, params?: { [key: string]: any }, objectName?: string, path?: string) {
		return this.getRouterLink(contentType, action, title, objectName, path) + "?x-request=" + this.getRouterQueryParams(contentType, params)["x-request"];
	}

	public getPortalURL(object: CmsBaseModel, parent?: CmsBaseModel) {
		let uri: string = parent !== undefined ? this.getPortalURL(parent) : undefined;
		if (uri === undefined) {
			const organization = Organization.get(object.SystemID);
			const module = Module.get(object.RepositoryID);
			const contentType = ContentType.get(object.RepositoryEntityID);
			const desktop = Desktop.get(object["DesktopID"]) || Desktop.get(contentType === undefined ? undefined : contentType.DesktopID) || Desktop.get(module === undefined ? undefined : module.DesktopID) || Desktop.get(organization === undefined ? undefined : organization.HomeDesktopID);
			uri = `${this.configSvc.appConfig.URIs.portals}` + (organization !== undefined && desktop !== undefined ? `~${organization.Alias}/${desktop.Alias}` : "_permanentlink");
		}
		return uri.indexOf("_permanent") > 0
			? this.getPermanentURL(object)
			: uri + "/" + (object["Alias"] || object.ID);
	}

	public getPermanentURL(object: CmsBaseModel) {
		return `${this.configSvc.appConfig.URIs.portals}_permanentlink/${object.RepositoryEntityID}/${object.ID}`;
	}

	public getPaginationPrefix(objectName: string) {
		return `${objectName}@${this.name}`.toLowerCase();
	}

	public getEmailNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, name?: string, replacement?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const placeholder = "{{portals.common.controls.notifications.emails.toAddresses.placeholder}}";
		const controlConfig: AppFormsControlConfig = {
			Name: name || "Emails",
			Options: {
				Label: AppUtility.isNotEmpty(replacement) ? "{{portals.common.controls.notifications.emails.label}}".replace(".emails.", `.${replacement}.`) : "{{portals.common.controls.notifications.emails.label}}",
				Description: AppUtility.isNotEmpty(replacement) ? "{{portals.common.controls.notifications.emails.description}}".replace(".emails.", `.${replacement}.`) : "{{portals.common.controls.notifications.emails.description}}"
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
							Rows: 10,
							Icon: {
								Name: "color-wand",
								OnClick: async (_, formControl) => await this.configSvc.getInstructionsAsync("portals", this.configSvc.appConfig.language, data => {
									const controls = (formControl as AppFormsControlComponent).formGroup.controls;
									let subject = controls.Status !== undefined
										? data.notifications.emailByApprovalStatus[controls.Status.value].subject
										: data.notifications.email.subject;
									if (!AppUtility.isNotEmpty(subject)) {
										subject = data.notifications.email.subject;
									}
									let body = controls.Status !== undefined
										? data.notifications.emailByApprovalStatus[controls.Status.value].body
										: data.notifications.email.body;
									if (!AppUtility.isNotEmpty(body)) {
										body = data.notifications.email.body;
									}
									controls.Subject.setValue(subject);
									controls.Body.setValue(body);
								})
							}
						}
					}
				]
			}
		};

		if (allowInheritFromParent) {
			controlConfig.SubControls.Controls.insert({
				Name: "InheritFromParent",
				Type: "YesNo",
				Options: {
					Label: "{{portals.common.controls.notifications.emails.inheritFromParent}}",
					Type: "toggle",
					OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
				}
			}, 0);
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
						Name: "GenerateIdentity",
						Type: "YesNo",
						Hidden: inheritFromParent,
						Options: {
							Label: "{{portals.common.controls.notifications.webhooks.generateIdentity.label}}",
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
			controlConfig.SubControls.Controls.insert({
				Name: "InheritFromParent",
				Type: "YesNo",
				Options: {
					Label: "{{portals.common.controls.notifications.webhooks.inheritFromParent}}",
					Type: "toggle",
					OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
				}
			}, 0);
		}

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public get defaultEmailNotificationSettings() {
		return {
			ToAddresses: undefined as string,
			CcAddresses: undefined as string,
			BccAddresses: undefined as string,
			Subject: undefined as string,
			Body: undefined as string
		} as EmailNotificationSettings;
	}

	public get defaultWebHookNotificationSettings() {
		return {
			EndpointURLs: [],
			SignAlgorithm: "SHA256",
			SignatureAsHex: true,
			SignatureInQuery: false,
			GenerateIdentity: false
		} as WebHookNotificationSettings;
	}

	public getNotificationsFormControl(name: string, segment?: string, events?: Array<string>, methods?: Array<string>, allowInheritFromParent: boolean = true, inheritStates?: { inheritEventsAndMethods: boolean, inheritEmails: boolean, inheritEmailsByApprovalStatus: boolean, inheritEmailsWhenPublish: boolean, inheritWebHooks: boolean }, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const inheritEventsAndMethods = AppUtility.isNotNull(inheritStates) && AppUtility.isTrue(inheritStates.inheritEventsAndMethods);
		const inheritEmails = AppUtility.isNotNull(inheritStates) && AppUtility.isTrue(inheritStates.inheritEmails);
		const inheritEmailsByApprovalStatus = AppUtility.isNotNull(inheritStates) && AppUtility.isTrue(inheritStates.inheritEmailsByApprovalStatus);
		const inheritEmailsWhenPublish = AppUtility.isNotNull(inheritStates) && AppUtility.isTrue(inheritStates.inheritEmailsWhenPublish);
		const inheritWebHooks = AppUtility.isNotNull(inheritStates) && AppUtility.isTrue(inheritStates.inheritWebHooks);
		const controlConfig: AppFormsControlConfig = {
			Name: name,
			Segment: segment,
			SubControls: {
				Controls: [
					{
						Name: "Events",
						Type: "Select",
						Hidden: inheritEventsAndMethods,
						Options: {
							Label: "{{portals.common.controls.notifications.events}}",
							SelectOptions: {
								Multiple: true,
								AsBoxes: true,
								Values: (events || ["Create", "Update", "Delete"]).map(value => {
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
						Hidden: inheritEventsAndMethods,
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
			controlConfig.SubControls.Controls.insert({
				Name: "InheritFromParent",
				Type: "YesNo",
				Options: {
					Label: "{{portals.common.controls.notifications.inheritFromParent}}",
					Type: "toggle",
					OnChanged: (event, formControl) => formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name === "Events" || ctrl.Name === "Methods").forEach(ctrl => ctrl.Hidden = event.detail.checked)
				}
			}, 0);
		}

		if (methods === undefined || methods.indexOf("Email") > -1) {
			controlConfig.SubControls.Controls.push(this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmails));
			const emailsByApprovalStatus = this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmailsByApprovalStatus, "EmailsByApprovalStatus", "emailsByApprovalStatus");
			emailsByApprovalStatus.SubControls.Controls.insert({
				Name: "Status",
				Type: "Select",
				Hidden: inheritEmailsByApprovalStatus,
				Options: {
					Label: "{{status.approval.label}}",
					SelectOptions: {
						Interface: "popover",
						Values: BaseModel.approvalStatus.map(value => {
							return { Value: value, Label: `{{status.approval.${value}}}` };
						})
					}
				}
			}, allowInheritFromParent ? 1 : 0);
			controlConfig.SubControls.Controls.push(emailsByApprovalStatus);
			controlConfig.SubControls.Controls.push(this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmailsWhenPublish, "EmailsWhenPublish", "emailsWhenPublish"));
		}

		if (methods === undefined || methods.indexOf("WebHook") > -1) {
			controlConfig.SubControls.Controls.push(this.getWebHookNotificationFormControl(allowInheritFromParent, inheritWebHooks));
		}

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public prepareNotificationsFormControl(notificationsControl: AppFormsControlConfig, emailsByApprovalStatus: EmailNotificationSettings, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const emailsByApprovalStatusControls = notificationsControl.SubControls.Controls.find(ctrl => ctrl.Name === "EmailsByApprovalStatus").SubControls.Controls;
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "Status").Options.OnChanged = (event, formControl) => {
			const approvalStatusEmail = emailsByApprovalStatus[event.detail.value] || {};
			formControl.formGroup.controls.ToAddresses.setValue(approvalStatusEmail.ToAddresses, { onlySelf: true });
			formControl.formGroup.controls.CcAddresses.setValue(approvalStatusEmail.CcAddresses, { onlySelf: true });
			formControl.formGroup.controls.BccAddresses.setValue(approvalStatusEmail.BccAddresses, { onlySelf: true });
			formControl.formGroup.controls.Subject.setValue(approvalStatusEmail.Subject, { onlySelf: true });
			formControl.formGroup.controls.Body.setValue(approvalStatusEmail.Body, { onlySelf: true });
			formControl.parentControl.SubControls.Controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ToAddresses")).focus();
		};
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "ToAddresses").Options.OnBlur = (_, formControl) => emailsByApprovalStatus[formControl.formGroup.controls.Status.value] = { ToAddresses: formControl.formGroup.controls.ToAddresses.value, CcAddresses: formControl.formGroup.controls.CcAddresses.value, BccAddresses: formControl.formGroup.controls.BccAddresses.value, Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "CcAddresses").Options.OnBlur = (_, formControl) => emailsByApprovalStatus[formControl.formGroup.controls.Status.value] = { ToAddresses: formControl.formGroup.controls.ToAddresses.value, CcAddresses: formControl.formGroup.controls.CcAddresses.value, BccAddresses: formControl.formGroup.controls.BccAddresses.value, Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "BccAddresses").Options.OnBlur = (_, formControl) => emailsByApprovalStatus[formControl.formGroup.controls.Status.value] = { ToAddresses: formControl.formGroup.controls.ToAddresses.value, CcAddresses: formControl.formGroup.controls.CcAddresses.value, BccAddresses: formControl.formGroup.controls.BccAddresses.value, Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "Subject").Options.OnBlur = (_, formControl) => emailsByApprovalStatus[formControl.formGroup.controls.Status.value] = { ToAddresses: formControl.formGroup.controls.ToAddresses.value, CcAddresses: formControl.formGroup.controls.CcAddresses.value, BccAddresses: formControl.formGroup.controls.BccAddresses.value, Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "Body").Options.OnBlur = (_, formControl) => emailsByApprovalStatus[formControl.formGroup.controls.Status.value] = { ToAddresses: formControl.formGroup.controls.ToAddresses.value, CcAddresses: formControl.formGroup.controls.CcAddresses.value, BccAddresses: formControl.formGroup.controls.BccAddresses.value, Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		if (onCompleted !== undefined) {
			onCompleted(notificationsControl);
		}
		return notificationsControl;
	}

	public getNotificationInheritStates(notificationSettings: NotificationSettings) {
		return {
			inheritEventsAndMethods: AppUtility.isNull(notificationSettings) || (AppUtility.isNull(notificationSettings.Events) && AppUtility.isNull(notificationSettings.Methods)),
			inheritEmails: AppUtility.isNull(notificationSettings) || AppUtility.isNull(notificationSettings.Emails),
			inheritEmailsByApprovalStatus: AppUtility.isNull(notificationSettings) || AppUtility.isNull(notificationSettings.EmailsByApprovalStatus),
			inheritEmailsWhenPublish: AppUtility.isNull(notificationSettings) || AppUtility.isNull(notificationSettings.EmailsWhenPublish),
			inheritWebHooks: AppUtility.isNull(notificationSettings) || AppUtility.isNull(notificationSettings.WebHooks)
		};
	}

	public getNotificationSettings(notificationSettings: NotificationSettings, emailsByApprovalStatus?: EmailNotificationSettings, allowInheritFromParent: boolean = true, onCompleted?: (notifications: any) => void) {
		const notifications = AppUtility.clone(notificationSettings || {});
		notifications.Events = notifications.Events || [];
		notifications.Methods = notifications.Methods || [];
		notifications.Emails = notifications.Emails || {};
		notifications.EmailsByApprovalStatus = notifications.EmailsByApprovalStatus || {};
		notifications.EmailsWhenPublish = notifications.EmailsWhenPublish || {};
		notifications.WebHooks = notifications.WebHooks || this.defaultWebHookNotificationSettings;
		notifications.WebHooks.EndpointURLs = AppUtility.toStr(notifications.WebHooks.EndpointURLs, "\n");
		if (!AppUtility.isNull(emailsByApprovalStatus)) {
			Object.keys(notifications.EmailsByApprovalStatus).forEach(s => emailsByApprovalStatus[s] = notifications.EmailsByApprovalStatus[s]);
			let status  = "Published";
			let emailNotificationSettings = emailsByApprovalStatus[status];
			if (emailNotificationSettings === undefined) {
				const statuses = Object.keys(emailsByApprovalStatus);
				for (let index = 0; index < statuses.length; index++) {
					status = statuses[index];
					emailNotificationSettings = emailsByApprovalStatus[status];
					emailNotificationSettings = emailNotificationSettings !== undefined && AppUtility.isNotEmpty(emailNotificationSettings.Subject) && AppUtility.isNotEmpty(emailNotificationSettings.Body)
						? emailNotificationSettings
						: undefined;
					if (emailNotificationSettings !== undefined) {
						break;
					}
				}
				if (emailNotificationSettings === undefined) {
					status = "Published";
					emailNotificationSettings = this.defaultEmailNotificationSettings;
				}
			}
			notifications.EmailsByApprovalStatus.Status = status;
			notifications.EmailsByApprovalStatus.ToAddresses = emailNotificationSettings.ToAddresses;
			notifications.EmailsByApprovalStatus.CcAddresses = emailNotificationSettings.CcAddresses;
			notifications.EmailsByApprovalStatus.BccAddresses = emailNotificationSettings.BccAddresses;
			notifications.EmailsByApprovalStatus.Subject = emailNotificationSettings.Subject;
			notifications.EmailsByApprovalStatus.Body = emailNotificationSettings.Body;
			BaseModel.approvalStatus.forEach(s => emailsByApprovalStatus[s] = notifications.EmailsByApprovalStatus[s] || this.defaultEmailNotificationSettings);
		}
		if (AppUtility.isTrue(allowInheritFromParent)) {
			const inheritFromParent = AppUtility.isNull(notificationSettings);
			notifications.InheritFromParent = inheritFromParent || (AppUtility.isNull(notificationSettings.Events) && AppUtility.isNull(notificationSettings.Methods));
			notifications.Emails.InheritFromParent = inheritFromParent || AppUtility.isNull(notificationSettings.Emails);
			notifications.EmailsByApprovalStatus.InheritFromParent = inheritFromParent || AppUtility.isNull(notificationSettings.EmailsByApprovalStatus);
			notifications.EmailsWhenPublish.InheritFromParent = inheritFromParent || AppUtility.isNull(notificationSettings.EmailsWhenPublish);
			notifications.WebHooks.InheritFromParent = inheritFromParent || AppUtility.isNull(notificationSettings.WebHooks);
		}
		if (onCompleted !== undefined) {
			onCompleted(notifications);
		}
		return notifications;
	}

	public normalizeNotificationSettings(notifications: any, emailsByApprovalStatus: EmailNotificationSettings, onCompleted?: (notifications: any) => void) {
		if (AppUtility.isNotNull(notifications)) {
			if (notifications.InheritFromParent) {
				notifications.Events = undefined;
				notifications.Methods = undefined;
			}
			delete notifications["InheritFromParent"];
			if (notifications.Emails) {
				if (notifications.Emails.InheritFromParent) {
					notifications.Emails = undefined;
				}
				else {
					delete notifications.Emails["InheritFromParent"];
				}
			}
			if (notifications.EmailsByApprovalStatus) {
				if (notifications.EmailsByApprovalStatus.InheritFromParent) {
					notifications.EmailsByApprovalStatus = undefined;
				}
				else {
					notifications.EmailsByApprovalStatus = AppUtility.clone(emailsByApprovalStatus || {});
					delete notifications.EmailsByApprovalStatus["InheritFromParent"];
				}
			}
			if (notifications.EmailsWhenPublish) {
				if (notifications.EmailsWhenPublish.InheritFromParent) {
					notifications.EmailsWhenPublish = undefined;
				}
				else {
					delete notifications.EmailsWhenPublish["InheritFromParent"];
				}
			}
			if (notifications.WebHooks) {
				if (notifications.WebHooks.InheritFromParent) {
					notifications.WebHooks = undefined;
				}
				else {
					notifications.WebHooks.EndpointURLs = AppUtility.toArray(notifications.WebHooks.EndpointURLs, "\n").filter(value => AppUtility.isNotEmpty(value));
					delete notifications.WebHooks["InheritFromParent"];
				}
			}
		}
		if (onCompleted !== undefined) {
			onCompleted(notifications);
		}
		return notifications;
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
			controlConfig.SubControls.Controls.insert({
				Name: "InheritFromParent",
				Type: "YesNo",
				Options: {
					Label: "{{portals.common.controls.emails.inheritFromParent}}",
					Type: "toggle",
					OnChanged: (event, formControl) =>  formControl.parentControl.SubControls.Controls.filter(ctrl => ctrl.Name !== "InheritFromParent").forEach(ctrl => ctrl.Hidden = event.detail.checked)
				}
			}, 0);
		}

		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public getEmailSettings(emailSettings: EmailSettings, allowInheritFromParent: boolean = true, onCompleted?: (settings: any) => void) {
		const settings = AppUtility.clone(emailSettings || {});
		settings.Smtp = settings.Smtp || { Smtp: { Port: 25, EnableSsl: false } };
		if (AppUtility.isTrue(allowInheritFromParent)) {
			settings.InheritFromParent = AppUtility.isNull(emailSettings);
		}
		if (onCompleted !== undefined) {
			onCompleted(settings);
		}
		return settings;
	}

	public normalizeEmailSettings(settings: any, onCompleted?: (settings: any) => void) {
		if (settings && settings.InheritFromParent) {
			settings = undefined;
		}
		if (onCompleted !== undefined) {
			onCompleted(settings);
		}
		return settings;
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

	public async refreshAsync(objectName: string, id: string, onNext?: (data: any) => void, onError?: (error?: any) => void, useXHR: boolean = false, headers?: { [header: string]: string }) {
		await super.readAsync(super.getURI(objectName, "refresh", `object-id=${id}`), onNext, onError, headers, useXHR);
	}

	public async getSidebarFooterButtonsAsync() {
		const buttons = [
			{
				name: "cms",
				icon: "library",
				title: await this.configSvc.getResourceAsync("portals.preferences.cms"),
				onClick: (name: string, sidebar: any) => this.openSidebar(name, sidebar)
			}
		];
		if (this.configSvc.isAuthenticated) {
			buttons.push(
				{
					name: "portals",
					icon: "cog",
					title: await this.configSvc.getResourceAsync("portals.preferences.portals"),
					onClick: (name, sidebar) => this.openSidebar(name, sidebar)
				// },
				// {
				// 	name: "notifications",
				// 	icon: "notifications",
				// 	title: await this.configSvc.getResourceAsync("portals.preferences.notifications"),
				// 	onClick: (name, sidebar) => this.openSidebar(name, sidebar, "Notifications")
				}
			);
		}
		return buttons;
	}

	private openSidebar(name: string, sidebar: any, event?: string) {
		if (sidebar.active !== name) {
			sidebar.active = name;
			AppEvents.broadcast(event || this.name, { mode: "OpenSidebar", name: name });
		}
	}

	private prepareSidebar(onNext?: () => void) {
		const items = new Array<{
			title: string,
			link: string,
			direction?: string,
			icon?: string,
			onClick?: (info: any, sidebar: any) => void
		}>();

		if (this.configSvc.isAuthenticated) {
			const account = this.configSvc.getAccount();
			const canManageOrganization = this.canManageOrganization(this.activeOrganization, account);

			if (canManageOrganization) {
				items.push
				(
					{
						title: "{{portals.sidebar.organizations}}",
						link: this.getRouterLink(undefined, "list", "all", "organization", "core"),
						direction: "root",
						icon: "business"
					},
					{
						title: "{{portals.sidebar.sites}}",
						link: this.getRouterLink(undefined, "list", "all", "site", "core"),
						direction: "root",
						icon: "globe"
					},
					{
						title: "{{portals.sidebar.roles}}",
						link: this.getRouterLink(undefined, "list", "all", "role", "core"),
						direction: "root",
						icon: "body"
					},
					{
						title: "{{portals.sidebar.desktops}}",
						link: this.getRouterLink(undefined, "list", "all", "desktop", "core"),
						direction: "root",
						icon: "desktop"
					},
					{
						title: "{{portals.sidebar.modules}}",
						link: this.getRouterLink(undefined, "list", "all", "module", "core"),
						direction: "root",
						icon: "albums"
					}
				);
			}

			items.push({
				title: "{{portals.sidebar.content-types}}",
				link: this.getRouterLink(undefined, "list", "all", "content.type", "core"),
				direction: "root",
				icon: "git-compare"
			});

			if (canManageOrganization) {
				items.push({
					title: "{{portals.sidebar.expressions}}",
					link: this.getRouterLink(undefined, "list", "all", "expression", "core"),
					direction: "root",
					icon: "construct"
				});
			}

			items.push({
				title: "{{portals.sidebar.cms-categories}}",
				link: this.getRouterLink(undefined, "list", "all", "category"),
				direction: "root",
				icon: "color-filter"
			});
		}

		AppEvents.broadcast("UpdateSidebar", {
			index: 1,
			name: "portals",
			reset: true,
			items: items
		});

		if (onNext !== undefined) {
			onNext();
		}
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
			data => this.processOrganizations(data, onNext),
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
			data => this.processOrganizations(data, onNext),
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

	private processOrganizations(data: any, onNext?: (data?: any) => void) {
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

	public async refreshRoleAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.refreshAsync(
			"role",
			id,
			data => {
				this.updateRole(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			onError,
			true,
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
				const obj = Role.get(role.ID);
				if (obj.childrenIDs !== undefined && obj.childrenIDs.length > 0) {
					obj.Children.forEach(c => this.fetchRole(c));
				}
			});
		}
		return role;
	}

	private updateRole(json: any, parentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const role = Role.set(Role.deserialize(json, Role.get(json.ID)));
			if (AppUtility.isArray(json.Children, true)) {
				role.childrenIDs = (json.Children as Array<any>).map(o => this.updateRole(o)).filter(o => o !== undefined).map(o => o.ID).distinct();
			}
			let parentRole = Role.get(parentID);
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined && parentRole.ID !== role.ParentID) {
				parentRole.childrenIDs.remove(role.ID);
			}
			parentRole = role.Parent;
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined && parentRole.childrenIDs.indexOf(role.ID) < 0) {
				parentRole.childrenIDs.push(role.ID);
				parentRole.childrenIDs = parentRole.childrenIDs.distinct();
			}
			return role;
		}
		return undefined;
	}

	private deleteRole(id: string, parentID?: string) {
		if (Role.contains(id)) {
			const parentRole = Role.get(parentID);
			if (parentRole !== undefined && parentRole.childrenIDs !== undefined) {
				parentRole.childrenIDs.remove(id);
			}
			Role.instances.toArray(role => role.ParentID === id).forEach(role => this.deleteRole(role.ID));
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
			data => this.processDesktops(data, onNext),
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
			data => this.processDesktops(data, onNext),
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

	public async updateDesktopAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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
			},
			headers
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

	public async refreshDesktopAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.refreshAsync(
			"desktop",
			id,
			data => {
				this.updateDesktop(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			onError,
			true,
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

	private processDesktops(data: any, onNext?: (data?: any) => void) {
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
	}

	private fetchDesktop(desktop: Desktop) {
		if (desktop !== undefined && (desktop.childrenIDs === undefined || desktop.portlets === undefined)) {
			this.getDesktopAsync(desktop.ID, _ => {
				const obj = Desktop.get(desktop.ID);
				if (obj.childrenIDs !== undefined && obj.childrenIDs.length > 0) {
					obj.Children.forEach(c => this.fetchDesktop(c));
				}
			});
		}
		return desktop;
	}

	private updateDesktop(json: any, oldParentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const desktop = Desktop.set(Desktop.deserialize(json, Desktop.get(json.ID)));
			if (AppUtility.isArray(json.Children, true)) {
				desktop.childrenIDs = (json.Children as Array<any>).map(o => this.updateDesktop(o)).filter(o => o !== undefined).map(o => o.ID).distinct();
			}
			if (AppUtility.isArray(json.Portlets, true)) {
				desktop.portlets = (json.Portlets as Array<any>).map(p => Portlet.update(p));
			}
			let parentDesktop = Desktop.get(oldParentID);
			if (parentDesktop !== undefined && parentDesktop.childrenIDs !== undefined && parentDesktop.ID !== desktop.ParentID) {
				parentDesktop.childrenIDs.remove(desktop.ID);
			}
			parentDesktop = desktop.Parent;
			if (parentDesktop !== undefined && parentDesktop.childrenIDs !== undefined && parentDesktop.childrenIDs.indexOf(desktop.ID) < 0) {
				parentDesktop.childrenIDs.push(desktop.ID);
				parentDesktop.childrenIDs = parentDesktop.childrenIDs.distinct();
			}
			return desktop;
		}
		return undefined;
	}

	private deleteDesktop(id: string, parentID?: string) {
		if (Desktop.contains(id)) {
			const parentDesktop = Desktop.get(parentID);
			if (parentDesktop !== undefined && parentDesktop.childrenIDs !== undefined) {
				parentDesktop.childrenIDs.remove(id);
			}
			Desktop.instances.toArray(desktop => desktop.ParentID === id).forEach(desktop => this.deleteDesktop(desktop.ID));
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
				if  (this.configSvc.appConfig.isDebug) {
					console.log(`Update a portlet into a desktop [Portlet: ${message.Data.ID} (${portlet.Title}) - Desktop: ${(desktop !== undefined ? desktop.FullTitle : "None")}]`, portlet, desktop);
				}
				break;

			case "Delete":
				Portlet.instances.remove(message.Data.ID);
				desktop = Desktop.get(message.Data.DesktopID);
				if (desktop !== undefined && desktop.portlets !== undefined) {
					desktop.portlets.removeAt(desktop.portlets.findIndex(p => p.ID === message.Data.ID));
				}
				if  (this.configSvc.appConfig.isDebug) {
					console.log(`Delete a portlet from a desktop [Portlet ID: ${message.Data.ID} - Desktop: ${(desktop !== undefined ? desktop.FullTitle : "None")}]`, desktop);
				}
				break;

			default:
				console.warn(super.getLogMessage(`Got an update message of a portlet - Portlet ID: ${message.Data.ID} - Desktop ID: ${message.Data.DesktopID}`), message);
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
