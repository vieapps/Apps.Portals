import { Injectable } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { Dictionary, HashSet } from "@app/components/app.collections";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppPagination  } from "@app/components/app.pagination";
import { AppSidebar, AppSidebarMenuItem, AppMessage, AppDataRequest } from "@app/components/app.objects";
import { AppFormsControlConfig, AppFormsControlLookupOptionsConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService, FileOptions } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { Account } from "@app/models/account";
import { AttachmentInfo } from "@app/models/base";
import { PortalBase as BaseModel, Organization, Role, Module, ContentType, Expression, Site, Desktop, Portlet, SchedulingTask } from "@app/models/portals.core.all";
import { PortalCmsBase as CmsBaseModel, Category, Content, Item, Link, Form, Crawler } from "@app/models/portals.cms.all";

@Injectable()
export class PortalsCmsService extends BaseService {

	constructor(
		private domSanitizer: DomSanitizer,
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private filesSvc: FilesService,
		private portalsCoreSvc: PortalsCoreService
	) {
		super("Portals");
	}

	private _oembedProviders: Array<{ name: string; schemes: RegExp[], pattern: { expression: RegExp; position: number; html: string } }>;
	private _sidebarCategory: Category;
	private _sidebarContentType: ContentType;
	private _noContents = new HashSet<string>();
	private _featuredContents = new Dictionary<string, Array<CmsBaseModel>>();

	get featuredContents() {
		const organization = this.portalsCoreSvc.activeOrganization;
		return organization !== undefined ? this._featuredContents.get(organization.ID) || [] : [];
	}

	initialize() {
		AppAPIs.registerAsServiceScopeProcessor(this.name, message => {
			if (message.Data !== undefined && message.Data.SystemID !== undefined && this.portalsCoreSvc.activeOrganizations.indexOf(message.Data.SystemID) > -1) {
				switch (message.Type.Object) {
					case "Category":
					case "CMS.Category":
					case "Cms.Category":
						this.processCategoryUpdateMessage(message);
						break;
					case "Content":
					case "CMS.Content":
					case "Cms.Content":
						this.processContentUpdateMessage(message);
						break;
					case "Item":
					case "CMS.Item":
					case "Cms.Item":
						this.processItemUpdateMessage(message);
						break;
					case "Link":
					case "CMS.Link":
					case "Cms.Link":
						this.processLinkUpdateMessage(message);
						break;
					case "Form":
					case "CMS.Form":
					case "Cms.Form":
						this.processFormUpdateMessage(message);
						break;
					case "Crawler":
					case "CMS.Crawler":
					case "Cms.Crawler":
						this.processCrawlerUpdateMessage(message);
						break;
					case "ContentType":
					case "Content.Type":
					case "Core.ContentType":
					case "Core.Content.Type":
						this.processContentTypeUpdateMessage(message);
						break;
				}
			}
		});

		AppAPIs.registerAsServiceScopeProcessor(this.filesSvc.name, message => this.processAttachmentUpdateMessage(message));

		AppEvents.on(this.name, info => {
			const organization = this.portalsCoreSvc.activeOrganization;
			if (organization !== undefined) {
				const args = info.args;
				if ("UpdateSidebar" === args.Type) {
					if ("ContentTypes" === args.Mode) {
						this._sidebarCategory = undefined;
						this._sidebarContentType = undefined;
						this.updateSidebarWithContentTypesAsync();
					}
					else if ("Categories" === args.Mode) {
						if (AppUtility.isNotEmpty(args.ContentTypeID)) {
							if (this._sidebarContentType === undefined || this._sidebarContentType.ID !== args.ContentTypeID) {
								this._sidebarContentType = ContentType.get(args.ContentTypeID);
								if (this._sidebarContentType !== undefined) {
									this.updateSidebarWithCategoriesAsync();
								}
							}
						}
						else if (this._sidebarContentType === undefined) {
							this.updateSidebarWithCategoriesAsync();
						}
					}
				}
				else if ("Changed" === args.Mode && ("Organization" === args.Type || "Module" === args.Type)) {
					this._sidebarCategory = undefined;
					this._sidebarContentType = undefined;
					this.updateSidebarAsync();
				}
				else if ("FeaturedContents" === args.Type) {
					if ("Request" === args.Mode && !this._noContents.contains(organization.ID)) {
						if (organization.modules.flatMap(module => module.contentTypes).length > 0) {
							this._noContents.add(organization.ID);
							this.prepareFeaturedContentsAsync();
						}
					}
					else if ("Refresh" === args.Mode) {
						AppUtility.invoke(() => this.prepareFeaturedContents(organization.ID), 123, true);
					}
				}
				else if (organization.ID === args.SystemID && ("CMS.Content" === args.Object || "CMS.Item" === args.Object || "CMS.Form" === args.Object) && ("Created" === args.Type || "Updated" === args.Type || "Deleted" === args.Type)) {
					AppUtility.invoke(() => this.prepareFeaturedContents(organization.ID), 123, true);
				}
			}
		});

		AppEvents.on("App", info => {
			const args = info.args;
			if ("HomePage" === args.Type && "Open" === args.Mode && "Sidebar" === args.Source && "cms" === args.Active) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				this.updateSidebarAsync();
			}
		});

		AppEvents.on("Session", info => {
			const args = info.args;
			if ("LogIn" === args.Type || "LogOut" === args.Type) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				AppUtility.invoke(() => this.updateSidebarAsync().then("LogIn" === args.Type ? () => this.prepareFeaturedContentsAsync() : () => {}), 123);
			}
		});

		AppEvents.on("Account", info => {
			const args = info.args;
			if ("Updated" === args.Type && "APIs" === args.Mode) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				AppUtility.invoke(() => this.updateSidebarAsync().then(() => this.prepareFeaturedContentsAsync()), 123);
			}
		});

		AppEvents.on("Profile", info => {
			const args = info.args;
			if ("Updated" === args.Type && "APIs" === args.Mode) {
				if (Organization.active !== undefined && this.portalsCoreSvc.activeOrganizations.indexOf(Organization.active.ID) < 0) {
					this._sidebarCategory = undefined;
					this._sidebarContentType = undefined;
					this.portalsCoreSvc.removeActiveOrganization(Organization.active.ID);
					this.updateSidebarAsync().then(() => this.prepareFeaturedContentsAsync());
				}
			}
		});

		AppEvents.on("OpenNotification", async info => {
			const object = (await this.getObjectAsync(info.args.ObjectID, info.args.ObjectName, true)).object;
			if (object !== undefined && AppUtility.isNotEmpty(object.ID)) {
				this.configSvc.navigateForwardAsync(object.routerURI);
			}
		});
	}

	async initializeAsync(onNext?: () => void) {
		const promises = new Array<Promise<any>>();

		if (Module.active === undefined) {
			promises.push(this.portalsCoreSvc.getActiveModuleAsync(undefined, true));
		}

		if (Module.active !== undefined && Module.active.contentTypes.length < 1) {
			promises.push(this.portalsCoreSvc.getActiveModuleAsync(undefined, true));
		}

		if (this.configSvc.appConfig.services.active.service === this.name) {
			promises.push(this.updateSidebarAsync());
		}

		if (this._oembedProviders === undefined) {
			promises.push(AppUtility.invoke(() => this.fetchAsync(
				"statics/oembed.providers.json",
				data => {
					const oembedProviders = data as Array<{ name: string; schemes: string[], pattern: { expression: string; position: number; html: string } }>;
					this._oembedProviders = oembedProviders.map(oembedProvider => ({
						name: oembedProvider.name,
						schemes: oembedProvider.schemes.map(scheme => AppUtility.toRegExp(`/${scheme}/i`)),
						pattern: {
							expression: AppUtility.toRegExp(`/${oembedProvider.pattern.expression}/i`),
							position: oembedProvider.pattern.position,
							html: oembedProvider.pattern.html
						}
					}));
				}
			), 1234));
		}

		await Promise.all(promises);
		if (onNext !== undefined) {
			onNext();
		}
	}

	canManage(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isAdministrator(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	canModerate(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isModerator(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	canEdit(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isEditor(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	canContribute(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isContributor(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	canView(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isViewer(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	normalizeRichHtml(html: string) {
		if (AppUtility.isNotEmpty(html)) {
			// normalize all 'oembed' tags
			let start = AppUtility.indexOf(html, "<oembed");
			while (start > -1) {
				const end = AppUtility.indexOf(html, "</oembed>", start + 1) + 9;
				let oembedMedia = html.substring(start, end);
				const oembedURL = oembedMedia.substring(AppUtility.indexOf(oembedMedia, "url=") + 5, AppUtility.indexOf(oembedMedia, "\"", AppUtility.indexOf(oembedMedia, "url=") + 6));
				const oembedProvider = this._oembedProviders.find(provider => provider.schemes.some(regex => oembedURL.match(regex)));
				if (oembedProvider !== undefined) {
					const match = oembedURL.match(oembedProvider.pattern.expression);
					oembedMedia = AppUtility.format(oembedProvider.pattern.html, { id: match.length > oembedProvider.pattern.position ? match[oembedProvider.pattern.position] : undefined });
				}
				else {
					const tag = oembedURL.endsWith(".mp3") ? "audio" : "video";
					const height = oembedURL.endsWith(".mp3") ? "32" : "315";
					oembedMedia = AppUtility.format(`<${tag} width=\"560\" height=\"${height}\" controls autoplay muted><source src=\"{{url}}\"/></${tag}>`, { url: oembedURL });
				}
				html = html.substring(0, start) + oembedMedia + html.substring(end);
				start = AppUtility.indexOf(html, "<oembed", start + 1);
			}

			// remove 'height' of all IMG tags
			start = AppUtility.indexOf(html, "<img");
			while (start > -1) {
				const end = AppUtility.indexOf(html, ">", start + 1);
				let img = html.substring(start, end + 1);
				if (AppUtility.indexOf(img, "height") > 0) {
					img = img.replace("height=", "data-height=");
					img = img.replace("height:", "data-height:");
				}
				html = html.substring(0, start) + img + html.substring(end + 1);
				start = AppUtility.indexOf(html, "<img", start + 1);
			}

			// add 'target' into all anchors (a tags)
			start = AppUtility.indexOf(html, "<a");
			while (start > -1) {
				const end = AppUtility.indexOf(html, ">", start + 1);
				let anchor = html.substring(start, end + 1);
				if (AppUtility.indexOf(anchor, "target=") < 0) {
					anchor = anchor.substring(0, anchor.length - 1) + " target=\"_blank\">";
					html = html.substring(0, start) + anchor + html.substring(end + 1);
				}
				start = AppUtility.indexOf(html, "<a", start + 1);
			}
		}
		return this.domSanitizer.bypassSecurityTrustHtml(html || "");
	}

	normalizeTempTokens(html: string, tempToken: string, forDisplaying: boolean = true) {
		if (AppUtility.isNotEmpty(html)) {
			if (!forDisplaying) {
				let start = AppUtility.indexOf(html, "x-temp-token=");
				while (start > -1) {
					let end = AppUtility.indexOf(html, "&", start + 1);
					end = end > 0 && end < AppUtility.indexOf(html, ">", start + 1) ? end : AppUtility.indexOf(html, "\"", start + 1);
					html = html.substring(0, start) + "z-temp-token=" + html.substring(end);
					start = AppUtility.indexOf(html, "x-temp-token=", start + 1);
				}
			}
			else if (AppUtility.isNotEmpty(tempToken)) {
				let start = AppUtility.indexOf(html, "x-temp-token=");
				while (start > -1) {
					let end = AppUtility.indexOf(html, "&", start + 1);
					end = end > 0 && end < AppUtility.indexOf(html, ">", start + 1) ? end : AppUtility.indexOf(html, "\"", start + 1);
					html = html.substring(0, start) + "x-temp-token=" + tempToken + html.substring(end);
					start = AppUtility.indexOf(html, "x-temp-token=", start + 1);
				}
				html = html.replace(/z\-temp\-token\=/g, "x-temp-token=" + tempToken);
			}
		}
		return html;
	}

	lookup(objectName: string, request: AppDataRequest, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.lookup(objectName, request, onSuccess, onError, headers);
	}

	lookupAsync(objectName: string, request: AppDataRequest, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.lookupAsync(objectName, request, onSuccess, onError, headers);
	}

	getAsync(objectName: string, id: string, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.getAsync(objectName, id, onSuccess, onError, headers);
	}

	getFileOptions(object: CmsBaseModel, onCompleted?: (fileOptions: FileOptions) => void) {
		const fileOptions: FileOptions = object !== undefined
			?
			{
				ServiceName: this.name,
				ObjectName: object.contentType.getObjectName(false),
				SystemID: object.SystemID,
				RepositoryID: object.RepositoryID,
				RepositoryEntityID: object.RepositoryEntityID,
				ObjectID: object.ID,
				ObjectTitle: object.Title,
				IsShared: false,
				IsTracked: object.organization !== undefined && object.organization.TrackDownloadFiles,
				IsTemporary: AppUtility.isNotEmpty(object.ID) ? false : true,
				Extras: {}
			}
			: undefined;
		if (onCompleted !== undefined) {
			onCompleted(fileOptions);
		}
		return fileOptions;
	}

	getFileHeaders(object: CmsBaseModel, additional?: { [header: string]: string }) {
		return this.filesSvc.getFileHeaders(this.getFileOptions(object), additional);
	}

	getLinkSelector(object: CmsBaseModel, lookupModalPage: any, options?: { [key: string]: any }) {
		options = options || {};
		options.content = options.content || {};
		options.file = options.file || {};
		const linkSelector: { [key: string]: { [key: string]: any } } = {};
		if (lookupModalPage !== undefined) {
			linkSelector.content = {
				label: options.content.label,
				selectLink: async (onSelected: (link: string) => void) => await this.appFormsSvc.showModalAsync(
					lookupModalPage,
					{
						organizationID: object.SystemID,
						moduleID: object.RepositoryID,
						contentTypeID: object.RepositoryEntityID,
						objectName: object.contentType.getObjectName(true),
						multiple: false,
						nested: !!options.content.nested,
						sortBy: options.content.sortBy,
						preProcess: options.content.preProcess
					},
					(objects: CmsBaseModel[]) => {
						const obj = objects !== undefined && objects.length > 0 ? objects[0] : undefined;
						const parent = obj !== undefined ? Category.get(obj["CategoryID"]) : undefined;
						onSelected(obj !== undefined ? this.portalsCoreSvc.getPortalURL(obj, parent) + (object.organization.AlwaysUseHtmlSuffix ? ".html" : "") : undefined);
					}
				)
			};
		}
		if (AppUtility.isNotEmpty(object.ID)) {
			const tempToken = this.authSvc.getTempToken(object.Privileges);
			linkSelector.file = {
				label: options.file.label,
				selectLink: async (onSelected: (link: string) => void) => await this.appFormsSvc.showModalAsync(
					FilesProcessorModalPage,
					{
						mode: "select",
						fileOptions: this.getFileOptions(object),
						allowSelect: true,
						multiple: false,
						handlers: { onSelect: () => {} }
					},
					(attachments: AttachmentInfo[]) => {
						let url = attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined;
						url = url === undefined || tempToken === undefined ? url : url + (url.indexOf("?") > 0 ? "&" : "?") + "x-temp-token=" + tempToken;
						onSelected(url);
					}
				)
			};
		}
		return linkSelector;
	}

	getMediaSelector(object: CmsBaseModel, label?: string) {
		const tempToken = this.authSvc.getTempToken(object.Privileges);
		return AppUtility.isNotEmpty(object.ID)
			? {
				label: label,
				selectMedia: async (onSelected: (link: string, type?: string) => void) => await this.appFormsSvc.showModalAsync(
					FilesProcessorModalPage,
					{
						mode: "select",
						fileOptions: this.getFileOptions(object),
						allowSelect: true,
						multiple: false,
						handlers: { predicate: (attachment: AttachmentInfo) => attachment.isImage || attachment.isVideo || attachment.isAudio, onSelect: () => {} }
					},
					(attachments: AttachmentInfo[]) => {
						let url = attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined;
						url = url === undefined || tempToken === undefined ? url : url + (url.indexOf("?") > 0 ? "&" : "?") + "x-temp-token=" + tempToken;
						onSelected(url);
					}
				)
			}
			: undefined;
	}

	getUploadFormControl(object: CmsBaseModel, segment?: string, label?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		return this.portalsCoreSvc.getUploadFormControl(this.getFileOptions(object), segment, label, onCompleted);
	}

	getPermanentLinkFormControl(object: CmsBaseModel, segment?: string, label?: string, description?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: "PermanentLink",
			Type: "Text",
			Segment: segment || "basic",
			Extras: { Text: this.portalsCoreSvc.getPermanentURL(object) },
			Options: {
				Label: label || "{{portals.cms.common.permanentLink.label}}",
				Description: description || "{{portals.cms.common.permanentLink.description}}",
				Icon: {
					Name: "copy-outline",
					Fill: "clear",
					Color: "medium",
					Slot: "end",
					OnClick: async (_, formControl) => {
						const value = formControl instanceof AppFormsControlComponent ? (formControl as AppFormsControlComponent).text : formControl.value;
						await PlatformUtility.copyToClipboardAsync(value || formControl.value);
						await this.appFormsSvc.showToastAsync("Copied...");
					}
				}
			}
		};
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	getTemporaryLinkFormControl(object: CmsBaseModel, segment?: string, label?: string, description?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: "TempLink",
			Type: "Text",
			Segment: segment || "basic",
			Extras: { Text: this.portalsCoreSvc.getPortalURL(object, object["category"], true) },
			Options: {
				Label: label || "{{portals.cms.common.tempLink.label}}",
				Description: description || "{{portals.cms.common.tempLink.description}}",
				Icon: {
					Name: "globe",
					Fill: "clear",
					Color: "medium",
					Slot: "end",
					OnClick: (_, formControl) => {
						const value = formControl instanceof AppFormsControlComponent ? (formControl as AppFormsControlComponent).text : formControl.value;
						PlatformUtility.openURL(value || formControl.value);
					}
				}
			}
		};
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	getPublicLinkFormControl(object: CmsBaseModel, segment?: string, label?: string, description?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: "PublicLink",
			Type: "Text",
			Segment: segment || "basic",
			Extras: { Text: this.portalsCoreSvc.getPublicURL(object, object["category"]) },
			Options: {
				Label: label || "{{portals.cms.common.publicLink.label}}",
				Description: description || "{{portals.cms.common.publicLink.description}}",
				Icon: {
					Name: "copy-outline",
					Fill: "clear",
					Color: "medium",
					Slot: "end",
					OnClick: async (_, formControl) => {
						const value = formControl instanceof AppFormsControlComponent ? (formControl as AppFormsControlComponent).text : formControl.value;
						await PlatformUtility.copyToClipboardAsync(value || formControl.value);
						await this.appFormsSvc.showToastAsync("Copied...");
					}
				}
			}
		};
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	setLookupOptions(lookupOptions: AppFormsControlLookupOptionsConfig, lookupModalPage: any, contentType: ContentType, multiple?: boolean, nested?: boolean, onCompleted?: (options: AppFormsControlLookupOptionsConfig) => void) {
		this.portalsCoreSvc.setLookupOptions(lookupOptions, lookupModalPage, contentType, multiple, nested, onCompleted);
	}

	private updateSidebar(items?: Array<AppSidebarMenuItem>, parent?: AppSidebarMenuItem, onNext?: () => void) {
		AppEvents.broadcast("UpdateSidebar", {
			name: "cms",
			parent: parent,
			items: items,
			index: this.portalsCoreSvc.menuIndex
		});
		if (onNext !== undefined) {
			onNext();
		}
	}

	private updateSidebarAsync() {
		const activeModule = this.configSvc.isAuthenticated ? this.portalsCoreSvc.activeModule : undefined;
		return this.configSvc.isAuthenticated
			? this.getDefaultContentTypeOfCategory(activeModule) !== undefined
				? this.updateSidebarWithCategoriesAsync()
				: activeModule !== undefined
					? this.updateSidebarWithContentTypesAsync()
					: AppUtility.promise
			: AppUtility.invoke(() => this.updateSidebar());
	}

	private updateSidebarWithCategoriesAsync(parent?: Category, expandedID?: string, onNext?: () => void) {
		if (parent !== undefined) {
			this._sidebarCategory = parent;
			this._sidebarContentType = this._sidebarContentType || this.getDefaultContentTypeOfContent(parent.module);
			const sidebar = this.getSidebarItems(parent.Children, parent, expandedID);
			return AppUtility.invoke(() => this.updateSidebar(sidebar.Items, sidebar.Parent, onNext));
		}
		else {
			const contentType = this.getDefaultContentTypeOfCategory(this.portalsCoreSvc.activeModule);
			if (contentType !== undefined) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = this._sidebarContentType || this.getDefaultContentTypeOfContent(this.portalsCoreSvc.activeModule);
				return this.searchSpecifiedCategoriesAsync(contentType, data => {
					const categories = data !== undefined
						? Category.toArray(data.Objects)
						: Category.instances.toArray(category => category.SystemID === contentType.SystemID && category.RepositoryID === contentType.RepositoryID && category.ParentID === undefined).sortBy("OrderIndex", "Title");
					const sidebar = this.getSidebarItems(categories, parent, expandedID);
					this.updateSidebar(sidebar.Items, sidebar.Parent, onNext);
				});
			}
			else {
				return AppUtility.invoke(onNext);
			}
		}
	}

	private async updateSidebarWithContentTypesAsync(definitionID?: string, onNext?: () => void) {
		const filterBy: (contentType: ContentType) => boolean = AppUtility.isNotEmpty(definitionID)
			? contentType => contentType.ContentTypeDefinitionID === definitionID
			: contentType => contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000001" && contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000002";
		const contentTypes = this.portalsCoreSvc.activeModule !== undefined
			? this.portalsCoreSvc.activeModule.contentTypes
			: new Array<ContentType>();
		this.updateSidebar(contentTypes.filter(filterBy).sortBy("Title").map(contentType => ({
			Title: contentType.Title,
			Link: this.portalsCoreSvc.getRouterLink(contentType, "list"),
			Params: this.portalsCoreSvc.getRouterQueryParams(contentType)
		})), { Title: await this.configSvc.getResourceAsync("portals.sidebar.titles.contents") }, onNext);
	}

	private getSidebarItems(categories: Array<Category>, parent?: Category, expandedID?: string): { Parent: AppSidebarMenuItem; Items: AppSidebarMenuItem[] } {
		return {
			Parent: parent === undefined
				? { Title: "{{portals.sidebar.titles.categories}}" } as AppSidebarMenuItem
				: {
						ID: parent.ID,
						Title: parent.Title,
						Link: this.portalsCoreSvc.getRouterLink(ContentType.get(parent.PrimaryContentID) || this._sidebarContentType, "list", parent.ansiTitle),
						Params: this.portalsCoreSvc.getRouterQueryParams(this._sidebarContentType, { CategoryID: parent.ID }),
						Expanded: true,
						OnClick: menuItem => this.updateSidebarWithCategoriesAsync(this._sidebarCategory !== undefined ? this._sidebarCategory.Parent : undefined, this._sidebarCategory !== undefined ? this._sidebarCategory.ID : menuItem.ID),
					} as AppSidebarMenuItem,
			Items: categories.map(category => this.getSidebarItem(category, expandedID))
		};
	}

	private getSidebarItem(category: Category, expandedID?: string) {
		const gotChildren = category.childrenIDs !== undefined && category.childrenIDs.length > 0;
		const expanded = gotChildren && category.ID === expandedID;
		const contentType = ContentType.get(category.PrimaryContentID) || this._sidebarContentType;
		return {
			ID: category.ID,
			Title: category.Title,
			Link: this.portalsCoreSvc.getRouterLink(contentType, "list", category.ansiTitle),
			Params: this.portalsCoreSvc.getRouterQueryParams(contentType, { CategoryID: category.ID }),
			Children: gotChildren ? this.getSidebarItems(category.Children, undefined, expandedID).Items : [],
			Icon: gotChildren ? { Name: expanded ? "chevron-down" : "chevron-forward", Color: "medium", Slot: "end" } : undefined,
			Expanded: expanded,
			OnClick: (data: { menuIndex: number; itemIndex: number; childIndex?: number; expand?: boolean; }, sidebar: AppSidebar, event: Event) => {
				const menuItem = data.childIndex !== undefined
					? sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].Children[data.childIndex]
					: sidebar.MainMenu[data.menuIndex].Items[data.itemIndex];
				if (AppUtility.isTrue(data.expand)) {
					event.stopPropagation();
					this.expandSidebarItem(menuItem, data.childIndex === undefined ? undefined : sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].ID);
				}
				else {
					if (menuItem.Children !== undefined && menuItem.Children.length > 0) {
						this.expandSidebarItem(menuItem, data.childIndex === undefined ? undefined : sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].ID, menuItem.Expanded);
					}
					this.configSvc.navigateAsync(menuItem.Direction, menuItem.Link, menuItem.Params);
				}
			}
		} as AppSidebarMenuItem;
	}

	private expandSidebarItem(menuItem: AppSidebarMenuItem, parentID?: string, dontUpdateExpanded?: boolean) {
		if (parentID === undefined) {
			if (!dontUpdateExpanded) {
				menuItem.Expanded = !menuItem.Expanded;
				menuItem.Icon.Name = menuItem.Expanded ? "chevron-down" : "chevron-forward";
			}
		}
		else {
			this.updateSidebarWithCategoriesAsync(Category.get(parentID), menuItem.ID);
		}
	}

	private processContentTypeUpdateMessage(message: AppMessage) {
		if (this._sidebarContentType === undefined && message.Data.ContentTypeDefinitionID !== "B0000000000000000000000000000001" && message.Data.ContentTypeDefinitionID !== "B0000000000000000000000000000002") {
			this.updateSidebarWithContentTypesAsync();
		}
	}

	private getFeaturedContentsAsync(contentTypes: Array<ContentType>, index: number) {
		const contentType = contentTypes[index];
		const isCmsItem = contentType.ContentTypeDefinitionID === "B0000000000000000000000000000003";
		const isCmsForm = contentType.ContentTypeDefinitionID === "B0000000000000000000000000000005";
		const request = AppPagination.buildRequest(
			{ And: [
				{ SystemID: { Equals: contentType.SystemID } },
				{ RepositoryID: { Equals: contentType.RepositoryID } },
				{ RepositoryEntityID: { Equals: contentType.ID } }
			]},
			isCmsItem ? { LastModified: "Descending" } : { StartDate: "Descending", PublishedTime: "Descending", LastModified: "Descending" }
		);
		const onSuccess = (data?: any) => {
			if (data !== undefined && AppUtility.isArray(data.Objects, true) && AppUtility.isGotData(data.Objects)) {
				AppUtility.invoke(() => this.prepareFeaturedContents(data.Objects.first().SystemID), 13, true);
			}
			if (index < contentTypes.length - 1) {
				AppUtility.invoke(() => this.getFeaturedContentsAsync(contentTypes, index + 1), 123, true);
			}
		};
		const onError = (error?: any) => {
			const organization = Organization.get(contentType.SystemID);
			this.showError(`Error occurred while preparing featured contents\n${contentType.Title} @ ${organization.Title}`, error);
			onSuccess();
		};
		return isCmsItem
			? this.searchItemsAsync(request, onSuccess, onError)
			: isCmsForm
				? this.searchFormsAsync(request, onSuccess, onError)
				: this.searchContentsAsync(request, onSuccess, onError);
	}

	private prepareFeaturedContents(systemID: string) {
		const cmsForms = Form.instances.toArray(object => object.SystemID === systemID);
		const cmsItems = Item.instances.toArray(object => object.SystemID === systemID);
		const cmsContents = Content.instances.toArray(object => object.SystemID === systemID);
		this._featuredContents.set(systemID, new Dictionary<string, CmsBaseModel>()
			.merge(cmsForms.sortBy({ name: "LastModified", reverse: true }).take(20), object => object.ID)
			.merge(cmsForms.sortBy({ name: "Created", reverse: true }).take(20), object => object.ID)
			.merge(cmsItems.sortBy({ name: "LastModified", reverse: true }).take(20), object => object.ID)
			.merge(cmsItems.sortBy({ name: "Created", reverse: true }).take(20), object => object.ID)
			.merge(cmsContents.sortBy({ name: "LastModified", reverse: true }).take(20), object => object.ID)
			.merge(cmsContents.sortBy({ name: "StartDate", reverse: true }, { name: "PublishedTime", reverse: true }, { name: "LastModified", reverse: true }).take(20), object => object.ID)
			.toArray());
		this._noContents.remove(systemID);
		AppEvents.broadcast(this.name, { Type: "FeaturedContents", Mode: "Prepared", ID: systemID });
	}

	private async prepareFeaturedContentsAsync() {
		if (this.configSvc.isAuthenticated) {
			const activeOrganization = await this.portalsCoreSvc.getActiveOrganizationAsync();
			if (activeOrganization !== undefined) {
				const activeContentTypes = new Array<ContentType>();
				activeOrganization.modules.forEach(module => activeContentTypes.merge(this.getContentTypesOfContent(module)).merge(this.getContentTypesOfItem(module)).merge(this.getContentTypesOfForm(module)));
				AppUtility.invoke(activeContentTypes.length > 0 ? () => this.getFeaturedContentsAsync(activeContentTypes, 0) : undefined);
				await this.portalsCoreSvc.getActiveOrganizationsAsync(false, false);
			}
			else {
				await this.portalsCoreSvc.getActiveOrganizationsAsync(true, false);
			}
		}
	}

	private processAttachmentUpdateMessage(message: AppMessage) {
		const object: CmsBaseModel = Content.contains(message.Data.ObjectID)
			? Content.get(message.Data.ObjectID)
			: Item.contains(message.Data.ObjectID)
				? Item.get(message.Data.ObjectID)
				: Link.contains(message.Data.ObjectID)
					? Link.get(message.Data.ObjectID)
					: undefined;
		if (object !== undefined) {
			const attachments = message.Type.Object === "Thumbnail" ? object.thumbnails : object.attachments;
			if (message.Type.Event === "Delete") {
				if (attachments !== undefined) {
					if (AppUtility.isArray(message.Data, true)) {
						(message.Data as Array<AttachmentInfo>).forEach(attachment => attachments.removeAt(attachments.findIndex(a => a.ID === attachment.ID)));
					}
					else {
						attachments.removeAt(attachments.findIndex(a => a.ID === message.Data.ID));
					}
				}
			}
			else {
				if (attachments === undefined) {
					if (message.Type.Object === "Thumbnail") {
						object.updateThumbnails(AppUtility.isArray(message.Data, true) ? (message.Data as Array<AttachmentInfo>).map(attachment => this.filesSvc.prepareAttachment(attachment)) : [this.filesSvc.prepareAttachment(message.Data)]);
					}
					else {
						object.updateAttachments(AppUtility.isArray(message.Data, true) ? (message.Data as Array<AttachmentInfo>).map(attachment => this.filesSvc.prepareAttachment(attachment)) : [this.filesSvc.prepareAttachment(message.Data)]);
					}
				}
				else {
					if (AppUtility.isArray(message.Data, true)) {
						(message.Data as Array<AttachmentInfo>).forEach(attachment => {
							const index = attachments.findIndex(a => a.ID === attachment.ID);
							if (index < 0) {
								attachments.push(this.filesSvc.prepareAttachment(attachment));
							}
							else {
								attachments[index] = this.filesSvc.prepareAttachment(attachment);
							}
						});
					}
					else {
						const index = attachments.findIndex(a => a.ID === message.Data.ID);
						if (index < 0) {
							attachments.push(this.filesSvc.prepareAttachment(message.Data));
						}
						else {
							attachments[index] = this.filesSvc.prepareAttachment(message.Data);
						}
					}
				}
			}
			AppEvents.broadcast(this.name, { Object: object.contentType.getObjectName(true), Type: "Updated", Mode: "Files", ID: object.ID, SystemID: object.SystemID, RepositoryID: object.RepositoryID, RepositoryEntityID: object.RepositoryEntityID });
		}
	}

	async getSchedulingTaskURLAsync(object: CmsBaseModel, time?: Date) {
		const objectName = object.contentType.getObjectName(true);
		const excluded = ["ID", "SystemID", "RepositoryID", "RepositoryEntityID", "Created", "CreatedID", "LastModified", "LastModifiedID", "Privileges", "Alias", "AllowComments", "TotalVersions", "Versions", "Parent", "Children", "ChildrenIDs", "children", "childrenIDs", "ansiTitle", "_attachments", "_thumbnails", "_routerParams"];
		if (objectName !== "CMS.Content" && objectName !== "Content") {
			excluded.push("SubTitle");
		}
		const params = {
			Title: await this.configSvc.getResourceAsync("portals.tasks.scheduled.update.title", { title: object.Title }),
			Status: "Awaiting",
			SchedulingType: "Update",
			RecurringType: "Minutes",
			RecurringUnit: 0,
			Time: time || AppUtility.setTime(AppUtility.addTime(new Date(), 1, "days"), 15, 0, 0, 0),
			Persistance: true,
			SystemID: object.SystemID,
			EntityInfo: object.RepositoryEntityID,
			ObjectID: object.ID,
			UserID: this.configSvc.getAccount().id,
			Data: AppUtility.stringify(AppUtility.clone(object, excluded)),
			ObjectName: objectName
		};
		return `/portals/core/tasks/update/${AppUtility.toANSI(object.Title, true)}?x-request=${AppCrypto.jsonEncode(params)}`;
	}

	get categoryCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const category = data !== undefined
				? data instanceof Category
					? data as Category
					: Category.deserialize(data)
				: undefined;
			return category !== undefined
				? { title: category.FullTitle, description: category.Description, originalObject: category }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("cms.category", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => {
				const category = Category.get(obj.ID);
				return category === undefined
					? convertToCompleterItem(this.fetchCategory(Category.update(obj)))
					: category.childrenIDs === undefined
						? convertToCompleterItem(this.fetchCategory(category))
						: convertToCompleterItem(category);
			}),
			convertToCompleterItem
		);
	}

	getContentTypesOfCategory(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000001");
	}

	getDefaultContentTypeOfCategory(module: Module) {
		return this.getContentTypesOfCategory(module).first();
	}

	searchCategories(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.category", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processCategories(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching categories", error, onError)
		);
	}

	searchCategoriesAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("cms.category", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processCategories(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching categories", error, onError),
			dontProcessPagination,
			headers,
			useXHR
		);
	}

	searchSpecifiedCategoriesAsync(contentType: ContentType, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, useXHR: boolean = false) {
		return this.searchCategoriesAsync(AppPagination.buildRequest(
			{ And: [
				{ SystemID: { Equals: contentType.SystemID } },
				{ RepositoryID: { Equals: contentType.RepositoryID } },
				{ RepositoryEntityID: { Equals: contentType.ID } },
				{ ParentID: "IsNull" }
			]},
			{ OrderIndex: "Ascending", Title: "Ascending" },
			{
				TotalRecords: -1,
				TotalPages: 0,
				PageSize: 0,
				PageNumber: 0
			}
		), onSuccess, onError, dontProcessPagination, !!dontProcessPagination ? { "x-no-cache": "x" } : undefined, useXHR);
	}

	createCategoryAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("cms.category"),
			body,
			data => {
				this.updateCategory(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating a category", error, onError)
		);
	}

	getCategoryAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const category = Category.get(id);
		if (category !== undefined && category.childrenIDs !== undefined) {
			return AppUtility.invoke(onSuccess);
		}
		else {
			return this.readAsync(
				this.getPath("cms.category", id),
				data => {
					this.updateCategory(data);
					if (this._sidebarContentType !== undefined) {
						const parentCategory = Category.get(data.ParentID);
						if (this._sidebarCategory === parentCategory) {
							this.updateSidebarWithCategoriesAsync(parentCategory);
						}
					}
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				},
				error => this.processError("Error occurred while getting a category", error, onError),
				undefined,
				useXHR
			);
		}
	}

	updateCategoryAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Category.contains(body.ID) ? Category.get(body.ID).ParentID : undefined;
		return this.updateAsync(
			this.getPath("cms.category", body.ID),
			body,
			data => {
				this.updateCategory(data, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a category", error, onError),
			headers
		);
	}

	deleteCategoryAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Category.contains(id) ? Category.get(id).ParentID : undefined;
		return this.deleteAsync(
			this.getPath("cms.category", id),
			data => {
				this.deleteCategory(data.ID, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a category", error, onError),
			headers
		);
	}

	refreshCategoryAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.portalsCoreSvc.refreshAsync(
			"cms.category",
			id,
			data => {
				this.updateCategory(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			useXHR
		);
	}

	private fetchCategory(category: Category) {
		if (category !== undefined && category.childrenIDs === undefined) {
			this.getCategoryAsync(category.ID, _ => {
				const o = Category.get(category.ID);
				if (o.childrenIDs !== undefined && o.childrenIDs.length > 0) {
					o.Children.forEach(c => this.fetchCategory(c));
				}
			});
		}
		return category;
	}

	private updateCategory(json: any, parentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const category = Category.update(json);
			category.childrenIDs = AppUtility.isArray(json.Children, true)
				? (json.Children as Array<any>).map(o => this.updateCategory(o)).filter(o => o !== undefined).map(o => o.ID).distinct()
				: [];
			if (category.Versions === undefined) {
				this.portalsCoreSvc.findVersions("CMS.Category", category.ID);
			}
			let parentCategory = Category.get(parentID);
			if (parentCategory !== undefined && parentCategory.childrenIDs !== undefined && parentCategory.ID !== category.ParentID) {
				parentCategory.childrenIDs.remove(category.ID);
			}
			parentCategory = category.Parent;
			if (parentCategory !== undefined && parentCategory.childrenIDs !== undefined && parentCategory.childrenIDs.indexOf(category.ID) < 0) {
				parentCategory.childrenIDs.push(category.ID);
				parentCategory.childrenIDs = parentCategory.childrenIDs.distinct();
			}
			return category;
		}
		return undefined;
	}

	private deleteCategory(id: string, parentID?: string) {
		if (Category.contains(id)) {
			const parentCategory = Category.get(parentID);
			if (parentCategory !== undefined && parentCategory.childrenIDs !== undefined) {
				parentCategory.childrenIDs.remove(id);
			}
			Category.instances.toArray(category => category.ParentID === id).forEach(category => this.deleteCategory(category.ID));
			Category.instances.remove(id);
		}
	}

	fetchCategoryDesktops(category: Category) {
		if (AppUtility.isNotEmpty(category.DesktopID) && Desktop.get(category.DesktopID) === undefined) {
			this.portalsCoreSvc.getDesktopAsync(category.DesktopID);
		}
		const contentType = category.contentType;
		if (contentType !== undefined && AppUtility.isNotEmpty(contentType.DesktopID) && Desktop.get(contentType.DesktopID) === undefined) {
			this.portalsCoreSvc.getDesktopAsync(contentType.DesktopID);
		}
		const module = category.module;
		if (module !== undefined && AppUtility.isNotEmpty(module.DesktopID) && Desktop.get(module.DesktopID) === undefined) {
			this.portalsCoreSvc.getDesktopAsync(module.DesktopID);
		}
		const organization = category.organization;
		if (AppUtility.isNotEmpty(organization.HomeDesktopID) && Desktop.get(organization.HomeDesktopID) === undefined) {
			this.portalsCoreSvc.getDesktopAsync(organization.HomeDesktopID);
		}
	}

	processCategories(categories: Array<any>, fetchDesktops: boolean = false) {
		categories.forEach(data => {
			const category = Category.update(data);
			if (category.Versions === undefined) {
				this.portalsCoreSvc.findVersions("CMS.Category", category.ID);
			}
			if (category.childrenIDs === undefined) {
				this.fetchCategory(category);
			}
			if (fetchDesktops) {
				this.fetchCategoryDesktops(category);
			}
		});
	}

	private processCategoryUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID) {
					this.updateCategory(message.Data);
					if (this._sidebarContentType !== undefined) {
						const parentCategory = Category.get(message.Data.ParentID);
						if (this._sidebarCategory === parentCategory) {
							this.updateSidebarWithCategoriesAsync(parentCategory);
						}
					}
				}
				else if (Category.contains(message.Data.ID)) {
					Category.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				this.deleteCategory(message.Data.ID, message.Data.ParentID);
				break;
			default:
				this.showLog("Got an update message of a CMS category", message);
				break;
		}
		if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete" || message.Type.Event === "Refresh")) {
			AppEvents.broadcast(this.name, { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			if (AppUtility.isNotEmpty(message.Data.ParentID)) {
				AppEvents.broadcast(this.name, { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			}
		}
	}

	get contentCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const content = data !== undefined
				? data instanceof Content
					? data as Content
					: Content.deserialize(data)
				: undefined;
			return content !== undefined
				? { title: content.Title, description: content.Summary, originalObject: content }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("cms.content", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => convertToCompleterItem(obj)),
			convertToCompleterItem
		);
	}

	getContentTypesOfContent(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000002");
	}

	getDefaultContentTypeOfContent(module: Module) {
		return this.getContentTypesOfContent(module).first();
	}

	searchContents(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processContents(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching contents", error, onError)
		);
	}

	searchContentsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processContents(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching contents", error, onError)
		);
	}

	createContentAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("cms.content"),
			body,
			data => {
				Content.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating a content", error, onError)
		);
	}

	getContentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Content.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
				this.getPath("cms.content", id),
				data => {
					Content.update(data);
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				},
				error => this.processError("Error occurred while getting a content", error, onError),
				undefined,
				useXHR
			);
	}

	updateContentAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.updateAsync(
			this.getPath("cms.content", body.ID),
			body,
			data => {
				Content.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a content", error, onError),
			undefined,
			useXHR
		);
	}

	deleteContentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("cms.content", id),
			data => {
				Content.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a content", error, onError)
		);
	}

	refreshContentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.portalsCoreSvc.refreshAsync(
			"cms.content",
			id,
			data => {
				Content.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			useXHR
		);
	}

	private processContents(contents: Array<any>) {
		contents.forEach(data => {
			const content = Content.update(data);
			if (content.Versions === undefined) {
				this.portalsCoreSvc.findVersions("CMS.Content", content.ID);
			}
		});
		this._noContents.remove(contents.first().SystemID);
	}

	private processContentUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID) {
					this._noContents.remove(Content.update(message.Data).SystemID);
				}
				else if (Content.contains(message.Data.ID)) {
					Content.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Content.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a CMS content", message);
				break;
		}
		if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "CMS.Content", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID, CategoryID: message.Data.CategoryID });
			if (AppUtility.isArray(message.Data.OtherCategories)) {
				(message.Data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.name, { Object: "CMS.Content", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID, CategoryID: categoryID }));
			}
		}
	}

	get itemCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const item = data !== undefined
				? data instanceof Item
					? data as Item
					: Item.deserialize(data)
				: undefined;
			return item !== undefined
				? { title: item.Title, description: item.Summary, originalObject: item }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("cms.item", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => convertToCompleterItem(obj)),
			convertToCompleterItem
		);
	}

	getContentTypesOfItem(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000003");
	}

	getDefaultContentTypeOfItem(module: Module) {
		return this.getContentTypesOfItem(module).first();
	}

	searchItems(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processItems(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching items", error, onError)
		);
	}

	searchItemsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processItems(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching items", error, onError)
		);
	}

	createItemAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("cms.item"),
			body,
			data => {
				Item.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating an item", error, onError)
		);
	}

	async getItemAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Item.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("cms.item", id),
					data => {
						Item.update(data);
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while getting an item", error, onError),
					undefined,
					useXHR
				);
	}

	updateItemAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("cms.item", body.ID),
			body,
			data => {
				Item.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating an item", error, onError)
		);
	}

	deleteItemAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.deleteAsync(
			this.getPath("cms.item", id),
			data => {
				Item.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting an item", error, onError),
			headers
		);
	}

	refreshItemAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.refreshAsync(
			"cms.item",
			id,
			data => {
				Item.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			true
		);
	}

	private processItems(items: Array<any>) {
		items.forEach(obj => {
			const item = Item.update(obj);
			if (item.Versions === undefined) {
				this.portalsCoreSvc.findVersions("CMS.Item", item.ID);
			}
		});
		this._noContents.remove(items.first().SystemID);
	}

	private processItemUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID) {
					this._noContents.remove(Item.update(message.Data).SystemID);
				}
				else if (Item.contains(message.Data.ID)) {
					Item.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Item.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a CMS item", message);
				break;
		}
		if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "CMS.Item", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
		}
	}

	get linkCompleterDataSource() {
		const convertToCompleterItem = (data: any) => {
			const link = data !== undefined
				? data instanceof Link
					? data as Link
					: Link.deserialize(data)
				: undefined;
			return link !== undefined
				? { title: link.FullTitle, description: link.Summary, originalObject: link }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("cms.link", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => {
				const link = Link.get(obj.ID);
				return link === undefined
					? convertToCompleterItem(this.fetchLink(Link.update(obj)))
					: link.childrenIDs === undefined
						? convertToCompleterItem(this.fetchLink(link))
						: convertToCompleterItem(link);
			}),
			convertToCompleterItem
		);
	}

	getContentTypesOfLink(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000004");
	}

	getDefaultContentTypeOfLink(module: Module) {
		return this.getContentTypesOfLink(module).first();
	}

	searchLinks(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.link", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processLinks(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching links", error, onError)
		);
	}

	searchLinksAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.searchAsync(
			this.getSearchingPath("cms.link", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processLinks(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching links", error, onError),
			dontProcessPagination,
			headers,
			useXHR
		);
	}

	searchSpecifiedLinksAsync(contentType: ContentType, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.searchLinksAsync(AppPagination.buildRequest(
			{ And: [
				{ SystemID: { Equals: contentType.SystemID } },
				{ RepositoryID: { Equals: contentType.RepositoryID } },
				{ RepositoryEntityID: { Equals: contentType.ID } },
				{ ParentID: "IsNull" }
			]},
			{ OrderIndex: "Ascending", Title: "Ascending" },
			{
				TotalRecords: -1,
				TotalPages: 0,
				PageSize: 0,
				PageNumber: 0
			}
		), onSuccess, onError, true, { "x-no-cache": "x" }, useXHR);
	}

	createLinkAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("cms.link"),
			body,
			data => {
				this.updateLink(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating a link", error, onError)
		);
	}

	async getLinkAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const link = Link.get(id);
		return link !== undefined && link.childrenIDs !== undefined
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("cms.link", id),
					data => {
						this.updateLink(data);
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while getting a link", error, onError),
					undefined,
					useXHR
				);
	}

	updateLinkAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Link.contains(body.ID) ? Link.get(body.ID).ParentID : undefined;
		return this.updateAsync(
			this.getPath("cms.link", body.ID),
			body,
			data => {
				this.updateLink(data, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a link", error, onError),
			headers
		);
	}

	deleteLinkAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Link.contains(id) ? Link.get(id).ParentID : undefined;
		return this.deleteAsync(
			this.getPath("cms.link", id),
			data => {
				this.deleteLink(data.ID, parentID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a link", error, onError),
			headers
		);
	}

	refreshLinkAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.portalsCoreSvc.refreshAsync(
			"cms.link",
			id,
			data => {
				this.updateLink(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			useXHR
		);
	}

	private fetchLink(link: Link) {
		if (link !== undefined && link.childrenIDs === undefined) {
			this.getLinkAsync(link.ID, _ => {
				const obj = Link.get(link.ID);
				if (obj.childrenIDs !== undefined && obj.childrenIDs.length > 0) {
					obj.Children.forEach(cobj => this.fetchLink(cobj));
				}
			});
			if (link.Versions === undefined) {
				this.portalsCoreSvc.findVersions("CMS.Link", link.ID);
			}
		}
		return link;
	}

	private updateLink(json: any, parentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const link = Link.update(json);
			link.childrenIDs = AppUtility.isArray(json.Children, true)
				? (json.Children as Array<any>).map(obj => this.updateLink(obj)).filter(obj => obj !== undefined).map(obj => obj.ID).distinct()
				: [];
			let parentLink = Link.get(parentID);
			if (parentLink !== undefined && parentLink.childrenIDs !== undefined && parentLink.ID !== link.ParentID) {
				parentLink.childrenIDs.remove(link.ID);
			}
			parentLink = link.Parent;
			if (parentLink !== undefined && parentLink.childrenIDs !== undefined && parentLink.childrenIDs.indexOf(link.ID) < 0) {
				parentLink.childrenIDs.push(link.ID);
				parentLink.childrenIDs = parentLink.childrenIDs.distinct();
			}
			return link;
		}
		return undefined;
	}

	private deleteLink(id: string, parentID?: string) {
		if (Link.contains(id)) {
			const parentLink = Link.get(parentID);
			if (parentLink !== undefined && parentLink.childrenIDs !== undefined) {
				parentLink.childrenIDs.remove(id);
			}
			Link.instances.toArray(link => link.ParentID === id).forEach(link => this.deleteLink(link.ID));
			Link.instances.remove(id);
		}
	}

	processLinks(links: Array<any>) {
		links.forEach(data => {
			const link = Link.update(data);
			if (link.childrenIDs === undefined) {
				this.fetchLink(link);
			}
			if (link.Versions === undefined) {
				this.portalsCoreSvc.findVersions("CMS.Link", link.ID);
			}
		});
	}

	private processLinkUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID) {
					this.updateLink(message.Data);
				}
				else if (Link.contains(message.Data.ID)) {
					Link.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				this.deleteLink(message.Data.ID, message.Data.ParentID);
				break;
			default:
				this.showLog("Got an update message of a CMS link", message);
				break;
		}
		if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "CMS.Link", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			if (AppUtility.isNotEmpty(message.Data.ParentID)) {
				AppEvents.broadcast(this.name, { Object: "CMS.Link", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			}
		}
	}

	get formCompleterDataSource() {
		const convertToCompleterForm = (data: any) => {
			const form = data !== undefined
				? data instanceof Form
					? data as Form
					: Form.deserialize(data)
				: undefined;
			return form !== undefined
				? { title: form.Title, description: form.Name, originalObject: form }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("cms.form", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => convertToCompleterForm(obj)),
			convertToCompleterForm
		);
	}

	getContentTypesOfForm(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000005");
	}

	getDefaultContentTypeOfForm(module: Module) {
		return this.getContentTypesOfForm(module).first();
	}

	searchForms(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.form", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processForms(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching form items", error, onError)
		);
	}

	searchFormsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("CMS.Form", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isGotData(data.Objects)) {
					this.processForms(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching form items", error, onError)
		);
	}

	createFormAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("CMS.Form"),
			body,
			data => {
				Form.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating a form item", error, onError)
		);
	}

	async getFormAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Form.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("CMS.Form", id),
					data => {
						Form.update(data);
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while getting a form item", error, onError),
					undefined,
					useXHR
				);
	}

	updateFormAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("CMS.Form", body.ID),
			body,
			data => {
				Form.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a form item", error, onError)
		);
	}

	deleteFormAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.deleteAsync(
			this.getPath("CMS.Form", id),
			data => {
				Form.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a form item", error, onError),
			headers
		);
	}

	refreshFormAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.refreshAsync(
			"cms.form",
			id,
			data => {
				Form.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			true
		);
	}

	private processForms(forms: Array<any>) {
		forms.forEach(obj => Form.update(obj));
		this._noContents.remove(forms.first().SystemID);
	}

	private processFormUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID) {
					Form.update(message.Data);
					this._noContents.remove(message.Data.SystemID);
				}
				else if (Form.contains(message.Data.ID)) {
					Form.get(message.Data.ID).update(message.Data);
				}
				break;
			case "Delete":
				Form.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a CMS form", message);
				break;
		}
		if (!!message.Data.RepositoryID && !!message.Data.RepositoryEntityID && (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete")) {
			AppEvents.broadcast(this.name, { Object: "CMS.Form", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
		}
	}

	getContentTypesOfProduct(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000006");
	}

	get crawlerCompleterDataSource() {
		const convertToCompleterCrawler = (data: any) => {
			const crawler = data !== undefined
				? data instanceof Crawler
					? data as Crawler
					: Crawler.deserialize(data)
				: undefined;
			return crawler !== undefined
				? { title: crawler.Title, description: crawler.Description, originalObject: crawler }
				: undefined;
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("cms.crawler", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => convertToCompleterCrawler(obj)),
			convertToCompleterCrawler
		);
	}

	searchCrawlers(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.crawler", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Crawler.update(obj));
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching crawlers", error, onError)
		);
	}

	searchCrawlersAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.crawler", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true) && AppUtility.isGotData(data.Objects)) {
					(data.Objects as Array<any>).forEach(obj => Crawler.update(obj));
					this._noContents.remove(data.Objects.first().SystemID);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching crawlers", error, onError)
		);
	}

	createCrawlerAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const id = body.ID;
		return this.createAsync(
			this.getPath("cms.crawler", id === "test" || id === "categories" ? id : undefined),
			body,
			data => {
				if (data.ID !== "test" && data.ID !== "categories") {
					Crawler.update(data);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while creating an crawler", error, onError)
		);
	}

	async getCrawlerAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return Crawler.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("cms.crawler", id),
					data => {
						Crawler.update(data);
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while getting an crawler", error, onError),
					undefined,
					useXHR
				);
	}

	updateCrawlerAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("cms.crawler", body.ID),
			body,
			data => {
				Crawler.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating an crawler", error, onError)
		);
	}

	deleteCrawlerAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.deleteAsync(
			this.getPath("cms.crawler", id),
			data => {
				Crawler.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting an crawler", error, onError),
			headers
		);
	}

	refreshCrawlerAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.refreshAsync(
			"cms.crawler",
			id,
			data => {
				Crawler.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			onError,
			headers,
			true
		);
	}

	private processCrawlerUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Crawler.update(message.Data);
				break;
			case "Delete":
				Crawler.instances.remove(message.Data.ID);
				break;
			default:
				this.showLog("Got an update message of a CMS crawler", message);
				break;
		}
		if (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete") {
			AppEvents.broadcast(this.name, { Object: "CMS.Crawler", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID });
		}
	}

	async getObjectAsync(id: string, name: string, force: boolean = false) {
		const account = this.configSvc.getAccount();
		let gotRights = this.authSvc.isSystemAdministrator(account);
		let object: BaseModel;
		switch (name) {
			case "Organization":
			case "Core.Organization":
				object = Organization.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getOrganizationAsync(id, () => object = Organization.get(id), undefined, true);
				}
				gotRights = gotRights || this.portalsCoreSvc.canManageOrganization(object as Organization, account);
				break;
			case "Role":
			case "Core.Role":
				object = Role.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getRoleAsync(id, () => object = Role.get(id), undefined, true);
				}
				object = object || new Role(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Role).organization, account);
				break;
			case "Module":
			case "Core.Module":
				object = Module.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getModuleAsync(id, () => object = Module.get(id), undefined, true);
				}
				object = object || new Module(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization(Organization.get((object as Module).SystemID), account);
				break;
			case "ContentType":
			case "Core.ContentType":
				object = ContentType.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getContentTypeAsync(id, () => object = ContentType.get(id), undefined, true);
				}
				object = object || new ContentType(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization(Organization.get((object as ContentType).SystemID), account);
				break;
			case "Expression":
			case "Core.Expression":
				object = Expression.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getExpressionAsync(id, () => object = Expression.get(id), undefined, true);
				}
				object = object || new Expression(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Expression).organization, account);
				break;
			case "Site":
			case "Core.Site":
				object = Site.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getSiteAsync(id, () => object = Site.get(id), undefined, true);
				}
				object = object || new Site(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Site).organization, account);
				break;
			case "Desktop":
			case "Core.Desktop":
				object = Desktop.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getDesktopAsync(id, () => object = Desktop.get(id), undefined, true);
				}
				object = object || new Desktop(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Desktop).organization, account);
				break;
			case "Portlet":
			case "Core.Portlet":
				object = Portlet.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getPortletAsync(id, () => object = Portlet.get(id), undefined, true);
				}
				object = object || new Portlet(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canManageOrganization((object as Portlet).organization, account);
				break;
			case "SchedulingTask":
			case "Core.SchedulingTask":
				object = SchedulingTask.get(id);
				if (object === undefined && force) {
					await this.portalsCoreSvc.getSchedulingTaskAsync(id, () => object = SchedulingTask.get(id), undefined, true);
				}
				object = object || new SchedulingTask({ SystemIDSystemID: this.portalsCoreSvc.activeOrganization.ID });
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as SchedulingTask).organization, account);
				break;
			case "Category":
			case "Cms.Category":
			case "CMS.Category":
				object = Category.get(id);
				if (object === undefined && force) {
					await this.getCategoryAsync(id, () => object = Category.get(id), undefined, true);
				}
				object = object || new Category(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Category).organization, account) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", (object as Category).Privileges);
				break;
			case "Content":
			case "Cms.Content":
			case "CMS.Content":
				object = Content.get(id);
				if (object === undefined && force) {
					await this.getContentAsync(id, () => object = Content.get(id), undefined, true);
				}
				object = object || new Content(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Content).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Category", ((object as Content).category || new Category(this.portalsCoreSvc.activeOrganization.ID)).Privileges);
				if (!gotRights && ((object as Content).Status === "Draft" || (object as Content).Status === "Pending")) {
					gotRights = (object as Content).CreatedID === account.id;
				}
				break;
			case "Item":
			case "Cms.Item":
			case "CMS.Item":
				object = Item.get(id);
				if (object === undefined && force) {
					await this.getItemAsync(id, () => object = Item.get(id), undefined, true);
				}
				object = object || new Item(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Item).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Item", ((object as Item).contentType || new ContentType(this.portalsCoreSvc.activeOrganization.ID)).Privileges);
				if (!gotRights && ((object as Item).Status === "Draft" || (object as Item).Status === "Pending")) {
					gotRights = (object as Item).CreatedID === account.id;
				}
				break;
			case "Link":
			case "Cms.Link":
			case "CMS.Link":
				object = Link.get(id);
				if (object === undefined && force) {
					await this.getLinkAsync(id, () => object = Link.get(id), undefined, true);
				}
				object = object || new Link(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Link).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Link", ((object as Link).contentType || new ContentType(this.portalsCoreSvc.activeOrganization.ID)).Privileges);
				if (!gotRights && ((object as Link).Status === "Draft" || (object as Link).Status === "Pending")) {
					gotRights = (object as Link).CreatedID === account.id;
				}
				break;
			case "Form":
			case "Cms.Form":
			case "CMS.Form":
				object = Form.get(id);
				if (object === undefined && force) {
					await this.getFormAsync(id, () => object = Form.get(id), undefined, true);
				}
				object = object || new Form(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Form).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Form", ((object as Form).contentType || new ContentType(this.portalsCoreSvc.activeOrganization.ID)).Privileges);
				break;
			case "Crawler":
			case "Cms.Crawler":
			case "CMS.Crawler":
				object = Crawler.get(id);
				if (object === undefined && force) {
					await this.getCrawlerAsync(id, () => object = Crawler.get(id), undefined, true);
				}
				object = object || new Crawler(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Crawler).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Crawler", ((object as Crawler).contentType || new ContentType(this.portalsCoreSvc.activeOrganization.ID)).Privileges);
				break;
		}
		return { object: object, gotRights: gotRights };
	}

	sendNotificationAsync(objectID: string, contentTypeID: string, sendAppNotifications: boolean = false, sendEmailNotifications: boolean = false, sendWebHookNotifications: boolean = false) {
		return this.readAsync(this.getPath("notification", objectID, "x-entity=" + contentTypeID + (sendAppNotifications ? "&x-send-app-notifications=true" : "") + (sendEmailNotifications ? "&x-send-email-notifications=true" : "") + (sendWebHookNotifications ? "&x-send-webhook-notifications=true" : "")), undefined, error => this.processError("Error occurred while re-sending a notification", error));
	}

}
