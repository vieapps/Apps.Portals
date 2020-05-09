import { Dictionary } from "typescript-collections";
import { List } from "linqts";
import { Injectable } from "@angular/core";
import { AppStorage } from "@components/app.storage";
import { AppRTU, AppMessage } from "@components/app.apis";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { PlatformUtility } from "@components/app.utility.platform";
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
	}

	public getUrl(object: CmsBaseModel, action?: string, contentType?: ContentType) {
		action = action || "list";
		contentType = contentType || (object !== undefined ? object.ContentType : undefined);
		if (contentType === undefined) {
			return undefined;
		}
		const definition = Organization.ContentTypeDefinitions.find(def => def.ID === contentType.ContentTypeDefinitionID);
		const objectName = AppUtility.isEquals(definition.ObjectName, "Category") ? "categories" : definition.ObjectName + "s";
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
					(data.Objects as Array<any>).forEach(obj => {
						const category = Category.get(obj.ID);
						if (category === undefined) {
							this.fetchCategory(Category.update(obj));
						}
						else if (category.childrenIDs === undefined) {
							this.fetchCategory(category);
						}
					});
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
					(data.Objects as Array<any>).forEach(obj => {
						const category = Category.get(obj.ID);
						if (category === undefined) {
							this.fetchCategory(Category.update(obj));
						}
						else if (category.childrenIDs === undefined) {
							this.fetchCategory(category);
						}
					});
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
				this.deleteCategory(data, parentID);
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
				console.warn(super.getLogMessage("Got an update message of a category"), message);
				break;
		}
		AppEvents.broadcast("Portals", { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: AppUtility.isNotEmpty(message.Data.ParentID) ? message.Data.ParentID : undefined });
		if (AppUtility.isNotEmpty(message.Data.ParentID)) {
			AppEvents.broadcast("Portals", { Object: "CMS.Category", Type: `${message.Type.Event}d`, ID: message.Data.ID, ParentID: undefined });
		}
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

}
