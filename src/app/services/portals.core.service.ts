import { Injectable } from "@angular/core";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppPagination } from "@app/components/app.pagination";
import { AppSidebar, AppSidebarMenuItem, AppMessage, AppDataRequest, AppDataPagination } from "@app/components/app.objects";
import { AppFormsControlConfig, AppFormsControlLookupOptionsConfig, AppFormsLookupValue, AppFormsControl } from "@app/components/forms.objects";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { AppFormsService } from "@app/components/forms.service";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { FilesService, FileOptions } from "@app/services/files.service";
import { AttachmentInfo } from "@app/models/base";
import { Account } from "@app/models/account";
import { PortalBase as BaseModel, NotificationSettings, EmailNotificationSettings, WebHookNotificationSettings, EmailSettings, WebHookSettings } from "@app/models/portals.base";
import { Organization, Role, Module, ContentType, Expression, Site, Desktop, Portlet, SchedulingTask } from "@app/models/portals.core.all";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.all";

@Injectable()
export class PortalsCoreService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService
	) {
		super("Portals");
	}

	private themes: Array<{ name: string, description: string; author: string; intro: string; screenshots: Array<string>; }>;
	private versions: Array<{ name: string, id: string; }> = [];
	private findVersionsAsync: () => Promise<void>;

	get moduleDefinitions() {
		return BaseModel.moduleDefinitions;
	}

	get contentTypeDefinitions() {
		return BaseModel.contentTypeDefinitions;
	}

	get activeOrganizations() {
		let organizations = this.configSvc.appConfig.options.extras["organizations"] as Array<string>;
		if (organizations === undefined) {
			organizations = new Array<string>();
			this.configSvc.appConfig.options.extras["organizations"] = organizations;
			this.configSvc.saveOptionsAsync();
		}
		return organizations;
	}

	get activeOrganization() {
		if (Organization.active === undefined) {
			const organizationID = this.configSvc.appConfig.services.active.system || this.configSvc.appConfig.options.extras["organization"] as string;
			Organization.active = Organization.instances.firstOrDefault(organization => organization.ID === organizationID);
			if (Organization.active !== undefined) {
				this.configSvc.appConfig.services.active.system = this.configSvc.appConfig.options.extras["organization"] = Organization.active.ID;
				if (Organization.active.modules.length < 1) {
					this.getOrganizationAsync(Organization.active.ID);
				}
			}
		}
		return Organization.active;
	}

	get activeModules() {
		let modules: { [key: string]: string } = this.configSvc.appConfig.options.extras["modules"];
		if (modules === undefined) {
			modules = {};
			this.configSvc.appConfig.options.extras["modules"] = modules;
			this.configSvc.saveOptionsAsync();
		}
		return modules;
	}

	get activeModule() {
		const systemID = this.activeOrganization !== undefined
			? this.activeOrganization.ID
			: undefined;
		if (Module.active === undefined || Module.active.SystemID !== systemID) {
			const moduleID = systemID !== undefined
				? this.activeModules[systemID]
				: undefined;
			if (Module.contains(moduleID)) {
				Module.active = Module.get(moduleID);
			}
			else if (moduleID !== undefined) {
				this.getModuleAsync(moduleID, () => this.setActiveModule(Module.get(moduleID)));
			}
		}
		return Module.active;
	}

	get menuIndex() {
		if (this.configSvc.appConfig.services.all.length > 1) {
			const menuIndex = this.configSvc.appConfig.services.all.find(svc => svc.name === this.name).menuIndex;
			return menuIndex !== undefined ? menuIndex : 0;
		}
		return 0;
	}

	get allowSelectActiveOrganization() {
		return false;
	}

	initialize() {
		AppAPIs.registerAsServiceScopeProcessor(this.name, message => {
			if (message.Data !== undefined) {
				if ((message.Type.Object === "Organization" || message.Type.Object === "Core.Organization") && this.activeOrganizations.find(id => id === message.Data.ID) !== undefined) {
					this.processOrganizationUpdateMessage(message);
				}
				else if (this.activeOrganizations.find(id => id === message.Data.SystemID) !== undefined) {
					switch (message.Type.Object) {
						case "Role":
						case "Core.Role":
							this.processRoleUpdateMessage(message);
							break;
						case "Site":
						case "Core.Site":
							this.processSiteUpdateMessage(message);
							break;
						case "Desktop":
						case "Core.Desktop":
							this.processDesktopUpdateMessage(message);
							break;
						case "Portlet":
						case "Core.Portlet":
							this.processPortletUpdateMessage(message);
							break;
						case "Module":
						case "Core.Module":
							this.processModuleUpdateMessage(message);
							break;
						case "ContentType":
						case "Content.Type":
						case "Core.ContentType":
						case "Core.Content.Type":
							this.processContentTypeUpdateMessage(message);
							break;
						case "Expression":
						case "Core.Expression":
							this.processExpressionUpdateMessage(message);
							break;
						case "Task":
						case "SchedulingTask":
						case "Core.Task":
						case "Core.SchedulingTask":
							this.processSchedulingTaskUpdateMessage(message);
							break;
					}
				}
			}
		});

		AppEvents.on(this.name, info => {
			if ("Info" === info.args.Type && "Request" === info.args.Mode && AppUtility.isNotEmpty(info.args.ID)) {
				if ("Organization" === info.args.Object) {
					this.getOrganizationAsync(info.args.ID);
				}
				else if ("Module" === info.args.Object) {
					this.getModuleAsync(info.args.ID);
				}
				else if ("ContentType" === info.args.Object) {
					this.getContentTypeAsync(info.args.ID);
				}
			}
			else if ("Organization" === info.args.Type && "Changed" === info.args.Mode) {
				this.updateSidebarHeader();
				this.prepareSidebar();
			}
		});

		AppEvents.on("Session", info => {
			if ("LogIn" === info.args.Type) {
				this.prepareSidebarFooterItemsAsync().then(() => this.activeSidebar());
			}
			else if ("LogOut" === info.args.Type) {
				this.prepareSidebarFooterItemsAsync().then(() => this.activeSidebar(() => {
					this.configSvc.appConfig.options.extras["organizations"] = new Array<string>();
					AppUtility.invoke(() => this.configSvc.saveOptionsAsync(), 123, true);
				}));
			}
		});

		AppEvents.on("Account", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode) {
				this.updateSidebarHeader();
				this.prepareSidebarFooterItemsAsync().then(() => this.prepareSidebar());
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode) {
				if (this.activeOrganization !== undefined) {
					this.configSvc.appConfig.services.active.system = this.configSvc.appConfig.options.extras["organization"] = this.activeOrganization.ID;
				}
				else {
					const organizationID = this.configSvc.appConfig.options.extras["organization"] as string;
					if (this.configSvc.isDebug) {
						this.showWarning("Prepare to update active organization when got profile updated", organizationID);
					}
					this.getOrganizationAsync(organizationID, () => this.setActiveOrganization(Organization.get(organizationID)));
				}
			}
		});
	}

	async initializeAsync(onNext?: () => void) {
		await this.getDefinitionsAsync();
		if (Organization.active === undefined) {
			if (this.configSvc.isDebug) {
				this.showWarning("Prepare to get active organization on initializing");
			}
			await this.getActiveOrganizationAsync(undefined, true);
		}
		else {
			if (this.configSvc.isDebug) {
				this.showWarning(`Prepare ${Organization.active.modules.length < 1 ? "modules" : "scheduling tasks"} when got active organization on initializing`, Organization.active);
			}
			if (Organization.active.modules.length < 1) {
				await this.getOrganizationAsync(Organization.active.ID, undefined, undefined, true);
			}
			else {
				this.fetchSchedulingTasks();
			}
		}
		if (this.configSvc.appConfig.services.active.service === this.name) {
			this.configSvc.appConfig.URLs.search = "/portals/cms/contents/search";
			if (Organization.active === undefined) {
				this.prepareSidebar();
			}
		}
		await this.prepareSidebarFooterItemsAsync();
		this.activeSidebar(onNext);
	}

	canManageOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization !== undefined && AppUtility.isNotEmpty(organization.ID)
			? AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isAdministrator(this.name, "Organization", organization.Privileges, account)
			: this.authSvc.isAdministrator(this.name, "Organization", undefined, account);
	}

	canModerateOrganization(organization?: Organization, account?: Account) {
		account = account || this.configSvc.getAccount();
		return organization !== undefined && AppUtility.isNotEmpty(organization.ID)
			? AppUtility.isEquals(organization.OwnerID, account.id) || this.authSvc.isModerator(this.name, "Organization", organization.Privileges, account)
			: this.authSvc.isModerator(this.name, "Organization", undefined, account);
	}

	async getDefinitionsAsync(onNext?: () => void) {
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

	async getThemesAsync(onNext?: () => void) {
		if (this.themes === undefined) {
			const path = this.configSvc.getDefinitionPath(this.name, "themes");
			this.themes = this.configSvc.getDefinition(path) || await this.configSvc.fetchDefinitionAsync(path, false);
		}
		if (onNext !== undefined) {
			onNext();
		}
		return this.themes;
	}

	getActiveOrganizations() {
		const organizations = new Array<Organization>();
		const organizationIDs = this.activeOrganizations;
		organizationIDs.forEach(organizationID => {
			const organization = this.getOrganization(organizationID, false);
			if (organization === undefined) {
				this.getOrganizationAsync(organizationID, _ => {
					if (this.getOrganization(organizationID, false) === undefined) {
						organizationIDs.remove(organizationID);
					}
				});
			}
			else {
				organizations.push(organization);
			}
		});
		return organizations;
	}

	async getActiveOrganizationsAsync(useXHR: boolean = true, processModules: boolean = true) {
		const organizations = new Array<Organization>();
		await Promise.all(this.activeOrganizations.filter(id => AppUtility.isNotEmpty(id)).map(async id => {
			let organization = Organization.get(id);
			if (organization === undefined) {
				await this.getOrganizationAsync(id, _ => organization = Organization.get(id), undefined, useXHR, processModules);
			}
			if (organization !== undefined) {
				organizations.push(organization);
			}
			else if (useXHR) {
				this.activeOrganizations.remove(id);
			}
		}));
		return organizations.sortBy("Title");
	}

	async getActiveOrganizationAsync(preferID?: string, useXHR: boolean = true, onNext?: () => void) {
		preferID = AppUtility.isNotEmpty(preferID)
			? preferID
			: this.configSvc.appConfig.services.active.system || this.configSvc.appConfig.options.extras["organization"];
		if (AppUtility.isNotEmpty(preferID)) {
			if (Organization.active !== undefined && AppUtility.isEquals(Organization.active.ID, preferID)) {
				this.configSvc.appConfig.services.active.system = this.configSvc.appConfig.options.extras["organization"] = Organization.active.ID;
			}
			else {
				if (this.configSvc.isDebug) {
					this.showWarning("Get active organization", preferID);
				}
				await this.getOrganizationAsync(preferID, () => {
					const organization = Organization.get(preferID) || Organization.get(this.activeOrganizations.first()) || Organization.instances.first();
					if (this.configSvc.isDebug) {
						this.showWarning("Update active organization (when get active organization)", organization);
					}
					this.setActiveOrganization(organization);
				}, undefined, useXHR);
			}
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Organization.active;
	}

	setActiveOrganization(organization: Organization, onNext?: () => void) {
		if (organization !== undefined) {
			this.configSvc.appConfig.services.active.system = this.configSvc.appConfig.options.extras["organization"] = organization.ID;
			this.activeOrganizations.merge([organization.ID], true);
			if (Organization.active === undefined || Organization.active.ID !== organization.ID) {
				Organization.active = organization;
				AppEvents.broadcast(this.name, { Type: "Organization", Mode: "Changed", ID: Organization.active.ID });
				const useXHR = organization.modules.length < 1;
				this.getActiveModuleAsync(undefined, useXHR, undefined, false).then(() => {
					if (useXHR) {
						AppEvents.broadcast(this.name, { Type: "Organization", Mode: "Changed", ID: Organization.active.ID });
					}
					this.configSvc.saveOptionsAsync(() => AppEvents.broadcast("App", { Type: "Options", Mode: "Changed" }));
					if (this.configSvc.isAuthenticated && Site.instances.first(site => site.SystemID === organization.ID) === undefined) {
						this.searchSitesAsync(AppPagination.buildRequest({ And: [{ SystemID: { Equals: organization.ID } }] }, { Title: "Ascending" }));
					}
				});
				if (this.configSvc.isDebug) {
					this.showWarning("Set active organization", this.activeOrganization);
				}
			}
		}
		if (Organization.active !== undefined) {
			this.fetchSchedulingTasks();
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Organization.active;
	}

	removeActiveOrganization(organizationID: string, onNext?: () => void) {
		this.configSvc.appConfig.services.active.system = this.configSvc.appConfig.options.extras["organization"] = undefined;
		this.activeOrganizations.remove(organizationID);
		delete this.activeModules[organizationID];
		Organization.active = Module.active = undefined;
		return this.setActiveOrganization(Organization.get(this.activeOrganizations.first()), onNext);
	}

	async getActiveModuleAsync(preferID?: string, useXHR: boolean = true, onNext?: () => void, broadcast: boolean = true) {
		const activeOrganization = this.activeOrganization;
		const systemID = activeOrganization !== undefined
			? activeOrganization.ID
			: undefined;

		Module.active = Module.active !== undefined && Module.active.SystemID === systemID
			? Module.active
			: undefined;

		if (Module.active === undefined) {
			preferID = AppUtility.isNotEmpty(preferID) ? preferID : AppUtility.isNotEmpty(systemID) ? this.activeModules[systemID] : undefined;
			if (AppUtility.isNotEmpty(preferID)) {
				if (Module.contains(preferID)) {
					Module.active = Module.get(preferID);
				}
				else {
					await this.getModuleAsync(preferID, () => this.setActiveModule(Module.get(preferID) || (activeOrganization !== undefined ? activeOrganization.defaultModule : undefined), undefined, broadcast), undefined, useXHR);
				}
			}
			else if (activeOrganization !== undefined) {
				if (activeOrganization.modules.length > 0) {
					this.setActiveModule(activeOrganization.defaultModule, undefined, broadcast);
				}
				else {
					await this.getOrganizationAsync(activeOrganization.ID, () => this.setActiveModule(activeOrganization.defaultModule, undefined, broadcast), undefined, useXHR);
				}
			}
		}

		if (onNext !== undefined) {
			onNext();
		}
		return Module.active;
	}

	setActiveModule(module: Module, onNext?: () => void, broadcast: boolean = true) {
		if (module !== undefined && (Module.active === undefined || Module.active.ID !== module.ID)) {
			Module.active = module;
			this.activeModules[module.SystemID] = module.ID;
			if (broadcast) {
				AppEvents.broadcast(this.name, { Type: "Module", Mode: "Changed", ID: Module.active.ID });
				this.configSvc.saveOptionsAsync(() => AppEvents.broadcast("App", { Type: "Options", Mode: "Changed" }));
			}
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Module.active;
	}

	setLookupOptions(lookupOptions: AppFormsControlLookupOptionsConfig, lookupModalPage: any, contentType: ContentType, multiple?: boolean, nested?: boolean, onCompleted?: (options: AppFormsControlLookupOptionsConfig) => void) {
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
			lookupOptions.Multiple = AppUtility.isTrue(multiple);
		}
		if (nested !== undefined) {
			lookupOptions.ModalOptions.ComponentProps.nested = AppUtility.isTrue(nested);
		}
		if (onCompleted !== undefined) {
			onCompleted(lookupOptions);
		}
	}

	setUISettingsControlOptions(controlConfig: AppFormsControlConfig, replacePattern: string, fileOptions: FileOptions) {
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

	setTemplateControlOptions(control: AppFormsControlConfig | AppFormsControl, name: string, theme?: string, mainDirectory?: string, subDirectory?: string) {
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: async (_, formControl) => (formControl as AppFormsControlComponent).setValue(await this.getTemplateAsync(name, theme, mainDirectory, subDirectory))
		};
	}

	async getTemplateAsync(name: string, theme?: string, mainDirectory?: string, subDirectory?: string) {
		let template: string;
		await this.fetchAsync(this.getPath("definitions", "template", "x-request=" + AppCrypto.jsonEncode({ Name: name, Theme: theme, MainDirectory: mainDirectory, SubDirectory: subDirectory })), data => template = data.Template);
		return template || "";
	}

	async getTemplateZonesAsync(dekstopID: string) {
		let zones: Array<string>;
		await this.fetchAsync(this.getPath("definitions", "template", "x-request=" + AppCrypto.jsonEncode({ Mode: "Zones", DesktopID: dekstopID })), data => zones = data);
		return zones || [];
	}

	getTheme(object: BaseModel) {
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

	getRouterLink(contentType: ContentType, action?: string, title?: string, objectName?: string, path?: string) {
		objectName = AppUtility.isNotEmpty(objectName) ? objectName : contentType !== undefined ? contentType.getObjectName() : "unknown";
		return `/portals/${path || "cms"}/`
			+ (AppUtility.isEquals(objectName, "Category") ? "categories" : `${objectName}s`).toLowerCase() + "/"
			+ (action || "list").toLowerCase()
			+ ("search" === action ? "" : "/")
			+ ("search" === action ? "" : AppUtility.toANSI(title || (contentType !== undefined ? contentType.ansiTitle : "untitled"), true));
	}

	getRouterQueryParams(contentType: ContentType, params?: { [key: string]: any }) {
		if (contentType !== undefined) {
			params = params || {};
			params["RepositoryEntityID"] = contentType.ID;
		}
		return {
			"x-request": AppCrypto.jsonEncode(params)
		};
	}

	getAppURL(contentType: ContentType, action?: string, title?: string, params?: { [key: string]: any }, objectName?: string, path?: string) {
		return this.getRouterLink(contentType, action, title, objectName, path) + "?x-request=" + this.getRouterQueryParams(contentType, params)["x-request"];
	}

	getSiteURL(object: BaseModel) {
		const organization = Organization.get(object["SystemID"]);
		const site = object !== undefined && object instanceof Site
			? object as Site
			: organization !== undefined
				? Site.instances.first(s => s.SystemID === organization.ID)
				: undefined;
		const url = site !== undefined
			? `http${site.AlwaysUseHTTPs || site.AlwaysReturnHTTPs ? "s" : ""}://${site.SubDomain}.${site.PrimaryDomain}/`.replace("://*", "://www").replace("://www.www", "://www")
			: this.configSvc.appConfig.URIs.portals + `~${organization.Alias}/`;
		return site !== undefined && site.RedirectToNoneWWW
			? url.replace("://www.", "://")
			: url;
	}

	getPermanentURL(object: CmsBaseModel, usePortalURL: boolean = false) {
		const organization = object.organization;
		const url = usePortalURL ? `~${organization.Alias}/` : this.getSiteURL(object);
		return (url.indexOf("~" + organization.Alias) > -1 ? this.configSvc.appConfig.URIs.portals : url) + `_permanentlink/${object.RepositoryEntityID}/${object.ID}${object.organization.AlwaysUseHtmlSuffix ? ".html" : ""}`;
	}

	getDesktop(object: CmsBaseModel) {
		const module = Module.get(object.RepositoryID);
		const contentType = ContentType.get(object.RepositoryEntityID);
		return Desktop.get(object["DesktopID"]) || Desktop.get(contentType === undefined ? undefined : contentType.DesktopID) || Desktop.get(module === undefined ? undefined : module.DesktopID);
	}

	getPublicURL(object: CmsBaseModel, parent?: CmsBaseModel) {
		let url: string = parent !== undefined ? this.getPublicURL(parent, undefined) : undefined;
		if (url === undefined) {
			const desktop = this.getDesktop(object);
			url = desktop !== undefined
				? `${this.getSiteURL(object)}${desktop.Alias}`
				: undefined;
		}
		return url !== undefined
			? `${url}/${object["Alias"] || object.ID}${parent !== undefined && object.organization.AlwaysUseHtmlSuffix ? ".html" : ""}`
			: undefined;
	}

	getPortalURL(object: CmsBaseModel, parent?: CmsBaseModel, usePortalURL: boolean = false) {
		let url: string = parent !== undefined ? this.getPortalURL(parent) : undefined;
		if (url === undefined) {
			const organization = Organization.get(object.SystemID);
			const desktop = this.getDesktop(object);
			url = this.configSvc.appConfig.URIs.portals + (organization !== undefined && desktop !== undefined ? `~${organization.Alias}/${desktop.Alias}` : "_permanentlink");
		}
		return url.indexOf("_permanent") > 0
			? this.getPermanentURL(object, usePortalURL)
			: `${url}/${object["Alias"] || object.ID}`;
	}

	getPaginationPrefix(objectName: string) {
		return `${objectName}@${this.name}`.toLowerCase();
	}

	getEmailNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, name?: string, replacement?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
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

	private getWebHookFormControl(name: string, label: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: name,
			Options: {
				Label: label,
			},
			SubControls: {
				Controls: [
					{
						Name: "SignAlgorithm",
						Type: "Select",
						Options: {
							Label: "{{portals.common.controls.webhooks.signAlgorithm.label}}",
							Description: "{{portals.common.controls.webhooks.signAlgorithm.description}}",
							SelectOptions: {
								Interface: "alert",
								Values: ["MD5", "SHA1", "SHA256", "SHA384", "SHA512", "RIPEMD160", "BLAKE128", "BLAKE256", "BLAKE384", "BLAKE512"]
							}
						}
					},
					{
						Name: "SignKey",
						Options: {
							Label: "{{portals.common.controls.webhooks.signKey.label}}",
							Description: "{{portals.common.controls.webhooks.signKey.description}}",
							Icon: {
								Name: "color-wand",
								OnClick: (_, formControl) => (formControl as AppFormsControlComponent).setValue(`${this.activeOrganization.Alias}-webhook-signature-key-${AppCrypto.md5(new Date().toJSON())}`)
							}
						}
					},
					{
						Name: "SignKeyIsHex",
						Type: "YesNo",
						Options: {
							Label: "{{portals.common.controls.webhooks.signKeyIsHex.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "SignatureName",
						Options: {
							Label: "{{portals.common.controls.webhooks.signatureName.label}}",
							Description: "{{portals.common.controls.webhooks.signatureName.description}}"
						}
					},
					{
						Name: "SignatureAsHex",
						Type: "YesNo",
						Options: {
							Label: "{{portals.common.controls.webhooks.signatureAsHex.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "SignatureInQuery",
						Type: "YesNo",
						Options: {
							Label: "{{portals.common.controls.webhooks.signatureInQuery.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "SecretToken",
						Options: {
							Type: "password",
							Label: "{{portals.common.controls.webhooks.secretToken.label}}",
							Description: "{{portals.common.controls.webhooks.secretToken.description}}"
						}
					},
					{
						Name: "Query",
						Type: "TextArea",
						Options: {
							Label: "{{portals.common.controls.webhooks.query.label}}",
							Description: "{{portals.common.controls.webhooks.query.description}}",
							Rows: 5
						}
					},
					{
						Name: "Header",
						Type: "TextArea",
						Options: {
							Label: "{{portals.common.controls.webhooks.header.label}}",
							Description: "{{portals.common.controls.webhooks.header.description}}",
							Rows: 5
						}
					},
					{
						Name: "EncryptionKey",
						Options: {
							Type: "password",
							Label: "{{portals.common.controls.webhooks.encryptionKey.label}}",
							Description: "{{portals.common.controls.webhooks.encryptionKey.description}}"
						}
					},
					{
						Name: "EncryptionIV",
						Options: {
							Type: "password",
							Label: "{{portals.common.controls.webhooks.encryptionIV.label}}",
							Description: "{{portals.common.controls.webhooks.encryptionIV.description}}"
						}
					},
					{
						Name: "GenerateIdentity",
						Type: "YesNo",
						Options: {
							Label: "{{portals.common.controls.webhooks.generateIdentity.label}}",
							Type: "toggle"
						}
					},
					{
						Name: "PrepareBodyScript",
						Type: "TextArea",
						Options: {
							Label: "{{portals.common.controls.webhooks.prepareBodyScript.label}}",
							PlaceHolder: "{{portals.common.controls.webhooks.prepareBodyScript.placeholder}}",
							Description: "{{portals.common.controls.webhooks.prepareBodyScript.description}}",
							Rows: 30
						}
					}
				]
			}
		};

		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		return controlConfig;
	}

	getWebHookNotificationFormControl(allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig = this.getWebHookFormControl("WebHooks", "{{portals.common.controls.notifications.webhooks.label}}");
		controlConfig.SubControls.Controls.removeAt(controlConfig.SubControls.Controls.findIndex(ctrl => ctrl.Name === "SecretToken")).forEach(ctrl => ctrl.Hidden = inheritFromParent);
		controlConfig.SubControls.Controls.insert({
			Name: "EndpointURLs",
			Type: "TextArea",
			Hidden: inheritFromParent,
			Options: {
				Label: "{{portals.common.controls.notifications.webhooks.endpointURLs.label}}",
				PlaceHolder: "{{portals.common.controls.notifications.webhooks.endpointURLs.placeholder}}",
				Description: "{{portals.common.controls.notifications.webhooks.endpointURLs.description}}"
			}
		}, 0);

		controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "SignKey").Options.Description = "{{portals.common.controls.notifications.webhooks.signKey.description}}";
		controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "SignatureName").Options.Description = "{{portals.common.controls.notifications.webhooks.signatureName.description}}";

		let control = controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "Query");
		control.Options.Label = "{{portals.common.controls.notifications.webhooks.query.label}}";
		control.Options.Description = "{{portals.common.controls.notifications.webhooks.query.description}}";

		control = controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "Header");
		control.Options.Label = "{{portals.common.controls.notifications.webhooks.header.label}}";
		control.Options.Description = "{{portals.common.controls.notifications.webhooks.header.description}}";

		control = controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "EncryptionKey");
		control.Options.Label = "{{portals.common.controls.notifications.webhooks.encryptionKey.label}}";
		control.Options.Description = "{{portals.common.controls.notifications.webhooks.encryptionKey.description}}";

		control = controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "EncryptionIV");
		control.Options.Label = "{{portals.common.controls.notifications.webhooks.encryptionIV.label}}";
		control.Options.Description = "{{portals.common.controls.notifications.webhooks.encryptionIV.description}}";

		controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "GenerateIdentity").Options.Label = "{{portals.common.controls.notifications.webhooks.generateIdentity.label}}";

		control = controlConfig.SubControls.Controls.find(ctrl => ctrl.Name === "PrepareBodyScript");
		control.Options.Label = "{{portals.common.controls.notifications.webhooks.prepareBodyScript.label}}";
		control.Options.PlaceHolder = "{{portals.common.controls.notifications.webhooks.prepareBodyScript.placeholder}}";
		control.Options.Description = "{{portals.common.controls.notifications.webhooks.prepareBodyScript.description}}";
		control.Options.Rows = 10;

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

		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		return controlConfig;
	}

	get defaultEmailNotificationSettings() {
		return {
			ToAddresses: undefined as string,
			CcAddresses: undefined as string,
			BccAddresses: undefined as string,
			Subject: undefined as string,
			Body: undefined as string
		} as EmailNotificationSettings;
	}

	get defaultWebHookNotificationSettings() {
		const settings = this.defaultWebHookSettings;
		settings["EndpointURLs"] = [];
		settings["SignatureInQuery"] = false;
		return settings as WebHookNotificationSettings;
	}

	get defaultWebHookSettings() {
		return {
			SignAlgorithm: "SHA256",
			SignKeyIsHex: false,
			SignatureAsHex: true,
			GenerateIdentity: false
		} as WebHookSettings;
	}

	getNotificationsFormControl(name: string, segment?: string, events?: Array<string>, methods?: Array<string>, allowInheritFromParent: boolean = true, inheritStates?: { inheritEventsAndMethods: boolean, inheritEmails: boolean, inheritEmailsByApprovalStatus: boolean, inheritEmailsWhenPublish: boolean, inheritWebHooks: boolean }, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
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
								Values: (events || ["Create", "Update", "Delete"]).map(value => ({ Value: value, Label: `{{events.${value}}}` }))
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
			controlConfig.SubControls.Controls.push(
				this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmails),
				this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmailsByApprovalStatus, "EmailsByApprovalStatus", "emailsByApprovalStatus", emailsByApprovalStatus => emailsByApprovalStatus.SubControls.Controls.insert({
					Name: "Status",
					Type: "Select",
					Hidden: inheritEmailsByApprovalStatus,
					Options: {
						Label: "{{status.approval.label}}",
						SelectOptions: {
							Interface: "alert",
							Values: BaseModel.approvalStatus.map(value => ({ Value: value, Label: `{{status.approval.${value}}}` }))
						}
					}
				}, allowInheritFromParent ? 1 : 0)),
				this.getEmailNotificationFormControl(allowInheritFromParent, inheritEmailsWhenPublish, "EmailsWhenPublish", "emailsWhenPublish")
			);
		}

		if (methods === undefined || methods.indexOf("WebHook") > -1) {
			controlConfig.SubControls.Controls.push(this.getWebHookNotificationFormControl(allowInheritFromParent, inheritWebHooks));
		}

		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		return controlConfig;
	}

	prepareNotificationsFormControl(notificationsControl: AppFormsControlConfig, emailsByApprovalStatus: { [status: string]: EmailNotificationSettings }, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const emailsByApprovalStatusControls = notificationsControl.SubControls.Controls.find(ctrl => ctrl.Name === "EmailsByApprovalStatus").SubControls.Controls;
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "Status").Options.OnChanged = (event, formControl) => {
			const approvalStatusEmail = emailsByApprovalStatus[event.detail.value] || {};
			const controls = formControl.formGroup.controls;
			controls.ToAddresses.setValue(approvalStatusEmail.ToAddresses, { onlySelf: true });
			controls.CcAddresses.setValue(approvalStatusEmail.CcAddresses, { onlySelf: true });
			controls.BccAddresses.setValue(approvalStatusEmail.BccAddresses, { onlySelf: true });
			controls.Subject.setValue(approvalStatusEmail.Subject, { onlySelf: true });
			controls.Body.setValue(approvalStatusEmail.Body, { onlySelf: true });
			formControl.parentControl.SubControls.Controls.find(ctrl => ctrl.Name === "ToAddresses").focus(345);
		};
		emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "ToAddresses").Options.OnBlur =
			emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "CcAddresses").Options.OnBlur =
			emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "BccAddresses").Options.OnBlur =
			emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "Subject").Options.OnBlur =
			emailsByApprovalStatusControls.find(ctrl => ctrl.Name === "Body").Options.OnBlur = (_, formControl) => emailsByApprovalStatus[formControl.formGroup.controls.Status.value] = { ToAddresses: formControl.formGroup.controls.ToAddresses.value, CcAddresses: formControl.formGroup.controls.CcAddresses.value, BccAddresses: formControl.formGroup.controls.BccAddresses.value, Subject: formControl.formGroup.controls.Subject.value, Body: formControl.formGroup.controls.Body.value };
		if (onCompleted !== undefined) {
			onCompleted(notificationsControl);
		}
		return notificationsControl;
	}

	getNotificationInheritStates(notificationSettings: NotificationSettings) {
		return {
			inheritEventsAndMethods: AppUtility.isNull(notificationSettings) || (AppUtility.isNull(notificationSettings.Events) && AppUtility.isNull(notificationSettings.Methods)),
			inheritEmails: AppUtility.isNull(notificationSettings) || !AppUtility.isGotData(notificationSettings.Emails),
			inheritEmailsByApprovalStatus: AppUtility.isNull(notificationSettings) || !AppUtility.isGotData(notificationSettings.EmailsByApprovalStatus),
			inheritEmailsWhenPublish: AppUtility.isNull(notificationSettings) || !AppUtility.isGotData(notificationSettings.EmailsWhenPublish),
			inheritWebHooks: AppUtility.isNull(notificationSettings) || AppUtility.isNull(notificationSettings.WebHooks) || !AppUtility.isGotData(notificationSettings.WebHooks.EndpointURLs)
		};
	}

	getNotificationSettings(notificationSettings: NotificationSettings, emailsByApprovalStatus?: { [status: string]: EmailNotificationSettings }, allowInheritFromParent: boolean = true, onCompleted?: (notifications: any) => void) {
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
			notifications.Emails.InheritFromParent = inheritFromParent || !AppUtility.isGotData(notificationSettings.Emails);
			notifications.EmailsByApprovalStatus.InheritFromParent = inheritFromParent || !AppUtility.isGotData(notificationSettings.EmailsByApprovalStatus);
			notifications.EmailsWhenPublish.InheritFromParent = inheritFromParent || !AppUtility.isGotData(notificationSettings.EmailsWhenPublish);
			notifications.WebHooks.InheritFromParent = inheritFromParent || AppUtility.isNull(notificationSettings.WebHooks) || !AppUtility.isGotData(notificationSettings.WebHooks.EndpointURLs);
		}
		if (onCompleted !== undefined) {
			onCompleted(notifications);
		}
		return notifications;
	}

	normalizeNotificationSettings(notifications: any, emailsByApprovalStatus: { [status: string]: EmailNotificationSettings }, onCompleted?: (notifications: any) => void) {
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

	getEmailSettingsFormControl(name: string, segment?: string, allowInheritFromParent: boolean = true, inheritFromParent: boolean = false, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const buttonsConfig = this.appFormsSvc.getButtonControls(
			undefined,
			{
				Name: "TestEmailSettings",
				Label: "{{portals.common.controls.emails.test.label}}",
				OnClick: async (event, formControl) => {
					event.stopPropagation();
					const email = formControl.parent.parent.value;
					const button = await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.button");
					if (email.Smtp === undefined || AppUtility.isEmpty(email.Smtp.Host)) {
						await this.appFormsSvc.showAlertAsync(button, await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.messages.none"));
					}
					else {
						await this.appFormsSvc.showAlertAsync(
							button,
							undefined,
							undefined,
							async data => {
								const appInfo = this.configSvc.appConfig.app;
								email["To"] = data.To;
								email["Subject"] = AppUtility.isNotEmpty(data.Subject) ? data.Subject : await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.subject.default", { info: this.activeOrganization.Alias + " @ " + appInfo.name });
								email["Body"] = email.Subject + `<br/>App name: ${appInfo.name}<br/>App version: ${appInfo.version}<br/>App frameworks: ${appInfo.frameworks}`;
								if (AppUtility.isNotEmpty(email.To)) {
									await this.appFormsSvc.showLoadingAsync(button);
									await this.sendRequestAsync({
										ServiceName: "email",
										ObjectName: "test",
										Verb: "POST",
										Body: AppUtility.stringify(email)
									},
									async _ => await this.appFormsSvc.showAlertAsync(button, await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.messages.success", { email: email.To })),
									async error => await this.appFormsSvc.showErrorAsync(AppUtility.parseError(error), await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.messages.error")),
									true);
								}
							},
							button,
							await this.appFormsSvc.getResourceAsync("common.buttons.cancel"),
							[
								{
									name: "To",
									type: "email",
									value: undefined,
									placeholder: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.to")
								},
								{
									name: "Subject",
									type: "text",
									value: undefined,
									placeholder: await this.appFormsSvc.getResourceAsync("portals.common.controls.emails.test.subject.placeholder")
								}
							]
						);
					}
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

	getEmailSettings(emailSettings: EmailSettings, allowInheritFromParent: boolean = true, onCompleted?: (settings: any) => void) {
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

	normalizeEmailSettings(settings: any, onCompleted?: (settings: any) => void) {
		if (settings && settings.InheritFromParent) {
			settings = undefined;
		}
		if (onCompleted !== undefined) {
			onCompleted(settings);
		}
		return settings;
	}

	getWebHookSettingsFormControl(name: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig = this.getWebHookFormControl(name || "WebHookSettings", "{{portals.common.controls.webhooks.label}}");
		controlConfig.SubControls.Controls.removeAt(controlConfig.SubControls.Controls.findIndex(ctrl => ctrl.Name === "SignatureInQuery")).insert({
			Name: "URL",
			Type: "TextBox",
			Options: {
				Label: "{{portals.common.controls.webhooks.url.label}}",
				Description: "{{portals.common.controls.webhooks.url.description}}",
				ReadOnly: true,
				Icon: {
					Name: "copy-outline",
					Fill: "clear",
					Color: "medium",
					Slot: "end",
					OnClick: (_, formControl) => PlatformUtility.copyToClipboardAsync(formControl.value, async () => await this.appFormsSvc.showToastAsync("Copied..."))
				}
			}
		}, 0);
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		controlConfig.SubControls.Controls.forEach((ctrl, index) => ctrl.Order = index);
		return controlConfig;
	}

	getWebHookSettings(webhookSettings: WebHookSettings, onCompleted?: (settings: any) => void) {
		const settings = AppUtility.clone(webhookSettings || this.defaultWebHookSettings);
		if (onCompleted !== undefined) {
			onCompleted(settings);
		}
		return settings as WebHookSettings;
	}

	getUploadFormControl(fileOptions: FileOptions, segment?: string, label?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
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

	getAuditFormControl(ojbect: BaseModel, segment?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		return this.usersSvc.getAuditFormControl(ojbect.Created, ojbect.CreatedID, ojbect.LastModified, ojbect.LastModifiedID, segment, onCompleted);
	}

	getAuditInfoAsync(ojbect: BaseModel) {
		return this.usersSvc.getAuditInfoAsync(ojbect.Created, ojbect.CreatedID, ojbect.LastModified, ojbect.LastModifiedID);
	}

	getRepositoryEntityInfo(contentType: ContentType) {
		const organization = contentType !== undefined ? Organization.get(contentType.SystemID) : undefined;
		return contentType !== undefined ? contentType.Title + (organization !== undefined ? ` @ ${organization.Title}` : "") : "";
	}

	getRolesSelector(modalComponent: any, modalComponentProperties?: { [key: string]: any }) {
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

	lookup(objectName: string, request: AppDataRequest, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.search(this.getSearchingPath(objectName, this.configSvc.relatedQuery), request, onSuccess, onError, true, headers);
	}

	lookupAsync(objectName: string, request: AppDataRequest, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.searchAsync(this.getSearchingPath(objectName, this.configSvc.relatedQuery), request, onSuccess, onError, true, headers);
	}

	getAsync(objectName: string, id: string, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.readAsync(this.getPath(objectName, id), onSuccess, onError, headers, true);
	}

	refreshAsync(objectName: string, id: string, onSuccess?: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.readAsync(this.getPath(objectName, "refresh", `object-id=${id}`), onSuccess, onError, headers, useXHR);
	}

	private updateSidebarHeader() {
		const organization = this.configSvc.isAuthenticated ? this.activeOrganization : undefined;
		AppEvents.broadcast("UpdateSidebarHeader", {
			title: organization !== undefined ? organization.Alias : this.configSvc.appConfig.app.name,
			onClick: (organization !== undefined && this.canManageOrganization(organization) ? _ => this.configSvc.navigateForwardAsync(organization.routerURI) : _ => {}) as (sidebar?: AppSidebar, event?: Event) => void
		});
	}

	private openSidebar(name: string, sidebar: AppSidebar) {
		if (sidebar.State.Active !== name) {
			if (sidebar.State.Active !== "cms" && sidebar.State.Active !== "portals" && (name === "cms" || name === "portals")) {
				this.updateSidebarHeader();
			}
			sidebar.State.Active = name;
			if (sidebar.State.Active === "cms" || sidebar.State.Active === "portals") {
				this.configSvc.appConfig.services.active.service = this.name;
				this.configSvc.appConfig.URLs.search = "/portals/cms/contents/search";
			}
		}
		if (!sidebar.State.Visible) {
			sidebar.active(name, true);
		}
	}

	private prepareSidebar(onNext?: () => void) {
		const items = new Array<AppSidebarMenuItem>();

		if (this.configSvc.isAuthenticated) {
			const account = this.configSvc.getAccount();
			const canManageOrganization = this.authSvc.isSystemAdministrator(account) || this.canManageOrganization(this.activeOrganization, account);
			const canModerateOrganization = canManageOrganization || this.canModerateOrganization(this.activeOrganization, account);

			if (canManageOrganization) {
				items.push(
					{
						Title: "{{portals.sidebar.tasks}}",
						Link: this.getRouterLink(undefined, "list", "all", "task", "core"),
						Direction: "root",
						Icon: { Name: "timer", Color: "medium", Slot: "start" }
					},
					{
						Title: "{{portals.sidebar.organizations}}",
						Link: this.getRouterLink(undefined, "list", "all", "organization", "core"),
						Direction: "root",
						Icon: { Name: "business", Color: "medium", Slot: "start" }
					},
					{
						Title: "{{portals.sidebar.roles}}",
						Link: this.getRouterLink(undefined, "list", "all", "role", "core"),
						Direction: "root",
						Icon: { Name: "body", Color: "medium", Slot: "start" }
					},
					{
						Title: "{{portals.sidebar.modules}}",
						Link: this.getRouterLink(undefined, "list", "all", "module", "core"),
						Direction: "root",
						Icon: { Name: "albums", Color: "medium", Slot: "start" }
					}
				);
			}

			items.push({
				Title: "{{portals.sidebar.content-types}}",
				Link: this.getRouterLink(undefined, "list", "all", "content.type", "core"),
				Direction: "root",
				Icon: { Name: "git-branch", Color: "medium", Slot: "start" }
			});

			if (canModerateOrganization) {
				items.push({
					Title: "{{portals.sidebar.expressions}}",
					Link: this.getRouterLink(undefined, "list", "all", "expression", "core"),
					Direction: "root",
					Icon: { Name: "extension-puzzle", Color: "medium", Slot: "start" }
				});
				const service = this.configSvc.appConfig.services.all.first(svc => svc.name === this.name);
				if (!!service.specials && service.specials.indexOf("Crawler") > -1) {
					items.push({
						Title: "{{portals.sidebar.crawlers}}",
						Link: this.getRouterLink(undefined, "list", "all", "crawler"),
						Direction: "root",
						Icon: { Name: "sparkles", Color: "medium", Slot: "start" }
					});
				}
			}

			if (canManageOrganization) {
				items.push({
					Title: "{{portals.sidebar.sites}}",
					Link: this.getRouterLink(undefined, "list", "all", "site", "core"),
					Direction: "root",
					Icon: { Name: "globe", Color: "medium", Slot: "start" }
				});
			}

			if (canModerateOrganization) {
				items.push({
					Title: "{{portals.sidebar.desktops}}",
					Link: this.getRouterLink(undefined, "list", "all", "desktop", "core"),
					Direction: "root",
					Icon: { Name: "desktop", Color: "medium", Slot: "start" }
				});
			}

			items.push({
				Title: "{{portals.sidebar.titles.categories}}",
				Link: this.getRouterLink(undefined, "list", "all", "category"),
				Direction: "root",
				Icon: { Name: "logo-firebase", Color: "medium", Slot: "start" }
			});
		}

		AppEvents.broadcast("UpdateSidebar", {
			name: "portals",
			parent: { Title: "{{portals.sidebar.titles.system}}" },
			items: items,
			index: this.menuIndex + 1
		});

		if (onNext !== undefined) {
			onNext();
		}
	}

	private activeSidebar(onNext?: () => void) {
		if (this.configSvc.appConfig.services.active.service === this.name) {
			AppUtility.invoke(() => {
				let name = "cms";
				if (this.configSvc.isAuthenticated && this.activeOrganization !== undefined) {
					const activeModule = this.activeModule;
					if (activeModule === undefined || activeModule.contentTypes.length < 1) {
						name = "portals";
					}
				}
				AppEvents.broadcast("ActiveSidebar", { Name: name });
			}, 456);
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	private async prepareSidebarFooterItemsAsync(onNext?: () => void) {
		AppEvents.broadcast("UpdateSidebarFooter", { items: [{
			Name: "cms",
			Icon: "logo-firebase",
			Title: await this.configSvc.getResourceAsync("portals.preferences.cms"),
			OnClick: (name: string, sidebar: AppSidebar) => this.openSidebar(name, sidebar),
			Position: this.menuIndex
		},
		{
			Name: this.configSvc.isAuthenticated ? "portals" : undefined,
			Icon: this.configSvc.isAuthenticated ? "cog" : undefined,
			Title: await this.configSvc.getResourceAsync("portals.preferences.portals"),
			OnClick: (name: string, sidebar: AppSidebar) => this.openSidebar(name, sidebar),
			Position: this.menuIndex  + 1
		}]});
		if (onNext !== undefined) {
			onNext();
		}
	}

	addOrganizationControl(controls: AppFormsControlConfig[], label: string, organization?: Organization, readOnly: boolean = true, position: number = 0) {
		controls.insert({
			Name: "Organization",
			Type: "Text",
			Segment: "basic",
			Extras: { Text: (organization || this.activeOrganization).Title },
			Options: {
				Label: label,
				ReadOnly: readOnly
			}
		}, position);
		return controls;
	}

	prepareApprovalStatusControl(controlConfig: AppFormsControlConfig) {
		this.appFormsSvc.prepareSelectControl(controlConfig, controlConfig.Options.SelectOptions.Values, _ => controlConfig.Options.SelectOptions.Values = AppUtility.isGotData(controlConfig.Options.SelectOptions.Values)
			? (controlConfig.Options.SelectOptions.Values as AppFormsLookupValue[]).map(kvp => ({ Value: kvp.Value, Label: `{{status.approval.${kvp.Value}}}` }) as AppFormsLookupValue)
			: BaseModel.approvalStatus.map(value => ({ Value: value, Label: `{{status.approval.${value}}}` }) as AppFormsLookupValue)
		);
		return controlConfig;
	}

	async prepareLanguageControlAsync(controlConfig: AppFormsControlConfig, required: boolean = false, addUnspecified: boolean = true) {
		controlConfig.Required = required;
		controlConfig.Options.SelectOptions.Values = this.configSvc.languages.map(language => ({ Value: language.Value, Label: language.Label }));
		if (addUnspecified) {
			controlConfig.Options.SelectOptions.Values.insert({ Value: "-", Label: await this.configSvc.getResourceAsync("portals.common.unspecified") }, 0);
		}
		return controlConfig;
	}

	async prepareThemeControlAsync(controlConfig: AppFormsControlConfig, selectInterface?: string) {
		const themes = await this.getThemesAsync();
		controlConfig.Options.SelectOptions.Interface = selectInterface || "alert";
		controlConfig.Options.SelectOptions.Values = themes.map(theme => ({ Value: theme.name, Label: theme.name }));
		controlConfig.Options.SelectOptions.Values.insert({ Value: "-", Label: await this.configSvc.getResourceAsync("portals.common.unspecified") }, 0);
		return controlConfig;
	}

	getPortalFileHeaders(object: CmsBaseModel) {
		return {
			"x-service-name": this.name,
			"x-object-name": object.contentType !== undefined ? object.contentType.getObjectName() : "unknown",
			"x-system-id": object.SystemID,
			"x-entity": object.contentType.ID,
			"x-object-id": object.ID
		};
	}

	async exportToExcelAsync(objectName: string, systemID?: string, repositoryID?: string, repositoryEntityID?: string, filterBy?: any, sortBy?: any, pagination?: AppDataPagination, maxPages?: number, onCompleted?: (message: AppMessage) => void, onProgress?: (percentage: string) => void, onError?: (error?: any) => void) {
		await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.common.excel.action.export"));
		const request = {
			SystemID: systemID,
			RepositoryID: repositoryID,
			RepositoryEntityID: repositoryEntityID,
			ObjectName: objectName,
			FilterBy: filterBy || {},
			SortBy: sortBy || {},
			Pagination: pagination || {}
		};
		request.Pagination["MaxPages"] = maxPages !== undefined && maxPages > 0 ? maxPages : 0;
		await this.sendRequestAsync(
			{
				Path: this.getPath("excel", "export", "x-request=" + AppCrypto.jsonEncode(request)),
				Header: this.getHeaders()
			},
			data => {
				const processID = data !== undefined ? data.ProcessID as string : undefined;
				if (AppUtility.isNotEmpty(processID)) {
					if (this.configSvc.isDebug) {
						console.log(`[Portals]: Start to export objects to Excel - Process ID: ${processID}`);
					}
					AppAPIs.registerAsObjectScopeProcessor(
						this.name,
						"Excel",
						message => {
							switch (message.Data.Status || "") {
								case "Done":
									if (this.configSvc.isDebug) {
										console.log(`[Portals]: The export objects to Excel process was completed - Process ID: ${processID}`);
									}
									AppAPIs.unregisterProcessor(processID, this.name, "Excel");
									if (onProgress !== undefined) {
										onProgress(message.Data.Percentage);
									}
									if (onCompleted !== undefined) {
										this.appFormsSvc.hideLoadingAsync().then(() => onCompleted(message));
									}
									AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
										await this.configSvc.getResourceAsync("portals.common.excel.message.export"),
										() => PlatformUtility.openURL(this.filesSvc.getTemporaryFileURI(message)),
										await this.configSvc.getResourceAsync("common.buttons.download"),
										await this.configSvc.getResourceAsync("common.buttons.cancel")
									));
									break;
								case "Error":
									if (this.configSvc.isDebug) {
										console.error(`[Portals]: Error occurred while exporting objects to Excel - Process ID: ${processID}`, message);
									}
									AppAPIs.unregisterProcessor(processID, this.name, "Excel");
									if (onError !== undefined) {
										this.appFormsSvc.hideLoadingAsync().then(() => onError(message.Data));
									}
									else {
										this.appFormsSvc.showErrorAsync(message.Data);
									}
									break;
								default:
									if (this.configSvc.isDebug) {
										console.log(`[Portals]: Exporting - Process ID: ${processID} - ${message.Data.Percentage}`);
									}
									if (onProgress !== undefined) {
										onProgress(message.Data.Percentage);
									}
									break;
							}
						},
						processID
					);
				}
				else {
					this.appFormsSvc.hideLoadingAsync();
				}
			},
			error => {
				if (onError !== undefined) {
					this.appFormsSvc.hideLoadingAsync().then(() => onError(error));
				}
				else {
					this.appFormsSvc.showErrorAsync(error);
				}
			}
		);
	}

	async importFromExcelAsync(objectName: string, systemID?: string, repositoryID?: string, repositoryEntityID?: string, onCompleted?: (message: AppMessage) => void, onProgress?: (percentage: string) => void, onError?: (error?: any) => void) {
		await this.appFormsSvc.showModalAsync(
			FilesProcessorModalPage,
			{
				mode: "upload",
				temporary: true,
				multiple: false,
				accept: ".xls,.xlsx",
				buttonLabels: {
					upload: await this.configSvc.getResourceAsync("portals.common.excel.button")
				},
				fileOptions: {
					ServiceName: this.name,
					ObjectName: objectName,
					SystemID: systemID,
					RepositoryID: repositoryID,
					RepositoryEntityID: repositoryEntityID,
					IsShared: false,
					IsTracked: false,
					IsTemporary: true
				},
				headerOptions: [{
					name: "x-regenerate-id",
					value: "x",
					label: await this.configSvc.getResourceAsync("portals.common.controls.notifications.webhooks.generateIdentity.label")
				}],
				handlers: {
					onUploaded: async (uploadedInfo: { data: Array<any>; headers: { [key: string]: string } }) => {
						console.log("Import data from Excel", uploadedInfo.data, uploadedInfo.headers);
						await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.common.excel.action.import"));
						const info = uploadedInfo.data.first();
						const nodeID = info["x-node"] as string;
						const filename = info["x-filename"] as string;
						this.sendRequestAsync(
							{
								Path: this.getPath("excel", "import", "x-request=" + AppCrypto.jsonEncode({
									SystemID: systemID,
									RepositoryID: repositoryID,
									RepositoryEntityID: repositoryEntityID,
									ObjectName: objectName,
									NodeID: nodeID,
									Filename: filename
								})),
								Header: this.getHeaders(uploadedInfo.headers)
							},
							data => {
								const processID = data !== undefined ? data.ProcessID as string : undefined;
								if (AppUtility.isNotEmpty(processID)) {
									if (this.configSvc.isDebug) {
										console.log(`[Portals]: Start to import objects from Excel - Process ID: ${processID}`);
									}
									AppAPIs.registerAsObjectScopeProcessor(
										this.name,
										"Excel",
										message => {
											switch (message.Data.Status || "") {
												case "Done":
													if (this.configSvc.isDebug) {
														console.log(`[Portals]: The import objects from Excel process was completed - Process ID: ${processID}`);
													}
													AppAPIs.unregisterProcessor(processID, this.name, "Excel");
													if (onProgress !== undefined) {
														onProgress(message.Data.Percentage);
													}
													if (onCompleted !== undefined) {
														this.appFormsSvc.hideLoadingAsync().then(() => onCompleted(message));
													}
													else {
														AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
															await this.configSvc.getResourceAsync("portals.common.excel.message.import"),
															undefined,
															await this.configSvc.getResourceAsync("common.buttons.close")
														));
													}
													break;
												case "Error":
													if (this.configSvc.isDebug) {
														console.error(`[Portals]: Error occurred while importing objects from Excel - Process ID: ${processID}`, message);
													}
													AppAPIs.unregisterProcessor(processID, this.name, "Excel");
													if (onError !== undefined) {
														this.appFormsSvc.hideLoadingAsync().then(() => onError(message.Data));
													}
													else {
														this.appFormsSvc.showErrorAsync(message.Data);
													}
													break;
												default:
													if (this.configSvc.isDebug) {
														console.log(`[Portals]: Importing - Process ID: ${processID} - ${message.Data.Percentage}`);
													}
													if (onProgress !== undefined) {
														onProgress(message.Data.Percentage);
													}
													break;
											}
										},
										processID
									);
								}
								else {
									this.appFormsSvc.hideLoadingAsync();
								}
							},
							error => {
								if (onError !== undefined) {
									this.appFormsSvc.hideLoadingAsync().then(() => onError(error));
								}
								else {
									this.appFormsSvc.showErrorAsync(error);
								}
							}
						);
					}
				}
			}
		);
	}

	async clearCacheAsync(objectName: string, objectID: string, onSuccess?: () => void, requireUserInteraction: boolean = true, useXHR: boolean = false) {
		if (requireUserInteraction) {
			await this.appFormsSvc.showAlertAsync(
				"Cache",
				await this.configSvc.getResourceAsync("portals.common.cache.confirm"),
				undefined,
				async () => {
					await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.common.cache.title"));
					await this.readAsync(
						this.getPath("caches", objectName, "object-id=" + objectID),
						async _ => {
							await this.appFormsSvc.showAlertAsync("Cache", await this.configSvc.getResourceAsync("portals.common.cache.done"));
							if (onSuccess !== undefined) {
								onSuccess();
							}
						},
						async error => await this.appFormsSvc.showErrorAsync(error),
						undefined,
						useXHR
					);
				},
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
		else {
			await this.readAsync(
				this.getPath("caches", objectName, "object-id=" + objectID),
				_ => {
					if (onSuccess !== undefined) {
						onSuccess();
					}
				},
				undefined,
				undefined,
				useXHR
			);
		}
	}

	findVersions(objectName: string, objectID: string) {
		this.versions.push({ name: objectName, id: objectID });
		if (this.findVersionsAsync === undefined) {
			this.findVersionsAsync = async () => {
				const info = this.versions.first();
				if (this.configSvc.isDebug) {
					console.log(`[Versions]: ${info.name}#${info.id} [${this.versions.length}/${AppAPIs.isWebSocketReady}]`);
				}
				await this.readAsync(this.getPath("versions", info.name, "object-id=" + info.id), _ => this.findNextVersions(), _ => this.findNextVersions(), AppAPIs.isWebSocketReady ? undefined : { "x-update-messagae": "false" });
			};
			AppUtility.invoke(() => this.findVersionsAsync(), 567, true);
		}
	}

	private findNextVersions() {
		this.versions.removeAt(0);
		if (this.versions.length < 1) {
			this.findVersionsAsync = undefined;
			if (this.configSvc.isDebug) {
				console.log("[Versions]: No queued");
			}
		}
		else {
			AppUtility.invoke(() => this.findVersionsAsync(), 567, true);
		}
	}

	rollbackAsync(objectName: string, objectID: string, versionID: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.sendRequestAsync(
			{
				Path: this.getPath(objectName, objectID),
				Verb: "PATCH",
				Header: {
					"x-patch-mode": "rollback",
					"x-version-id": versionID
				}
			},
			data => {
				this.findVersions(objectName, objectID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while rolling back", error, onError),
			useXHR
		);
	}

	findTrashContentsAsync(request: AppDataRequest, systemID?: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(this.getSearchingPath("trash", this.configSvc.relatedQuery), request, onSuccess, onError, true, { "x-system-id": systemID });
	}

	restoreAsync(objectID: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.sendRequestAsync(
			{
				Path: this.getPath("trash", objectID),
				Verb: "PATCH",
				Header: {
					"x-patch-mode": "restore"
				}
			},
			onSuccess,
			error => this.processError("Error occurred while restoring", error, onError),
			useXHR
		);
	}

	approveAsync(entityInfo: string, id: string, status: string, title: string, message: string, onNext?: () => void) {
		const contentType = ContentType.get(entityInfo);
		return this.readAsync(
			this.getPath("approve", id),
			() => {
				if (contentType !== undefined) {
					TrackingUtility.trackAsync({ title: title, category: contentType.contentTypeDefinition.ObjectName, action: "Approve" });
				}
				this.appFormsSvc.showAlertAsync(title, message);
				if (onNext !== undefined) {
					onNext();
				}
			},
			error => AppUtility.invoke(contentType !== undefined ? () => TrackingUtility.trackAsync({ title: title, category: contentType.contentTypeDefinition.ObjectName, action: "Approve" }) : undefined).then(() => this.appFormsSvc.showErrorAsync(error)),
			{
				"x-entity": entityInfo,
				"x-status": status
			}
		);
	}

	async showApprovalDialogAsync(entityInfo: string, id: string, currentStatus: string, availableStatuses: string[], statuses?: Array<{ label: string; value: string }>, options?: { title?: string; pending?: string; message?: string }, onNext?: () => void) {
		const title = options !== undefined && AppUtility.isNotEmpty(options.title)
			? await this.appFormsSvc.normalizeResourceAsync(options.title)
			: await this.configSvc.getResourceAsync("common.buttons.moderate");
		if (statuses === undefined) {
			statuses = availableStatuses.map(status => ({ label: "{{portals.common.approval." + status + "}}", value: status }));
		}
		await Promise.all(statuses.map(async status => status.label = await this.appFormsSvc.normalizeResourceAsync(status.label)));
		if (currentStatus !== "Pending" && statuses.findIndex(status => status.value === "Published") > 0) {
			statuses.find(status => status.value === "Pending").label = options !== undefined && AppUtility.isNotEmpty(options.pending)
				? await this.appFormsSvc.normalizeResourceAsync(options.pending)
				: await this.configSvc.getResourceAsync("portals.common.approval.Pending2");
		}
		await this.appFormsSvc.showAlertAsync(
			title,
			undefined,
			await this.configSvc.getResourceAsync("portals.common.approval.label", { status: await this.configSvc.getResourceAsync(`status.approval.${currentStatus}`) }),
			status => this.appFormsSvc.showLoadingAsync(title).then(async () => this.approveAsync(entityInfo, id, status, title, options !== undefined && AppUtility.isNotEmpty(options.message) ? await this.appFormsSvc.normalizeResourceAsync(options.message, { status: statuses.find(s => s.value === status).label }) : await this.configSvc.getResourceAsync("portals.common.approval.message", { status: statuses.find(s => s.value === status).label }), () => AppUtility.invoke(onNext))),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			statuses.map(status => ({
				type: "radio",
				label: status.label,
				value: status.value,
				checked: status.value === currentStatus
			}))
		);
	}

	async moveAsync(objectName: string, objectID: string, resources: { firstConfirm: string; lastConfirm: string; explanation: string; noData: string; invalidData: string; done: string; }, validate: (data: any, previousData?: any) => boolean, inputs: any[], getHeaders: (data: any) => { [key: string]: string }, useXHR: boolean = false) {
		const move = await this.configSvc.getResourceAsync("common.buttons.move");
		const cancel = await this.configSvc.getResourceAsync("common.buttons.cancel");
		await this.appFormsSvc.showAlertAsync(
			move,
			resources.firstConfirm,
			resources.explanation,
			firstData => validate(firstData)
				? this.appFormsSvc.showAlertAsync(
					move,
					resources.lastConfirm,
					resources.explanation,
					lastData => {
						if (validate(lastData, firstData)) {
							this.appFormsSvc.showLoadingAsync(move).then(() => this.readAsync(
								this.getPath("move", objectName, "object-id=" + objectID),
								async () => await this.appFormsSvc.showAlertAsync(move, resources.done),
								async error => await this.appFormsSvc.showErrorAsync(error),
								getHeaders(lastData),
								useXHR
							));
						}
						else {
							this.appFormsSvc.showAlertAsync(move, resources.invalidData);
						}
					},
					move,
					cancel,
					inputs
				)
			: this.appFormsSvc.showAlertAsync(move, resources.noData),
			move,
			cancel,
			inputs
		);
	}

	get organizationCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("organization", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Organization.contains(obj.ID) ? convertToCompleterItem(Organization.get(obj.ID)) : convertToCompleterItem(Organization.update(Organization.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchOrganizations(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("organization", this.configSvc.relatedQuery),
			request,
			data => this.processOrganizations(data, onSuccess),
			error => this.processError("Error occurred while searching organizations", error, onError)
		);
	}

	searchOrganizationsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, relatedQuery?: string) {
		return this.searchAsync(
			this.getSearchingPath("organization", relatedQuery || this.configSvc.relatedQuery),
			request,
			data => this.processOrganizations(data, onSuccess),
			error => this.processError("Error occurred while searching organizations", error, onError)
		);
	}

	private fetchOrganizationsAsync(pagination?: AppDataPagination) {
		return this.searchAsync(
			this.getSearchingPath("organization", this.configSvc.relatedQuery + "&x-fetch=ngx-apps"),
			AppPagination.buildRequest(undefined, undefined, pagination),
			data => {
				const ids = new Array<string>();
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					(data.Objects as Array<any>).filter(org => !Organization.contains(org.ID)).forEach(org => {
						Organization.set(Organization.deserialize(org));
						ids.push(org.ID);
					});
				}
				const pagination = AppPagination.getDefault(data);
				if (pagination.PageNumber < pagination.TotalPages) {
					AppUtility.invoke(() => this.fetchOrganizationsAsync(pagination), 123);
				}
				AppUtility.invoke(() => ids.forEach(id => this.getOrganizationAsync(id)), 456);
			},
			error => this.processError("Error occurred while fetching organizations", error),
			true
		);
	}

	createOrganizationAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("organization"),
			body,
			data => {
				Organization.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating new an organization", error, onError)
		);
	}

	getOrganizationAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false, processModules: boolean = true) {
		return Organization.contains(id) && Organization.get(id).modules.length > 0
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("organization", id),
					data => this.processOrganizations({ Objects: [data] }, onSuccess, processModules),
					error => this.processError("Error occurred while getting an organization", error, onError),
					undefined,
					useXHR
				);
	}

	getOrganization(id: string, getActiveOrganizationWhenNotFound: boolean = true) {
		const organization = Organization.get(id);
		if (organization !== undefined && organization.modules.length < 1) {
			this.getOrganizationAsync(organization.ID);
		}
		return organization || (getActiveOrganizationWhenNotFound ? this.activeOrganization : undefined);
	}

	updateOrganizationAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("organization", body.ID),
			body,
			data => this.processOrganizations({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating an organization", error, onError)
		);
	}

	deleteOrganizationAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("organization", id),
			data => {
				Organization.instances.remove(id);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting an organization", error, onError)
		);
	}

	refreshOrganizationAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.refreshAsync(
			"organization",
			id,
			data => this.processOrganizations({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	processOrganizations(data: any, onNext?: (data?: any) => void, processModules: boolean = true) {
		if (data !== undefined && AppUtility.isGotData(data.Objects)) {
			(data.Objects as Array<any>).forEach(org => {
				const organization = Organization.update(org);
				if (organization.Versions === undefined) {
					this.findVersions("Organization", organization.ID);
				}
				if (processModules) {
					this.processModules({ Objects: org.Modules });
				}
			});
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processOrganizationUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					Organization.update(message.Data);
				}
				else if (Organization.contains(message.Data.ID)) {
					Organization.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Organization.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of an organization", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Organization", Type: `${message.Type.Event}d`, ID: message.Data.ID });
		}
	}

	get roleCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("role", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
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

	searchRoles(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("role", this.configSvc.relatedQuery),
			request,
			data => this.processRoles(data, onSuccess),
			error => this.processError("Error occurred while searching roles", error, onError)
		);
	}

	searchRolesAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("role", this.configSvc.relatedQuery),
			request,
			data => this.processRoles(data, onSuccess),
			error => this.processError("Error occurred while searching roles", error, onError)
		);
	}

	createRoleAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("role"),
			body,
			data => {
				this.updateRole(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating new a role", error, onError)
		);
	}

	getRoleAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const role = Role.get(id);
		return role !== undefined && role.childrenIDs !== undefined
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("role", id),
					data => this.processRoles({ Objects: [data] }, onSuccess),
					error => this.processError("Error occurred while getting a role", error, onError),
					undefined,
					useXHR
				);
	}

	updateRoleAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const parentID = Role.contains(body.ID) ? Role.get(body.ID).ParentID : undefined;
		return this.updateAsync(
			this.getPath("role", body.ID),
			body,
			data => {
				const role = this.updateRole(data, parentID);
				if (role.Versions === undefined) {
					this.findVersions("Role", role.ID);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a role", error, onError)
		);
	}

	deleteRoleAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Role.contains(id) ? Role.get(id).ParentID : undefined;
		return this.deleteAsync(
			this.getPath("role", id),
			data => {
				this.deleteRole(data.ID, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a role", error, onError),
			headers
		);
	}

	refreshRoleAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.refreshAsync(
			"role",
			id,
			data => {
				const role = this.updateRole(data);
				if (role.Versions === undefined) {
					this.findVersions("Role", role.ID);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			useXHR
		);
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
			const role = Role.update(json);
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

	private processRoles(data: any, onSuccess?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isGotData(data.Objects)) {
			(data.Objects as Array<any>).forEach(roleData => {
				const fetch = !Role.contains(roleData.ID);
				const role = this.updateRole(roleData, roleData.ParentID);
				if (role.Versions === undefined) {
					this.findVersions("Role", role.ID);
				}
				if (fetch) {
					this.fetchRole(role);
				}
				else if (role.childrenIDs === undefined) {
					this.fetchRole(role);
				}
			});
		}
		if (onSuccess !== undefined) {
			onSuccess(data);
		}
	}

	private processRoleUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					this.updateRole(message.Data);
				}
				else if (Role.contains(message.Data.ID)) {
					Role.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				this.deleteRole(message.Data.ID, message.Data.ParentID);
				break;
			default:
				this.showLog("Got an update message of a role", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Role", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined, SystemID: message.Data.SystemID });
			if (AppUtility.isNotEmpty(message.Data.ParentID)) {
				AppEvents.broadcast(this.name, { Object: "Role", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined, SystemID: message.Data.SystemID });
			}
		}
	}

	get moduleCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("module", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Module.contains(obj.ID) ? convertToCompleterItem(Module.get(obj.ID)) : convertToCompleterItem(Module.update(Module.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchModules(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("module", this.configSvc.relatedQuery),
			request,
			data => this.processModules(data, onSuccess),
			error => this.processError("Error occurred while searching modules", error, onError)
		);
	}

	searchModulesAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination?: boolean, useXHR: boolean = false, headers?: { [header: string]: string }) {
		return this.searchAsync(
			this.getSearchingPath("module", this.configSvc.relatedQuery),
			request,
			data => this.processModules(data, onSuccess),
			error => this.processError("Error occurred while searching modules", error, onError),
			dontProcessPagination,
			headers,
			useXHR
		);
	}

	createModuleAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("module"),
			body,
			data => this.processModules({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while creating new a module", error, onError)
		);
	}

	getModule(id: string, getActiveModuleWhenNotFound: boolean = true) {
		const module = Module.get(id) || (getActiveModuleWhenNotFound ? this.activeModule : undefined);
		if (module === undefined && AppUtility.isNotEmpty(id)) {
			this.getModuleAsync(id);
		}
		return module;
	}

	getModuleAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Module.contains(id) && Module.get(id).contentTypes.length > 0
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("module", id),
					data => this.processModules({ Objects: [data] }, onSuccess),
					error => this.processError("Error occurred while getting a module", error, onError),
					undefined,
					useXHR
				);
	}

	updateModuleAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("module", body.ID),
			body,
			data => this.processModules({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating a module", error, onError)
		);
	}

	deleteModuleAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("module", id),
			data => {
				Module.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a module", error, onError)
		);
	}

	refreshModuleAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.refreshAsync(
			"module",
			id,
			data => this.processModules({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	private processModules(data: any, onNext?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isGotData(data.Objects)) {
			(data.Objects as Array<any>).forEach(moduleData => {
				const module = Module.update(moduleData);
				if (module.Versions === undefined) {
					this.findVersions("Module", module.ID);
				}
				this.processContentTypes({ Objects: moduleData.ContentTypes });
			});
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processModuleUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					Module.update(message.Data);
				}
				else if (Module.contains(message.Data.ID)) {
					Module.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Module.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a module", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Module", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID });
		}
	}

	get contentTypeCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("content.type", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => ContentType.contains(obj.ID) ? convertToCompleterItem(ContentType.get(obj.ID)) : convertToCompleterItem(ContentType.update(ContentType.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchContentTypes(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("content.type", this.configSvc.relatedQuery),
			request,
			data => this.processContentTypes(data, onSuccess),
			error => this.processError("Error occurred while searching content-types", error, onError)
		);
	}

	searchContentTypesAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("content.type", this.configSvc.relatedQuery),
			request,
			data => this.processContentTypes(data, onSuccess),
			error => this.processError("Error occurred while searching content-types", error, onError),
			false,
			undefined,
			useXHR
		);
	}

	createContentTypeAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("content.type"),
			body,
			data => this.processContentTypes({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while creating new a content type", error, onError)
		);
	}

	getContentTypeAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return ContentType.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("content.type", id),
					data => this.processContentTypes({ Objects: [data] }, onSuccess),
					error => this.processError("Error occurred while getting a content type", error, onError),
					undefined,
					useXHR
				);
	}

	updateContentTypeAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("content.type", body.ID),
			body,
			data => this.processContentTypes({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating a content type", error, onError)
		);
	}

	deleteContentTypeAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("content.type", id),
			data => {
				ContentType.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a content type", error, onError)
		);
	}

	refreshContentTypeAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.refreshAsync(
			"content.type",
			id,
			data => this.processContentTypes({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	private processContentTypes(data: any, onNext?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isGotData(data.Objects)) {
			(data.Objects as Array<any>).forEach(contentTypeData => {
				const contentType = ContentType.update(contentTypeData);
				if (contentType.Versions === undefined) {
					this.findVersions("ContentType", contentType.ID);
				}
			});
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processContentTypeUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					const contentType = ContentType.update(message.Data);
					if (contentType !== undefined) {
						this.configSvc.removeDefinition(this.name, contentType.getObjectName(true), undefined, { "x-content-type-id": contentType.ID });
					}
				}
				else if (ContentType.contains(message.Data.ID)) {
					ContentType.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				if (ContentType.contains(message.Data.ID)) {
					ContentType.instances.remove(message.Data.ID);
				}
				break;
			default:
				this.showLog("Got an update message of a content type", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Content.Type", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID });
		}
	}

	get expressionCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("expression", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Expression.contains(obj.ID) ? convertToCompleterItem(Expression.get(obj.ID)) : convertToCompleterItem(Expression.update(Expression.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchExpressions(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("expression", this.configSvc.relatedQuery),
			request,
			data => this.processExpressions(data, onSuccess),
			error => this.processError("Error occurred while searching expressions", error, onError)
		);
	}

	searchExpressionsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("expression", this.configSvc.relatedQuery),
			request,
			data => this.processExpressions(data, onSuccess),
			error => this.processError("Error occurred while searching expressions", error, onError)
		);
	}

	createExpressionAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("expression"),
			body,
			data => this.processExpressions({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while creating new an expression", error, onError)
		);
	}

	getExpressionAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Expression.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("expression", id),
					data => this.processExpressions({ Objects: [data] }, onSuccess),
					error => this.processError("Error occurred while getting an expression", error, onError),
					undefined,
					useXHR
				);
	}

	updateExpressionAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("expression", body.ID),
			body,
			data => this.processExpressions({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating an expression", error, onError)
		);
	}

	deleteExpressionAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("expression", id),
			data => {
				Expression.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting an expression", error, onError)
		);
	}

	refreshExpressionAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.refreshAsync(
			"expression",
			id,
			data => this.processExpressions({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	private processExpressions(data: any, onSuccess?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
			(data.Objects as Array<any>).forEach(expData => {
				const expression = Expression.update(expData);
				if (expression.Versions === undefined) {
					this.findVersions("Expression", expression.ID);
				}
			});
		}
		if (onSuccess !== undefined) {
			onSuccess(data);
		}
	}

	private processExpressionUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					Expression.update(message.Data);
				}
				else if (Expression.contains(message.Data.ID)) {
					Expression.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				if (Expression.contains(message.Data.ID)) {
					Expression.instances.remove(message.Data.ID);
				}
				break;
			default:
				this.showLog("Got an update message of an expression", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Content.Type", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID });
		}
	}

	get siteCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("site", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Site.contains(obj.ID) ? convertToCompleterItem(Site.get(obj.ID)) : convertToCompleterItem(Site.update(Site.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchSites(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("site", this.configSvc.relatedQuery),
			request,
			data => this.processSites(data, onSuccess),
			error => this.processError("Error occurred while searching sites", error, onError)
		);
	}

	searchSitesAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("site", this.configSvc.relatedQuery),
			request,
			data => this.processSites(data, onSuccess),
			error => this.processError("Error occurred while searching sites", error, onError),
			dontProcessPagination,
			undefined,
			useXHR
		);
	}

	createSiteAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("site"),
			body,
			data => this.processSites({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while creating new a site", error, onError)
		);
	}

	getSiteAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Site.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("site", id),
					data => this.processSites({ Objects: [data] }, onSuccess),
					error => this.processError("Error occurred while getting a site", error, onError),
					undefined,
					useXHR
				);
	}

	updateSiteAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("site", body.ID),
			body,
			data => this.processSites({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating a site", error, onError)
		);
	}

	deleteSiteAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("site", id),
			data => {
				Site.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a site", error, onError)
		);
	}

	refreshSiteAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.refreshAsync(
			"site",
			id,
			data => this.processSites({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	processSites(data: any, onNext?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
			(data.Objects as Array<any>).forEach(siteData => {
				const site = Site.update(siteData);
				if (site.Versions === undefined) {
					this.findVersions("Site", site.ID);
				}
			});
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processSiteUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					Site.update(message.Data);
				}
				else if (Site.contains(message.Data.ID)) {
					Site.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Site.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a site", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Site", Type: `${message.Type.Event}d`, ID: message.Data.ID });
		}
	}

	get desktopCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("desktop", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
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

	searchDesktops(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("desktop", this.configSvc.relatedQuery),
			request,
			data => this.processDesktops(data, onSuccess),
			error => this.processError("Error occurred while searching desktops", error, onError)
		);
	}

	searchDesktopsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("desktop", this.configSvc.relatedQuery),
			request,
			data => this.processDesktops(data, onSuccess),
			error => this.processError("Error occurred while searching desktops", error, onError),
			dontProcessPagination,
			headers,
			useXHR
		);
	}

	createDesktopAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("desktop"),
			body,
			data => {
				this.updateDesktop(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating new a desktop", error, onError)
		);
	}

	getDesktopAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const desktop = Desktop.get(id);
		return desktop !== undefined && desktop.childrenIDs !== undefined
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("desktop", id),
					data => {
						this.updateDesktop(data);
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while getting a desktop", error, onError),
					undefined,
					useXHR
				);
	}

	updateDesktopAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Desktop.contains(body.ID) ? Desktop.get(body.ID).ParentID : undefined;
		return this.updateAsync(
			this.getPath("desktop", body.ID),
			body,
			data => {
				this.updateDesktop(data, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a desktop", error, onError),
			headers
		);
	}

	deleteDesktopAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Desktop.contains(id) ? Desktop.get(id).ParentID : undefined;
		return this.deleteAsync(
			this.getPath("desktop", id),
			data => {
				this.deleteDesktop(data.ID, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a desktop", error, onError),
			headers
		);
	}

	refreshDesktopAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.refreshAsync(
			"desktop",
			id,
			data => {
				this.updateDesktop(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			useXHR
		);
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

	fetchDesktops(systemID?: string, onSuccess?: () => void) {
		this.searchDesktopsAsync({
			FilterBy: {
				And: [
					{ SystemID: { Equals: systemID ?? this.activeOrganization.ID } },
					{ ParentID: "IsNull" }
				]
			},
			SortBy: { Title: "Ascending" }
		}, onSuccess, undefined, true, undefined, true);
	}

	private updateDesktop(json: any, oldParentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const desktop = Desktop.update(json);
			if (desktop.Versions === undefined) {
				this.findVersions("Desktop", desktop.ID);
			}
			if (AppUtility.isArray(json.Portlets, true)) {
				desktop.portlets = (json.Portlets as Array<any>).map(p => Portlet.update(p));
			}
			if (AppUtility.isArray(json.Children, true)) {
				desktop.childrenIDs = (json.Children as Array<any>).map(o => this.updateDesktop(o)).filter(o => o !== undefined).map(o => o.ID).distinct();
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

	private processDesktops(data: any, onNext?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isGotData(data.Objects)) {
			(data.Objects as Array<any>).forEach(json => {
				const fetch = !Desktop.contains(json.ID);
				const desktop = Desktop.update(json);
				if (desktop.Versions === undefined) {
					this.findVersions("Desktop", desktop.ID);
				}
				if (fetch || desktop.childrenIDs === undefined) {
					this.fetchDesktop(desktop);
				}
			});
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processDesktopUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					this.updateDesktop(message.Data);
				}
				else if (Desktop.contains(message.Data.ID)) {
					Desktop.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				this.deleteDesktop(message.Data.ID, message.Data.ParentID);
				break;
			default:
				this.showLog("Got an update message of a desktop", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Desktop", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined, SystemID: message.Data.SystemID });
			if (AppUtility.isNotEmpty(message.Data.ParentID)) {
				AppEvents.broadcast(this.name, { Object: "Desktop", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined, SystemID: message.Data.SystemID });
			}
		}
	}

	get portletCompleterDataSource() {
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
			term => AppUtility.format(this.getSearchingPath("portlet", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => Portlet.contains(obj.ID) ? convertToCompleterItem(Portlet.get(obj.ID)) : convertToCompleterItem(Portlet.update(Portlet.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchPortlets(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("portlet", this.configSvc.relatedQuery),
			request,
			data => this.processPortlets(data, onSuccess),
			error => this.processError("Error occurred while searching portlets", error, onError)
		);
	}

	searchPortletsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination?: boolean, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("portlet", this.configSvc.relatedQuery),
			request,
			data => this.processPortlets(data, onSuccess),
			error => this.processError("Error occurred while searching portlets", error, onError),
			dontProcessPagination,
			undefined,
			useXHR
		);
	}

	createPortletAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("portlet"),
			body,
			data => this.processPortlets({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while creating new a portlet", error, onError)
		);
	}

	getPortletAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Portlet.contains(id) && Portlet.get(id).otherDesktops !== undefined
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("portlet", id),
					data => this.processPortlets({ Objects: [data] }, onSuccess),
					error => this.processError("Error occurred while getting a portlet", error, onError),
					undefined,
					useXHR
				);
	}

	updatePortletAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.updateAsync(
			this.getPath("portlet", body.ID),
			body,
			data => this.processPortlets({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating a portlet", error, onError),
			headers,
			useXHR
		);
	}

	deletePortletAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("portlet", id),
			data => this.processPortlets({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while deleting a portlet", error, onError)
		);
	}

	refreshPortletAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.refreshAsync(
			"portlet",
			id,
			data => this.processPortlets({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	private processPortlets(data: any, onNext?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
			(data.Objects as Array<any>).forEach(json => {
				const portlet =  Portlet.update(json);
				if (portlet.Versions === undefined) {
					this.findVersions("Portlet", portlet.ID);
				}
			});
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processPortletUpdateMessage(message: AppMessage) {
		let desktop: Desktop;
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					const portlet = Portlet.update(message.Data);
					desktop = Desktop.get(message.Data.DesktopID);
					if (desktop !== undefined && desktop.portlets !== undefined) {
						desktop.portlets.update(portlet, desktop.portlets.findIndex(p => p.ID === portlet.ID));
					}
				}
				else if (Portlet.contains(message.Data.ID)) {
					Portlet.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Portlet.instances.remove(message.Data.ID);
				desktop = Desktop.get(message.Data.DesktopID);
				if (desktop !== undefined && desktop.portlets !== undefined) {
					desktop.portlets.removeAt(desktop.portlets.findIndex(p => p.ID === message.Data.ID));
				}
				break;
			default:
				this.showLog(`Got an update message of a portlet - Portlet ID: ${message.Data.ID} - Desktop ID: ${message.Data.DesktopID}`, message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "Portlet", Type: `${message.Type.Event}d`, ID: message.Data.ID, DesktopID: message.Data.DesktopID, SystemID: message.Data.SystemID });
		}
	}

	get schedulingTaskCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const task = data !== undefined
				? data instanceof SchedulingTask
					? data as SchedulingTask
					: SchedulingTask.deserialize(data)
				: undefined;
			return task !== undefined
				? { title: task.Title, description: task.Description, originalObject: task }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("task", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => SchedulingTask.contains(obj.ID) ? convertToCompleterItem(SchedulingTask.get(obj.ID)) : convertToCompleterItem(SchedulingTask.update(SchedulingTask.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	searchSchedulingTasks(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("task", this.configSvc.relatedQuery),
			request,
			data => this.processSchedulingTasks(data, onSuccess),
			error => this.processError("Error occurred while searching tasks", error, onError)
		);
	}

	searchSchedulingTasksAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination?: boolean, useXHR: boolean = false, headers?: { [header: string]: string }) {
		return this.searchAsync(
			this.getSearchingPath("task", this.configSvc.relatedQuery),
			request,
			data => this.processSchedulingTasks(data, onSuccess),
			error => this.processError("Error occurred while searching tasks", error, onError),
			dontProcessPagination,
			headers,
			useXHR
		);
	}

	createSchedulingTaskAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("task"),
			body,
			data => this.processSchedulingTasks({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while creating new a task", error, onError)
		);
	}

	getSchedulingTask(id: string) {
		const task = SchedulingTask.get(id);
		if (task === undefined && AppUtility.isNotEmpty(id)) {
			this.getSchedulingTaskAsync(id);
		}
		return task;
	}

	getSchedulingTaskAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return SchedulingTask.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
				this.getPath("task", id),
				data => this.processSchedulingTasks({ Objects: [data] }, onSuccess),
				error => this.processError("Error occurred while getting a task", error, onError),
				undefined,
				useXHR
			);
	}

	updateSchedulingTaskAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("task", body.ID),
			body,
			data => this.processSchedulingTasks({ Objects: [data] }, onSuccess),
			error => this.processError("Error occurred while updating a task", error, onError)
		);
	}

	deleteSchedulingTaskAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("task", id),
			data => {
				SchedulingTask.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a task", error, onError)
		);
	}

	fetchSchedulingTasks() {
		AppUtility.invoke(() => this.readAsync(this.getPath("task", "fetch"), data => this.processSchedulingTasks(data), error => this.showError("Error occurred while fetching tasks", error), { "x-system-id": this.activeOrganization.ID, "x-update-messagae": AppAPIs.isWebSocketReady.toString() }), 1234, true);
	}

	runSchedulingTaskAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.readAsync(
			this.getPath("task", "run", "x-object-id=" + id),
			onSuccess,
			error => this.processError("Error occurred while running a scheduling task", error, onError),
			{ "x-system-id": this.activeOrganization.ID },
			useXHR
		);
	}

	refreshSchedulingTaskAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.refreshAsync(
			"task",
			id,
			data => this.processSchedulingTasks({ Objects: [data] }, onSuccess),
			onError,
			headers,
			useXHR
		);
	}

	private processSchedulingTasks(data: any, onNext?: (data?: any) => void) {
		if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
			(data.Objects as Array<any>).forEach(json => {
				const task = SchedulingTask.update(json);
				if (task !== undefined && task.Persistance && task.Versions === undefined) {
					this.findVersions("Task", task.ID);
				}
			});
		}		
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	private processSchedulingTaskUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.Title) {
					const task = SchedulingTask.update(message.Data);
					if (task !== undefined && task.Persistance && task.Versions === undefined) {
						this.findVersions("Task", task.ID);
					}
				}
				else if (SchedulingTask.contains(message.Data.ID)) {
					SchedulingTask.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				SchedulingTask.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a task", message);
				break;
		}
		if (!!message.Data.Title && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "SchedulingTask", Type: `${message.Type.Event}d`, ID: message.Data.ID });
		}
	}

}
