import { Injectable } from "@angular/core";
import { AppRTU, AppMessage } from "@components/app.apis";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { AppCustomCompleter } from "@components/app.completer";
import { AppPagination } from "@components/app.pagination";
import { Base as BaseService } from "@services/base.service";
import { ConfigurationService } from "@services/configuration.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { PortalCmsBase as CmsBaseModel } from "@models/portals.cms.base";
import { Category } from "@models/portals.cms.category";
import { Content } from "@models/portals.cms.content";
import { Item } from "@models/portals.cms.item";
import { Link } from "@models/portals.cms.link";

@Injectable()
export class PortalsCmsService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		super("Portals");
		this.initialize();
	}

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
	}

	public getUrl(object: CmsBaseModel, action?: string, contentType?: ContentType) {
		action = action || "list";
		contentType = contentType || (object !== undefined ? object.ContentType : undefined);
		if (contentType === undefined) {
			return undefined;
		}
		const definition = Organization.ContentTypeDefinitions.find(def => def.ID === contentType.ContentTypeDefinitionID);
		const objectName = AppUtility.isEquals(definition.ObjectName, "Category") ? "categories" : `${definition.ObjectName}s`;
		const title = AppUtility.toURI(object !== undefined ? object.ansiTitle : contentType.ansiTitle);
		const params: { [key: string]: string } = { RepositoryEntityID: contentType.ID };
		if (object !== undefined ) {
			params["ID"] = object.ID;
		}
		return `/portals/cms/${objectName.toLowerCase()}/${action}/${title}?x-request=${AppUtility.toBase64Url(params)}`;
	}

	public getListUrl(contentType: ContentType) {
		return this.getUrl(undefined, "list", contentType);
	}

	public getViewUrl(object: CmsBaseModel) {
		return this.getUrl(object, "view");
	}

	public getUpdateUrl(object: CmsBaseModel) {
		return this.getUrl(object, "update");
	}

	public async getActiveModuleAsync(useXHR: boolean = true) {
		if (Module.active === undefined) {
			const preferID: string = this.configSvc.appConfig.options.extras["module"];
			if (AppUtility.isNotEmpty(preferID)) {
				Module.active = Module.get(preferID);
				if (Module.active === undefined) {
					await this.portalsCoreSvc.getModuleAsync(preferID, _ => {
						Module.active = Module.get(preferID);
						if (Module.active !== undefined && !useXHR) {
							AppEvents.broadcast(this.name, { Object: "Module", Type: "Changed", ID: Module.active.ID });
						}
					}, undefined, useXHR);
				}
			}
			else if (Module.instances.size() > 0) {
				Module.active = this.portalsCoreSvc.activeOrganization.Modules.find(module => module.ModuleDefinitionID === "A0000000000000000000000000000001");
				if (Module.active === undefined) {
					Module.active = Module.all[0];
				}
			}
			if (Module.active !== undefined) {
				AppEvents.broadcast(this.name, { Object: "Module", Type: "Changed", ID: Module.active.ID });
			}
		}
		return Module.active;
	}

	public async setActiveModuleAsync(moduleID: string, onNext?: () => void) {
		if (AppUtility.isNotEmpty(moduleID) && Module.contains(moduleID) && (Module.active === undefined || Module.active.ID !== moduleID)) {
			Module.active = Module.get(moduleID);
			this.configSvc.appConfig.options.extras["module"] = Module.active.ID;
			await this.configSvc.storeOptionsAsync();
			AppEvents.broadcast(this.name, { Object: "Module", Type: "Changed", ID: Module.active.ID });
		}
		if (onNext !== undefined) {
			onNext();
		}
		return Module.active;
	}

	public lookup(objectName: string, request: any, onNext: (data: any) => void, headers?: { [header: string]: string }) {
		return super.search(super.getSearchURI(objectName, this.configSvc.relatedQuery), request, onNext, undefined, true, headers);
	}

	public async lookupAsync(objectName: string, request: any, onNext: (data: any) => void, headers?: { [header: string]: string }) {
		await super.searchAsync(super.getSearchURI(objectName, this.configSvc.relatedQuery), request, onNext, undefined, true, false, headers);
	}

	public async getAsync(objectName: string, id: string, onNext: (data: any) => void, headers?: { [header: string]: string }) {
		await super.readAsync(super.getURI(objectName, id), onNext, undefined, headers, true);
	}

	public getContentTypesOfCategory(module: Module) {
		return (module || new Module()).ContentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000001");
	}

	public getDefaultContentTypeOfCategory(module: Module) {
		const contentTypes = this.getContentTypesOfCategory(module);
		return contentTypes.length > 0 ? contentTypes[0] : undefined;
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

	public async updateCategoryAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
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
			}
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

	private processCategoryUpdateMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Create":
			case "Update":
				this.updateCategory(message.Data);
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

	public processCategories(categories: Array<any>) {
		categories.forEach(data => {
			const category = Category.get(data.ID);
			if (category === undefined) {
				this.fetchCategory(Category.update(data));
			}
			else if (category.childrenIDs === undefined) {
				this.fetchCategory(category);
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
				category.childrenIDs = [];
				(json.Children as Array<any>).map(c => this.updateCategory(c)).filter(o => o !== undefined).forEach(o => category.childrenIDs.push(o.ID));
				category.childrenIDs = category.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			let parentCategory = Category.get(parentID);
			if (parentCategory !== undefined && parentCategory.childrenIDs !== undefined && parentCategory.ID !== category.ParentID) {
				AppUtility.removeAt(parentCategory.childrenIDs, parentCategory.childrenIDs.indexOf(category.ID));
			}
			parentCategory = category.Parent;
			if (parentCategory !== undefined && parentCategory.childrenIDs !== undefined && parentCategory.childrenIDs.indexOf(category.ID) < 0) {
				parentCategory.childrenIDs.push(category.ID);
				parentCategory.childrenIDs = parentCategory.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			return category;
		}
		return undefined;
	}

	private deleteCategory(id: string, parentID?: string) {
		if (Category.contains(id)) {
			const parentCategory = Category.get(parentID);
			if (parentCategory !== undefined && parentCategory.childrenIDs !== undefined) {
				AppUtility.removeAt(parentCategory.childrenIDs, parentCategory.childrenIDs.indexOf(id));
			}
			Category.all.filter(category => category.ParentID === id).forEach(category => this.deleteCategory(category.ID));
			Category.instances.remove(id);
		}
	}

	public getContentTypesOfContent(module: Module) {
		return (module || new Module()).ContentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000002");
	}

	public getDefaultContentTypeOfContent(module: Module) {
		const contentTypes = this.getContentTypesOfContent(module);
		return contentTypes.length > 0 ? contentTypes[0] : undefined;
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
		const prePagination = AppPagination.get(request, this.portalsCoreSvc.getPaginationPrefix("cms.content"));
		return super.search(
			super.getSearchURI("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					const postPagination = AppPagination.get(data, this.portalsCoreSvc.getPaginationPrefix("cms.content"));
					if (postPagination !== undefined && postPagination.PageNumber < 4) {
						(data.Objects as Array<any>).forEach(obj => Content.update(obj));
					}
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
			},
			prePagination !== undefined && prePagination.PageNumber > 3
		);
	}

	public async searchContentAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		const prePagination = AppPagination.get(request, this.portalsCoreSvc.getPaginationPrefix("cms.content"));
		await super.searchAsync(
			super.getSearchURI("cms.content", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					const postPagination = AppPagination.get(data, this.portalsCoreSvc.getPaginationPrefix("cms.content"));
					if (postPagination !== undefined && postPagination.PageNumber < 4) {
						(data.Objects as Array<any>).forEach(obj => Content.update(obj));
					}
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
			},
			prePagination !== undefined && prePagination.PageNumber > 3
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
		return (module || new Module()).ContentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000003");
	}

	public getDefaultContentTypeOfItem(module: Module) {
		const contentTypes = this.getContentTypesOfItem(module);
		return contentTypes.length > 0 ? contentTypes[0] : undefined;
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
		const prePagination = AppPagination.get(request, this.portalsCoreSvc.getPaginationPrefix("cms.item"));
		return super.search(
			super.getSearchURI("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					const postPagination = AppPagination.get(data, this.portalsCoreSvc.getPaginationPrefix("cms.item"));
					if (postPagination !== undefined && postPagination.PageNumber < 4) {
						(data.Objects as Array<any>).forEach(obj => Item.update(obj));
					}
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
			},
			prePagination !== undefined && prePagination.PageNumber > 3
		);
	}

	public async searchItemAsync(request: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		const prePagination = AppPagination.get(request, this.portalsCoreSvc.getPaginationPrefix("cms.item"));
		await super.searchAsync(
			super.getSearchURI("cms.item", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					const postPagination = AppPagination.get(data, this.portalsCoreSvc.getPaginationPrefix("cms.item"));
					if (postPagination !== undefined && postPagination.PageNumber < 4) {
						(data.Objects as Array<any>).forEach(obj => Item.update(obj));
					}
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
			},
			prePagination !== undefined && prePagination.PageNumber > 3
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
		return (module || new Module()).ContentTypes.filter(contentType => contentType.ContentTypeDefinitionID === "B0000000000000000000000000000004");
	}

	public getDefaultContentTypeOfLink(module: Module) {
		const contentTypes = this.getContentTypesOfLink(module);
		return contentTypes.length > 0 ? contentTypes[0] : undefined;
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

	public async updateLinkAsync(body: any, onNext?: (data?: any) => void, onError?: (error?: any) => void) {
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
			}
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
				const o = Link.get(link.ID);
				if (o.childrenIDs !== undefined && o.childrenIDs.length > 0) {
					o.Children.forEach(c => this.fetchLink(c));
				}
			});
		}
		return link;
	}

	private updateLink(json: any, parentID?: string) {
		if (AppUtility.isObject(json, true)) {
			const link = Link.set(Link.deserialize(json, Link.get(json.ID)));
			if (AppUtility.isArray(json.Children, true)) {
				link.childrenIDs = [];
				(json.Children as Array<any>).map(c => this.updateLink(c)).filter(o => o !== undefined).forEach(o => link.childrenIDs.push(o.ID));
				link.childrenIDs = link.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			let parentLink = Link.get(parentID);
			if (parentLink !== undefined && parentLink.childrenIDs !== undefined && parentLink.ID !== link.ParentID) {
				AppUtility.removeAt(parentLink.childrenIDs, parentLink.childrenIDs.indexOf(link.ID));
			}
			parentLink = link.Parent;
			if (parentLink !== undefined && parentLink.childrenIDs !== undefined && parentLink.childrenIDs.indexOf(link.ID) < 0) {
				parentLink.childrenIDs.push(link.ID);
				parentLink.childrenIDs = parentLink.childrenIDs.filter((id, index, array) => array.indexOf(id) === index);
			}
			return link;
		}
		return undefined;
	}

	private deleteLink(id: string, parentID?: string) {
		if (Link.contains(id)) {
			const parentLink = Link.get(parentID);
			if (parentLink !== undefined && parentLink.childrenIDs !== undefined) {
				AppUtility.removeAt(parentLink.childrenIDs, parentLink.childrenIDs.indexOf(id));
			}
			Link.all.filter(link => link.ParentID === id).forEach(link => this.deleteLink(link.ID));
			Link.instances.remove(id);
		}
	}

}
