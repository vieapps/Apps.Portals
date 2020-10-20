import { Injectable } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { AppRTU, AppXHR, AppMessage } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppPagination } from "@app/components/app.pagination";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { FilesService, FileOptions } from "@app/services/files.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { AppFormsService, AppFormsControlConfig, AppFormsControlLookupOptionsConfig } from "@app/components/forms.service";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { FilesProcessorModalPage } from "@app/controls/common/file.processor.modal.page";
import { Account } from "@app/models/account";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";
import { Desktop } from "@app/models/portals.core.desktop";
import { AttachmentInfo } from "@app/models/base";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";
import { Category } from "@app/models/portals.cms.category";
import { Content } from "@app/models/portals.cms.content";
import { Item } from "@app/models/portals.cms.item";
import { Link } from "@app/models/portals.cms.link";

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

	private initialize() {
		AppRTU.registerAsObjectScopeProcessor(this.name, "Category", message => this.processCategoryUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "CMS.Category", message => this.processCategoryUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Cms.Category", message => this.processCategoryUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Content", message => this.processContentUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "CMS.Content", message => this.processContentUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Cms.Content", message => this.processContentUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Item", message => this.processItemUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "CMS.Item", message => this.processItemUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Cms.Item", message => this.processItemUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Link", message => this.processLinkUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "CMS.Link", message => this.processLinkUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Cms.Link", message => this.processLinkUpdateMessage(message));
		AppRTU.registerAsServiceScopeProcessor(this.filesSvc.name, message => this.processAttachmentUpdateMessage(message));
		AppEvents.on(this.name, async info => {
			if (AppUtility.isEquals(info.args.Mode, "UpdateSidebarWithContentTypes")) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				await this.updateSidebarWithContentTypesAsync(() => AppEvents.broadcast("ActiveSidebar", { name: "cms" }));
			}
			else if (AppUtility.isEquals(info.args.Mode, "UpdateSidebarWithCategories")) {
				if (AppUtility.isNotEmpty(info.args.ContentTypeID)) {
					if (this._sidebarContentType === undefined || this._sidebarContentType.ID !== info.args.ContentTypeID) {
						this._sidebarContentType = ContentType.get(info.args.ContentTypeID);
						if (this._sidebarContentType !== undefined) {
							await this.updateSidebarWithCategoriesAsync(undefined, () => AppEvents.broadcast("ActiveSidebar", { name: "cms" }));
						}
					}
					else {
						AppEvents.broadcast("ActiveSidebar", { name: "cms" });
					}
				}
				else if (this._sidebarContentType === undefined) {
					await this.updateSidebarWithCategoriesAsync(undefined, () => AppEvents.broadcast("ActiveSidebar", { name: "cms" }));
				}
			}
			else if (AppUtility.isEquals(info.args.Type, "Changed") && (AppUtility.isEquals(info.args.Object, "Organization") || AppUtility.isEquals(info.args.Object, "Changed"))) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = undefined;
				await this.updateSidebarWithCategoriesAsync(undefined, () => AppEvents.broadcast("ActiveSidebar", { name: "cms" }));
			}
		});
		AppRTU.registerAsObjectScopeProcessor(this.name, "ContentType", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Content.Type", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.ContentType", message => this.processContentTypeUpdateMessage(message));
		AppRTU.registerAsObjectScopeProcessor(this.name, "Core.Content.Type", message => this.processContentTypeUpdateMessage(message));
	}

	public async initializeAsync(onNext?: () => void) {
		if (this._oembedProviders === undefined) {
			const oembedProviders = await AppXHR.makeRequest("GET", this.configSvc.appConfig.URIs.apis + "statics/oembed.providers.json").toPromise() as Array<{ name: string; schemes: string[], pattern: { expression: string; position: number; html: string } }>;
			this._oembedProviders = oembedProviders.map(oembedProvider => {
				return {
					name: oembedProvider.name,
					schemes: oembedProvider.schemes.map(scheme => AppUtility.toRegExp(`/${scheme}/i`)),
					pattern: {
						expression: AppUtility.toRegExp(`/${oembedProvider.pattern.expression}/i`),
						position: oembedProvider.pattern.position,
						html: oembedProvider.pattern.html
					}
				};
			});
			if (this.configSvc.isDebug) {
				console.log("[CMS Portals]: The providers of OEmbed medias were initialized", this._oembedProviders);
			}
		}

		if (Module.active === undefined) {
			await this.portalsCoreSvc.getActiveModuleAsync(undefined, true, () => {
				if (this.configSvc.isDebug) {
					console.log("[CMS Portals]: The active module was fetched", Module.active);
				}
			});
		}

		const activeModule = this.portalsCoreSvc.activeModule;
		if (this.getDefaultContentTypeOfCategory(activeModule) !== undefined) {
			await this.updateSidebarWithCategoriesAsync(undefined, onNext);
		}
		else if (activeModule !== undefined) {
			await this.updateSidebarWithContentTypesAsync(onNext);
		}
		AppEvents.broadcast("ActiveSidebar", { name: activeModule !== undefined && activeModule.contentTypes.length > 0 ? "cms" : "portals"});
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

	public lookup(objectName: string, request: any, onNext: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.portalsCoreSvc.lookup(objectName, request, onNext, onError, headers);
	}

	public async lookupAsync(objectName: string, request: any, onNext: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.portalsCoreSvc.lookupAsync(objectName, request, onNext, onError, headers);
	}

	public async getAsync(objectName: string, id: string, onNext: (data: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.portalsCoreSvc.getAsync(objectName, id, onNext, onError, headers);
	}

	public getFileOptions(object: CmsBaseModel, onCompleted?: (fileOptions: FileOptions) => void) {
		if (object !== undefined) {
			const fileOptions = {
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
			} as FileOptions;
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
					OnClick: (_, formControl) => PlatformUtility.openURI(formControl instanceof AppFormsControlComponent ? (formControl as AppFormsControlComponent).text : formControl.value)
				}
			}
		};
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public setLookupOptions(lookupOptions: AppFormsControlLookupOptionsConfig, lookupModalPage: any, contentType: ContentType, multiple?: boolean, nested?: boolean, onPreCompleted?: (options: AppFormsControlLookupOptionsConfig) => void) {
		this.portalsCoreSvc.setLookupOptions(lookupOptions, lookupModalPage, contentType, multiple, nested, onPreCompleted);
	}

	public updateSidebar(items: Array<any>, parent?: any, onNext?: () => void) {
		AppEvents.broadcast("UpdateSidebar", {
			index: 0,
			name: "cms",
			reset: true,
			parent: parent,
			items: items
		});
		if (onNext !== undefined) {
			onNext();
		}
	}

	public updateSidebarWithCategories(categories: Category[], parent?: any, onNext?: () => void) {
		this.updateSidebar(
			categories.map(category => {
				const gotChildren = category.childrenIDs !== undefined && category.childrenIDs.length > 0;
				const onClick: (info: any, sidebar: any) => void = gotChildren
					? async () => await this.updateSidebarWithCategoriesAsync(category)
					: undefined;
				return {
					title: category.Title,
					link: this.portalsCoreSvc.getRouterLink(this._sidebarContentType, "list", category.ansiTitle),
					queryParams: this.portalsCoreSvc.getRouterQueryParams(this._sidebarContentType, { CategoryID: category.ID }),
					detail: gotChildren,
					onClick: onClick
				};
			}),
			parent,
			onNext
		);
	}

	public async updateSidebarWithCategoriesAsync(parent?: Category, onNext?: () => void) {
		if (parent !== undefined) {
			this._sidebarCategory = parent;
			this._sidebarContentType = this._sidebarContentType || this.getDefaultContentTypeOfContent(parent.module);
			this.updateSidebarWithCategories(
				parent.Children,
				{
					title: parent.Title,
					link: this.portalsCoreSvc.getRouterLink(this._sidebarContentType, "list", parent.ansiTitle),
					queryParams: this.portalsCoreSvc.getRouterQueryParams(this._sidebarContentType, { CategoryID: parent.ID }),
					detail: true,
					onClick: async info => await this.updateSidebarWithCategoriesAsync(this._sidebarCategory !== undefined ? this._sidebarCategory.Parent : undefined, async () => await this.configSvc.navigateBackAsync(info.link + "?x-request=" + info.queryParams["x-request"]))
				},
				onNext
			);
		}
		else {
			const contentType = this.getDefaultContentTypeOfCategory(this.portalsCoreSvc.activeModule);
			if (contentType !== undefined) {
				this._sidebarCategory = undefined;
				this._sidebarContentType = this._sidebarContentType || this.getDefaultContentTypeOfContent(this.portalsCoreSvc.activeModule);
				await this.searchCategoryAsync(
					AppPagination.buildRequest(
						{ And: [
							{ SystemID: { Equals: contentType.SystemID } },
							{ RepositoryID: { Equals: contentType.RepositoryID } },
							{ RepositoryEntityID: { Equals: contentType.ID } },
							{ ParentID: "IsNull" }
						]},
						{ OrderIndex: "Ascending", Title: "Ascending" }
					),
					async data => this.updateSidebarWithCategories(
						data !== undefined ? Category.toArray(data.Objects) : Category.instances.toArray(category => category.SystemID === contentType.SystemID && category.ParentID === undefined).sortBy("OrderIndex", "Title"),
						{
							title: await this.configSvc.getResourceAsync("portals.sidebar.cms-categories")
						},
						onNext
					)
				);
			}
			else if (onNext !== undefined) {
				onNext();
			}
		}
	}

	public async updateSidebarWithContentTypesAsync(onNext?: () => void) {
		this.updateSidebar(
			this.portalsCoreSvc.activeModule.contentTypes
				.filter(contentType => contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000001" && contentType.ContentTypeDefinitionID !== "B0000000000000000000000000000002")
				.sortBy("Title")
				.map(contentType => {
					return {
						title: contentType.Title,
						link: this.portalsCoreSvc.getRouterLink(contentType, "list"),
						queryParams: this.portalsCoreSvc.getRouterQueryParams(contentType)
					};
				}),
			{ title: await this.configSvc.getResourceAsync("portals.sidebar.cms-contents") },
			onNext
		);
	}

	private processContentTypeUpdateMessage(message: AppMessage) {
		if (this._sidebarContentType === undefined && message.Data.ContentTypeDefinitionID !== "B0000000000000000000000000000001" && message.Data.ContentTypeDefinitionID !== "B0000000000000000000000000000002") {
			this.updateSidebarWithContentTypesAsync();
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
			term => AppUtility.format(super.getSearchURI("cms.category", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
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

	public searchCategory(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("cms.category", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processCategories(data.Objects as Array<any>);
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching categories", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchCategoryAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("cms.category", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processCategories(data.Objects as Array<any>);
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching categories", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createCategoryAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("cms.category"),
			body,
			data => {
				this.updateCategory(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new category", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getCategoryAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const category = Category.get(id);
		if (category !== undefined && category.childrenIDs !== undefined) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("cms.category", id),
				data => {
					this.updateCategory(data);
					if (this._sidebarContentType !== undefined) {
						const parentCategory = Category.get(data.ParentID);
						if (this._sidebarCategory === parentCategory) {
							this.updateSidebarWithCategoriesAsync(parentCategory);
						}
					}
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a category", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateCategoryAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Category.contains(body.ID) ? Category.get(body.ID).ParentID : undefined;
		await super.updateAsync(
			super.getURI("cms.category", body.ID),
			body,
			data => {
				this.updateCategory(data, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a category", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public async deleteCategoryAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Category.contains(id) ? Category.get(id).ParentID : undefined;
		await super.deleteAsync(
			super.getURI("cms.category", id),
			data => {
				this.deleteCategory(data.ID, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a category", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public async refreshCategoryAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.portalsCoreSvc.refreshAsync(
			"cms.category",
			id,
			data => {
				this.updateCategory(data);
				if (onNext !== undefined) {
					onNext(data);
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
				console.warn(super.getLogMessage("Got an update message of a CMS category"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
		if (AppUtility.isNotEmpty(message.Data.ParentID)) {
			AppEvents.broadcast(this.name, { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
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
			if (AppUtility.isArray(json.Children, true)) {
				category.childrenIDs = (json.Children as Array<any>).map(o => this.updateCategory(o)).filter(o => o !== undefined).map(o => o.ID).distinct();
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
			term => AppUtility.format(super.getSearchURI("cms.content", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => convertToCompleterItem(obj)),
			convertToCompleterItem
		);
	}

	public searchContent(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Content.update(obj));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching contents", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchContentAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Content.update(obj));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching contents", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createContentAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("cms.content"),
			body,
			data => {
				Content.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new content", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getContentAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Content.contains(id)) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("cms.content", id),
				data => {
					Content.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a content", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateContentAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("cms.content", body.ID),
			body,
			data => {
				Content.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a content", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteContentAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await super.deleteAsync(
			super.getURI("cms.content", id),
			data => {
				Content.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a content", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public async refreshContentAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.portalsCoreSvc.refreshAsync("cms.content", id, onNext, onError, true, headers);
	}

	private processContentUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Content.update(message.Data);
				break;

			case "Delete":
				Content.instances.remove(message.Data.ID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a CMS content"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "CMS.Content", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID, CategoryID: message.Data.CategoryID });
		if (AppUtility.isArray(message.Data.OtherCategories)) {
			(message.Data.OtherCategories as Array<string>).forEach(categoryID => AppEvents.broadcast(this.name, { Object: "CMS.Content", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID, CategoryID: categoryID }));
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
			term => AppUtility.format(super.getSearchURI("cms.item", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => convertToCompleterItem(obj)),
			convertToCompleterItem
		);
	}

	public searchItem(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Item.update(obj));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching items", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchItemAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => Item.update(obj));
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching items", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createItemAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("cms.item"),
			body,
			data => {
				Item.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new item", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getItemAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (Item.contains(id)) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("cms.item", id),
				data => {
					Item.update(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting an item", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateItemAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			super.getURI("cms.item", body.ID),
			body,
			data => {
				Item.update(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating an item", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async deleteItemAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await super.deleteAsync(
			super.getURI("cms.item", id),
			data => {
				Item.instances.remove(data.ID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting an item", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public async refreshItemAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.portalsCoreSvc.refreshAsync("cms.item", id, onNext, onError, true, headers);
	}

	private processItemUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				Item.update(message.Data);
				break;

			case "Delete":
				Item.instances.remove(message.Data.ID);
				break;

			default:
				console.warn(super.getLogMessage("Got an update message of a CMS item"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "CMS.Item", Type: `${message.Type.Event}d`, ID: message.Data.ID, SystemID: message.Data.SystemID, RepositoryID: message.Data.RepositoryID, RepositoryEntityID: message.Data.RepositoryEntityID });
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
			term => AppUtility.format(super.getSearchURI("cms.link", this.configSvc.relatedQuery), { request: AppUtility.toBase64Url(AppPagination.buildRequest({ Query: term })) }),
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

	public searchLink(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		return super.search(
			super.getSearchURI("cms.link", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processLinks(data.Objects as Array<any>);
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching links", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async searchLinkAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.searchAsync(
			super.getSearchURI("cms.link", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.processLinks(data.Objects as Array<any>);
				}
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while searching links", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async createLinkAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.createAsync(
			super.getURI("cms.link"),
			body,
			data => {
				this.updateLink(data);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while creating new link", error));
				if (onError !== undefined) {
					onError(error);
				}
			}
		);
	}

	public async getLinkAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		const link = Link.get(id);
		if (link !== undefined && link.childrenIDs !== undefined) {
			if (onNext !== undefined) {
				onNext();
			}
		}
		else {
			await super.readAsync(
				super.getURI("cms.link", id),
				data => {
					this.updateLink(data);
					if (onNext !== undefined) {
						onNext(data);
					}
				},
				error => {
					console.error(super.getErrorMessage("Error occurred while getting a link", error));
					if (onError !== undefined) {
						onError(error);
					}
				},
				undefined,
				useXHR
			);
		}
	}

	public async updateLinkAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Link.contains(body.ID) ? Link.get(body.ID).ParentID : undefined;
		await super.updateAsync(
			super.getURI("cms.link", body.ID),
			body,
			data => {
				this.updateLink(data, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while updating a link", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public async deleteLinkAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		const parentID = Link.contains(id) ? Link.get(id).ParentID : undefined;
		await super.deleteAsync(
			super.getURI("cms.link", id),
			data => {
				this.deleteLink(data.ID, parentID);
				if (onNext !== undefined) {
					onNext(data);
				}
			},
			error => {
				console.error(super.getErrorMessage("Error occurred while deleting a link", error));
				if (onError !== undefined) {
					onError(error);
				}
			},
			headers
		);
	}

	public async refreshLinkAsync(id: string, onNext?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		await this.portalsCoreSvc.refreshAsync(
			"cms.link",
			id,
			data => {
				this.updateLink(data);
				if (onNext !== undefined) {
					onNext(data);
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
				console.warn(super.getLogMessage("Got an update message of a CMS link"), message);
				break;
		}
		AppEvents.broadcast(this.name, { Object: "CMS.Link", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined });
		if (AppUtility.isNotEmpty(message.Data.ParentID)) {
			AppEvents.broadcast(this.name, { Object: "CMS.Link", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined });
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
			if (AppUtility.isArray(json.Children, true)) {
				link.childrenIDs = (json.Children as Array<any>).map(obj => this.updateLink(obj)).filter(obj => obj !== undefined).map(obj => obj.ID).distinct();
			}
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
