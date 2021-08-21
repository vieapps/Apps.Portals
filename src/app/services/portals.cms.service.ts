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
import { Organization, Module, ContentType, Desktop } from "@app/models/portals.core.all";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";
import { Category, Content, Item, Link } from "@app/models/portals.cms.all";

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
		this.initialize();
	}

	private _oembedProviders: Array<{ name: string; schemes: RegExp[], pattern: { expression: RegExp; position: number; html: string } }>;
	private _sidebarCategory: Category;
	private _sidebarContentType: ContentType;
	private _noContents = new HashSet<string>();
	private _featuredContents = new Dictionary<string, Array<CmsBaseModel>>();

	public get featuredContents() {
		const organization = this.portalsCoreSvc.activeOrganization;
		return organization !== undefined ? this._featuredContents.get(organization.ID) || [] : [];
	}

	private initialize() {
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
			if ("UpdateSidebar" === info.args.Type) {
				if ("ContentTypes" === info.args.Mode) {
					this._sidebarCategory = undefined;
					this._sidebarContentType = undefined;
					this.updateSidebarWithContentTypesAsync();
				}
				else if ("Categories" === info.args.Mode) {
					if (AppUtility.isNotEmpty(info.args.ContentTypeID)) {
						if (this._sidebarContentType === undefined || this._sidebarContentType.ID !== info.args.ContentTypeID) {
							this._sidebarContentType = ContentType.get(info.args.ContentTypeID);
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
			else if ("Changed" === info.args.Type && ("Organization" === info.args.Object || "Module" === info.args.Object)) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				this.updateSidebarAsync();
			}
			else if ("FeaturedContents" === info.args.Type && "Request" === info.args.Mode) {
				const organization = this.portalsCoreSvc.activeOrganization;
				if (organization !== undefined && !this._noContents.contains(organization.ID)) {
					if (organization.modules.toList().SelectMany(module => module.contentTypes.toList()).Count() > 0) {
						this._noContents.add(organization.ID);
						this.prepareFeaturedContentsAsync(false);
					}
				}
			}
		});

		AppEvents.on("Session", info => {
			if (("LogIn" === info.args.Type || "LogOut" === info.args.Type) && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				this.updateSidebarAsync().then("LogIn" === info.args.Type ? () => this.prepareFeaturedContentsAsync() : () => {});
			}
		});

		AppEvents.on("Account", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				this.updateSidebarAsync();
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				if (Organization.active !== undefined && this.portalsCoreSvc.activeOrganizations.indexOf(Organization.active.ID) < 0) {
					this._sidebarCategory = undefined;
					this._sidebarContentType = undefined;
					this.portalsCoreSvc.removeActiveOrganizationAsync(Organization.active.ID).then(() => {
						this.updateSidebarAsync();
						this.prepareFeaturedContentsAsync();
					});
				}
			}
		});
	}

	public async initializeAsync(onNext?: () => void) {
		const promises = new Array<Promise<any>>();

		if (this._oembedProviders === undefined) {
			promises.push(this.fetchAsync(
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
			));
		}

		if (Module.active === undefined) {
			promises.push(this.portalsCoreSvc.getActiveModuleAsync(undefined, true));
		}

		if (Module.active !== undefined && Module.active.contentTypes.length < 1) {
			promises.push(this.portalsCoreSvc.getActiveModuleAsync(undefined, true));
		}

		if (this.configSvc.appConfig.services.active === this.name) {
			promises.push(this.updateSidebarAsync());
		}

		await Promise.all(promises);
		if (onNext !== undefined) {
			onNext();
		}
	}

	public canManage(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isAdministrator(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	public canModerate(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isModerator(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	public canEdit(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isEditor(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	public canContribute(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isContributor(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	public canView(object: CmsBaseModel, account?: Account) {
		return this.authSvc.isViewer(this.name, object.contentType.getObjectName(), object.Privileges, account);
	}

	public normalizeRichHtml(html: string) {
		if (AppUtility.isNotEmpty(html)) {
			// normalize all 'oembed' tags
			let start = AppUtility.indexOf(html, "<oembed");
			while (start > -1) {
				let end = start < 0 ? -1 : AppUtility.indexOf(html, "</oembed>", start + 1);
				if (end > -1) {
					end += 9;
					let media = (html as string).substr(start, 9 + end - start);
					const urlStart = AppUtility.indexOf(media, "url=") + 5;
					const urlEnd = AppUtility.indexOf(media, "\"", urlStart + 1);
					const url = media.substr(urlStart, urlEnd - urlStart);
					const oembedProvider = this._oembedProviders.find(provider => provider.schemes.some(regex => url.match(regex)));
					if (oembedProvider !== undefined) {
						const match = url.match(oembedProvider.pattern.expression);
						media = AppUtility.format(oembedProvider.pattern.html, { id: match.length > oembedProvider.pattern.position ? match[oembedProvider.pattern.position] : undefined });
					}
					else {
						const tag = url.endsWith(".mp3") ? "audio" : "video";
						const height = url.endsWith(".mp3") ? "32" : "315";
						media = AppUtility.format(`<${tag} width=\"560\" height=\"${height}\" controls autoplay muted><source src=\"{{url}}\"/></${tag}>`, { url: url });
					}
					html = html.substr(0, start) + media + html.substr(end);
				}
				start = AppUtility.indexOf(html, "<oembed", start + 1);
			}

			// remove 'height' from all images (img tags)
			start = AppUtility.indexOf(html, "<img");
			while (start > -1) {
				const end = AppUtility.indexOf(html, ">", start + 1) + 1;
				let img = html.substr(start, end - start);
				img = img.replace("height=", "data-height=");
				img = img.replace("height:", "data-height:");
				html = html.substr(0, start) + img + html.substr(end);
				start = AppUtility.indexOf(html, "<img", start + 1);
			}

			// add 'target' into all archors (a tags)
			start = AppUtility.indexOf(html, "<a");
			while (start > -1) {
				const end = AppUtility.indexOf(html, ">", start + 1) + 1;
				let archor = html.substr(start, end - start);
				if (AppUtility.indexOf(archor, "target=") < 0) {
					archor = archor.substr(0, archor.length - 1) + " target=\"_blank\">";
					html = html.substr(0, start) + archor + html.substr(end);
				}
				start = AppUtility.indexOf(html, "<a", start + 1);
			}
		}
		return this.domSanitizer.bypassSecurityTrustHtml(html || "");
	}

	public lookup(objectName: string, request: AppDataRequest, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.lookup(objectName, request, onSuccess, onError, headers);
	}

	public lookupAsync(objectName: string, request: AppDataRequest, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.lookupAsync(objectName, request, onSuccess, onError, headers);
	}

	public getAsync(objectName: string, id: string, onSuccess: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.getAsync(objectName, id, onSuccess, onError, headers);
	}

	public getFileOptions(object: CmsBaseModel, onCompleted?: (fileOptions: FileOptions) => void) {
		if (object !== undefined) {
			const fileOptions: FileOptions = {
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
			};
			if (onCompleted !== undefined) {
				onCompleted(fileOptions);
			}
			return fileOptions;
		}
		return undefined;
	}

	public getFileHeaders(object: CmsBaseModel, additional?: { [header: string]: string }) {
		return this.filesSvc.getFileHeaders(this.getFileOptions(object), additional);
	}

	public getLinkSelector(object: CmsBaseModel, lookupModalPage: any, options?: { [key: string]: any }) {
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
					(attachments: AttachmentInfo[]) => onSelected(attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined)
				)
			};
		}
		return linkSelector;
	}

	public getMediaSelector(object: CmsBaseModel, label?: string) {
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
					(attachments: AttachmentInfo[]) => onSelected(attachments !== undefined && attachments.length > 0 ? attachments[0].URIs.Direct : undefined, attachments !== undefined && attachments.length > 0 ? attachments[0].ContentType.substr(0, attachments[0].ContentType.indexOf("/")) : undefined)
				)
			}
			: undefined;
	}

	public getUploadFormControl(object: CmsBaseModel, segment?: string, label?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		return this.portalsCoreSvc.getUploadFormControl(this.getFileOptions(object), segment, label, onCompleted);
	}

	public getPermanentLinkFormControl(object: CmsBaseModel, segment?: string, label?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: "PermanentLink",
			Type: "Text",
			Segment: segment || "basic",
			Extras: { Text: this.portalsCoreSvc.getPermanentURL(object) },
			Options: {
				Label: "{{portals.cms.common.permanentLink.label}}",
				Description: "{{portals.cms.common.permanentLink.description}}",
				Icon: {
					Name: "globe",
					Fill: "clear",
					Color: "medium",
					Slot: "end",
					OnClick: (_, formControl) => PlatformUtility.openURL(formControl instanceof AppFormsControlComponent ? (formControl as AppFormsControlComponent).text : formControl.value)
				}
			}
		};
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public setLookupOptions(lookupOptions: AppFormsControlLookupOptionsConfig, lookupModalPage: any, contentType: ContentType, multiple?: boolean, nested?: boolean, onCompleted?: (options: AppFormsControlLookupOptionsConfig) => void) {
		this.portalsCoreSvc.setLookupOptions(lookupOptions, lookupModalPage, contentType, multiple, nested, onCompleted);
	}

	private updateSidebar(items?: Array<AppSidebarMenuItem>, parent?: AppSidebarMenuItem, onNext?: () => void) {
		AppEvents.broadcast("UpdateSidebar", {
			name: "cms",
			parent: parent,
			items: items,
			index: 0
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

	private async updateSidebarWithContentTypesAsync(definitionID?: string, onNext?: () => void) {
		const filterBy: (contentType: ContentType) => boolean = AppUtility.isNotEmpty(definitionID)
			? contentType => contentType.ContentTypeDefinitionID === definitionID
			: contentType => contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000001" && contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000002";
		this.updateSidebar(
			this.portalsCoreSvc.activeModule.contentTypes.filter(filterBy).sortBy("Title").map(contentType => ({
				Title: contentType.Title,
				Link: this.portalsCoreSvc.getRouterLink(contentType, "list"),
				Params: this.portalsCoreSvc.getRouterQueryParams(contentType)
			})),
			{ Title: await this.configSvc.getResourceAsync("portals.sidebar.titles.contents") },
			onNext
		);
	}

	private updateSidebarWithCategoriesAsync(parent?: Category, expandedID?: string, onNext?: () => void) {
		if (parent !== undefined) {
			this._sidebarCategory = parent;
			this._sidebarContentType = this._sidebarContentType || this.getDefaultContentTypeOfContent(parent.module);
			const info = this.getSidebarItems(parent.Children, parent, expandedID);
			return AppUtility.invoke(() => this.updateSidebar(info.Items, info.Parent, onNext));
		}
		else {
			const contentType = this.getDefaultContentTypeOfCategory(this.portalsCoreSvc.activeModule);
			if (contentType !== undefined) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = this._sidebarContentType || this.getDefaultContentTypeOfContent(this.portalsCoreSvc.activeModule);
				return this.searchCategoryAsync(
					AppPagination.buildRequest(
						{ And: [
							{ SystemID: { Equals: contentType.SystemID } },
							{ RepositoryID: { Equals: contentType.RepositoryID } },
							{ RepositoryEntityID: { Equals: contentType.ID } },
							{ ParentID: "IsNull" }
						]},
						{ OrderIndex: "Ascending", Title: "Ascending" }
					),
					data => {
						const categories = data !== undefined
							? Category.toArray(data.Objects)
							: Category.instances.toArray(category => category.SystemID === contentType.SystemID && category.RepositoryID === contentType.RepositoryID && category.ParentID === undefined).sortBy("OrderIndex", "Title");
						const info = this.getSidebarItems(categories, parent, expandedID);
						this.updateSidebar(info.Items, info.Parent, onNext);
					}
				);
			}
			else {
				return AppUtility.invoke(onNext);
			}
		}
	}

	private getSidebarItems(categories: Array<Category>, parent?: Category, expandedID?: string): { Parent: AppSidebarMenuItem; Items: AppSidebarMenuItem[] } {
		const expand: (menuItem: AppSidebarMenuItem, parentID?: string, dontUpdateExpaned?: boolean) => void = (menuItem, parentID, dontUpdateExpanded) => {
			if (parentID === undefined) {
				if (!dontUpdateExpanded) {
					menuItem.Expanded = !menuItem.Expanded;
				}
				menuItem.Icon = {
					Name: menuItem.Expanded ? "chevron-down" : "chevron-forward",
					Color: "medium",
					Slot: "end"
				};
			}
			else {
				this.updateSidebarWithCategoriesAsync(Category.get(parentID), menuItem.ID);
			}
		};

		const getItem: (category: Category, onCompleted: (item: AppSidebarMenuItem) => void) => AppSidebarMenuItem = (category, onCompleted) => {
			const item: AppSidebarMenuItem = {
				ID: category.ID,
				Title: category.Title,
				Link: this.portalsCoreSvc.getRouterLink(this._sidebarContentType, "list", category.ansiTitle),
				Params: this.portalsCoreSvc.getRouterQueryParams(this._sidebarContentType, { CategoryID: category.ID }),
				Expanded: category.ID === expandedID,
				OnClick: (data: { menuIndex: number; itemIndex: number; childIndex?: number; expand?: boolean; }, sidebar: AppSidebar, event: Event) => {
					const menuItem = data.childIndex !== undefined
						? sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].Children[data.childIndex]
						: sidebar.MainMenu[data.menuIndex].Items[data.itemIndex];
					if (AppUtility.isTrue(data.expand)) {
						event.stopPropagation();
						expand(menuItem, data.childIndex === undefined ? undefined : sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].ID);
					}
					else {
						if (menuItem.Children !== undefined && menuItem.Children.length > 0) {
							expand(menuItem, data.childIndex === undefined ? undefined : sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].ID, menuItem.Expanded);
						}
						this.configSvc.navigateAsync(menuItem.Direction, menuItem.Link, menuItem.Params);
					}
				}
			};
			onCompleted(item);
			return item;
		};

		const getChildren: (childrenCategories: Array<Category>) => Array<AppSidebarMenuItem>
			= childrenCategories => childrenCategories.map(category => getItem(category, item => item.Children = category.childrenIDs !== undefined && category.childrenIDs.length > 0 ? getChildren(category.Children) : []));

		return {
			Parent: {
				ID: parent === undefined ? undefined : parent.ID,
				Title: parent === undefined ? "{{portals.sidebar.titles.categories}}" : parent.Title,
				Link: parent === undefined ? undefined : this.portalsCoreSvc.getRouterLink(this._sidebarContentType, "list", parent.ansiTitle),
				Params: parent === undefined ? undefined : this.portalsCoreSvc.getRouterQueryParams(this._sidebarContentType, { CategoryID: parent.ID }),
				Expanded: parent !== undefined,
				OnClick: menuItem => this.updateSidebarWithCategoriesAsync(this._sidebarCategory !== undefined ? this._sidebarCategory.Parent : undefined, this._sidebarCategory !== undefined ? this._sidebarCategory.ID : menuItem.ID),
			} as AppSidebarMenuItem,
			Items: categories.map(category => getItem(category, item => item.Children = category.childrenIDs !== undefined && category.childrenIDs.length > 0 ? getChildren(category.Children) : []))
		};
	}

	private processContentTypeUpdateMessage(message: AppMessage) {
		if (this._sidebarContentType === undefined && message.Data.ContentTypeDefinitionID !== "B0000000000000000000000000000001" && message.Data.ContentTypeDefinitionID !== "B0000000000000000000000000000002") {
			this.updateSidebarWithContentTypesAsync();
		}
	}

	private getFeaturedContentsAsync(contentTypes: Array<ContentType>, index: number) {
		const contentType = contentTypes[index];
		const isCmsItem = contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000002";
		const request = AppPagination.buildRequest(
			{ And: [
				{ SystemID: { Equals: contentType.SystemID } },
				{ RepositoryID: { Equals: contentType.RepositoryID } },
				{ RepositoryEntityID: { Equals: contentType.ID } }
			]},
			isCmsItem ? { LastModified: "Descending" } : { StartDate: "Descending", PublishedTime: "Descending", LastModified: "Descending" }
		);
		const onSuccess = (data?: any) => {
			if (index < contentTypes.length - 1) {
				AppUtility.invoke(() => this.getFeaturedContentsAsync(contentTypes, index + 1));
			}
			if (data !== undefined && AppUtility.isArray(data.Objects, true) && AppUtility.isGotData(data.Objects)) {
				this.prepareFeaturedContents(data.Objects.first().SystemID);
			}
		};
		const onError = (error?: any) => {
			const organization = Organization.get(contentType.SystemID);
			this.showError(`Error occurred while preparing featured contents\n${contentType.Title} @ ${organization.Title}`, error);
			onSuccess();
		};
		return isCmsItem ? this.searchItemAsync(request, onSuccess, onError) : this.searchContentAsync(request, onSuccess, onError);
	}

	private prepareFeaturedContents(systemID: string) {
		const cmsItems = Item.instances.toArray(item => item.SystemID === systemID);
		const cmsContents = Content.instances.toArray(item => item.SystemID === systemID);
		this._featuredContents.set(systemID, new Dictionary<string, CmsBaseModel>()
			.merge(cmsItems.sortBy({ name: "LastModified", reverse: true }).take(20), content => content.ID)
			.merge(cmsItems.sortBy({ name: "Created", reverse: true }).take(20), content => content.ID)
			.merge(cmsContents.sortBy({ name: "LastModified", reverse: true }).take(20), content => content.ID)
			.merge(cmsContents.sortBy({ name: "StartDate", reverse: true }, { name: "PublishedTime", reverse: true }, { name: "LastModified", reverse: true }).take(20), content => content.ID)
			.toArray());
		this._noContents.remove(systemID);
		AppEvents.broadcast(this.name, { Type: "FeaturedContents", Mode: "Prepared", ID: systemID });
}

	private async prepareFeaturedContentsAsync(allActiveOrganizations: boolean = true) {
		if (this.configSvc.isAuthenticated) {
			const activeOrganization = await this.portalsCoreSvc.getActiveOrganizationAsync();
			if (activeOrganization !== undefined) {
				const activeContentTypes = new Array<ContentType>();
				activeOrganization.modules.forEach(module => activeContentTypes.merge(this.getContentTypesOfContent(module)).merge(this.getContentTypesOfItem(module)));
				AppUtility.invoke(activeContentTypes.length > 0 ? () => this.getFeaturedContentsAsync(activeContentTypes, 0) : undefined);
			}
			if (allActiveOrganizations) {
				const availableOrganizations = await this.portalsCoreSvc.getActiveOrganizationsAsync();
				if (activeOrganization !== undefined) {
					availableOrganizations.removeAt(availableOrganizations.findIndex(org => org.ID === activeOrganization.ID));
				}
				const availableContentTypes = new Array<ContentType>();
				availableOrganizations.forEach(organization => organization.modules.forEach(module => availableContentTypes.merge(this.getContentTypesOfContent(module)).merge(this.getContentTypesOfItem(module))));
				AppUtility.invoke(availableContentTypes.length > 0 ? () => this.getFeaturedContentsAsync(availableContentTypes, 0) : undefined, 6789);
			}
		}
	}

	public getContentTypesOfCategory(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000001");
	}

	public getDefaultContentTypeOfCategory(module: Module) {
		return this.getContentTypesOfCategory(module).first();
	}

	public get categoryCompleterDataSource() {
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

	public searchCategory(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.category", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processCategories(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching categories", error, onError)
		);
	}

	public searchCategoryAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.category", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processCategories(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching categories", error, onError)
		);
	}

	public createCategoryAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
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

	public getCategoryAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
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

	public updateCategoryAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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

	public deleteCategoryAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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

	public refreshCategoryAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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
			true,
			headers
		);
	}

	private processCategoryUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				this.updateCategory(message.Data);
				if (this._sidebarContentType !== undefined) {
					const parentCategory = Category.get(message.Data.ParentID);
					if (this._sidebarCategory === parentCategory) {
						this.updateSidebarWithCategoriesAsync(parentCategory);
					}
				}
				break;

			case "Delete":
				this.deleteCategory(message.Data.ID, message.Data.ParentID);
				break;

			default:
				this.showLog("Got an update message of a CMS category", message);
				break;
		}

		if (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete") {
			AppEvents.broadcast(this.name, { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			if (AppUtility.isNotEmpty(message.Data.ParentID)) {
				AppEvents.broadcast(this.name, { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			}
		}
	}

	public processCategories(categories: Array<any>, fetchDesktops: boolean = false) {
		categories.forEach(data => {
			let category = Category.get(data.ID);
			if (category === undefined) {
				category = Category.update(data);
				this.fetchCategory(category);
			}
			else if (category.childrenIDs === undefined) {
				this.fetchCategory(category);
			}
			if (fetchDesktops) {
				this.fetchCategoryDesktops(category);
			}
		});
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
			const category = Category.set(Category.deserialize(json, Category.get(json.ID)));
			category.childrenIDs = AppUtility.isArray(json.Children, true)
				? (json.Children as Array<any>).map(o => this.updateCategory(o)).filter(o => o !== undefined).map(o => o.ID).distinct()
				: [];
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

	public fetchCategoryDesktops(category: Category) {
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

	public getContentTypesOfContent(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000002");
	}

	public getDefaultContentTypeOfContent(module: Module) {
		return this.getContentTypesOfContent(module).first();
	}

	public get contentCompleterDataSource() {
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

	public searchContent(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Content.update(obj));
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching contents", error, onError)
		);
	}

	public searchContentAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true) && AppUtility.isGotData(data.Objects)) {
					(data.Objects as Array<any>).forEach(obj => Content.update(obj));
					this._noContents.remove(data.Objects.first().SystemID);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching contents", error, onError)
		);
	}

	public createContentAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
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

	public getContentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
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

	public updateContentAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("cms.content", body.ID),
			body,
			data => {
				Content.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating a content", error, onError)
		);
	}

	public deleteContentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.deleteAsync(
			this.getPath("cms.content", id),
			data => {
				Content.instances.remove(data.ID);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting a content", error, onError),
			headers
		);
	}

	public refreshContentAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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
			true,
			headers
		);
	}

	private processContentUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Content.update(message.Data);
				this._noContents.remove(message.Data.SystemID);
				break;

			case "Delete":
				Content.instances.remove(message.Data.ID);
				break;

			default:
				this.showLog("Got an update message of a CMS content", message);
				break;
		}

		if (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete") {
			AppEvents.broadcast(this.name, { Object: "CMS.Content", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID, CategoryID: message.Data.CategoryID });
			if (AppUtility.isArray(message.Data.OtherCategories)) {
				(message.Data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.name, { Object: "CMS.Content", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID, CategoryID: categoryID }));
			}
			if (this.configSvc.isAuthenticated) {
				this.prepareFeaturedContents(message.Data.SystemID);
			}
		}
	}

	public getContentTypesOfItem(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000003");
	}

	public getDefaultContentTypeOfItem(module: Module) {
		return this.getContentTypesOfItem(module).first();
	}

	public get itemCompleterDataSource() {
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

	public searchItem(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Item.update(obj));
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching items", error, onError)
		);
	}

	public searchItemAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true) && AppUtility.isGotData(data.Objects)) {
					(data.Objects as Array<any>).forEach(obj => Item.update(obj));
					this._noContents.remove(data.Objects.first().SystemID);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching items", error, onError)
		);
	}

	public createItemAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
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

	public async getItemAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
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

	public updateItemAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
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

	public deleteItemAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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

	public refreshItemAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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
			true,
			headers
		);
	}

	private processItemUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Item.update(message.Data);
				this._noContents.remove(message.Data.SystemID);
				break;

			case "Delete":
				Item.instances.remove(message.Data.ID);
				break;

			default:
				this.showLog("Got an update message of a CMS item", message);
				break;
		}

		if (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete") {
			AppEvents.broadcast(this.name, { Object: "CMS.Item", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
			if (this.configSvc.isAuthenticated) {
				this.prepareFeaturedContents(message.Data.SystemID);
			}
		}
	}

	public getContentTypesOfLink(module: Module) {
		return (module || new Module()).contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000004");
	}

	public getDefaultContentTypeOfLink(module: Module) {
		return this.getContentTypesOfLink(module).first();
	}

	public get linkCompleterDataSource() {
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

	public searchLink(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("cms.link", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processLinks(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching links", error, onError)
		);
	}

	public searchLinkAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("cms.link", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processLinks(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching links", error, onError)
		);
	}

	public createLinkAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
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

	public async getLinkAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
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

	public updateLinkAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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

	public deleteLinkAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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

	public refreshLinkAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
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
			true,
			headers
		);
	}

	private processLinkUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				this.updateLink(message.Data);
				break;

			case "Delete":
				this.deleteLink(message.Data.ID, message.Data.ParentID);
				break;

			default:
				this.showLog("Got an update message of a CMS link", message);
				break;
		}

		if (message.Type.Event === "Create" || message.Type.Event === "Update" || message.Type.Event === "Delete") {
			AppEvents.broadcast(this.name, { Object: "CMS.Link", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined });
			if (AppUtility.isNotEmpty(message.Data.ParentID)) {
				AppEvents.broadcast(this.name, { Object: "CMS.Link", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined });
			}
		}
	}

	public processLinks(links: Array<any>) {
		links.forEach(data => {
			const link = Link.get(data.ID);
			if (link === undefined) {
				this.fetchLink(Link.update(data));
			}
			else if (link.childrenIDs === undefined) {
				this.fetchLink(link);
			}
		});
	}

	private fetchLink(link: Link) {
		if (link !== undefined && link.childrenIDs === undefined) {
			this.getLinkAsync(link.ID, _ => {
				const obj = Link.get(link.ID);
				if (obj.childrenIDs !== undefined && obj.childrenIDs.length > 0) {
					obj.Children.forEach(cobj => this.fetchLink(cobj));
				}
			});
		}
		return link;
	}

	private updateLink(json: any, parentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const link = Link.set(Link.deserialize(json, Link.get(json.ID)));
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
		}
	}

}
