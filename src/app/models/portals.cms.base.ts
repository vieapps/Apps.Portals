import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";
import { AppEvents } from "@app/components/app.events";
import { AttachmentInfo } from "@app/models/base";
import { PortalBase as BaseModel, Organization, Module, ContentType, SchedulingTask } from "@app/models/portals.core.all";

/** Abstract class for all portals' CMS entity classes */
export abstract class PortalCmsBase extends BaseModel {

	constructor() {
		super();
	}

	static get ModuleDefinitions() {
		return BaseModel.moduleDefinitions;
	}

	static get ContentTypeDefinitions() {
		return BaseModel.contentTypeDefinitions;
	}

	abstract SystemID: string;
	abstract RepositoryID: string;
	abstract RepositoryEntityID: string;
	abstract Status: string;
	public SubTitle: string;
	protected _thumbnails: AttachmentInfo[];
	protected _attachments: AttachmentInfo[];
	private _thumbnailURI: string;

	get organization() {
		const organization = AppUtility.isNotEmpty(this.SystemID) ? Organization.get(this.SystemID) : undefined;
		if (organization === undefined && AppUtility.isNotEmpty(this.SystemID)) {
			AppEvents.broadcast("Portals", { Type: "Info", Mode: "Request", Object: "Organization", ID: this.SystemID });
		}
		return organization;
	}

	get module() {
		const module = AppUtility.isNotEmpty(this.RepositoryID) ? Module.get(this.RepositoryID) : undefined;
		if (module === undefined && AppUtility.isNotEmpty(this.RepositoryID)) {
			AppEvents.broadcast("Portals", { Type: "Info", Mode: "Request", Object: "Module", ID: this.RepositoryID });
		}
		return module;
	}

	get contentType() {
		const contentType = AppUtility.isNotEmpty(this.RepositoryEntityID) ? ContentType.get(this.RepositoryEntityID) : undefined;
		if (contentType === undefined && AppUtility.isNotEmpty(this.RepositoryEntityID)) {
			AppEvents.broadcast("Portals", { Type: "Info", Mode: "Request", Object: "ContentType", ID: this.RepositoryEntityID });
		}
		return contentType;
	}

	get moduleDefinition() {
		return (this.module || new Module()).moduleDefinition;
	}

	get contentTypeDefinition() {
		return (this.contentType || new ContentType()).contentTypeDefinition;
	}

	get objectName() {
		return (this.contentType || new ContentType()).getObjectName(true);
	}

	get thumbnailURI() {
		return this._thumbnailURI !== undefined
			? AppConfig.nothumbnailURI
			: PortalCmsBase.getThumbnailURI(this.thumbnails) || AppConfig.nothumbnailURI;
	}

	get thumbnails() {
		return this._thumbnails;
	}

	get attachments() {
		return this._attachments;
	}

	get updatingTask() {
		return SchedulingTask.instances.first(task => task.ObjectID === this.ID && task.SchedulingType === "Update" && task.Status === "Awaiting");
	}

	static normalizeClonedProperties(original: PortalCmsBase, copy: any, onCompleted?: () => void) {
		const tags = original["Tags"];
		if (AppUtility.isNotEmpty(tags)) {
			copy["Tags"] = AppUtility.toStr(AppUtility.toArray(tags, ","), ", ");
		}
		const contentType = original.contentType;
		if (contentType !== undefined && AppUtility.isArray(contentType.ExtendedPropertyDefinitions, true)) {
			if (AppUtility.isNotEmpty(original.ID)) {
				contentType.ExtendedPropertyDefinitions.filter(definition => definition.Mode === "DateTime").forEach(definition => {
					const ctrl = contentType.ExtendedControlDefinitions.first(def => def.Name === definition.Name);
					copy[definition.Name] = ctrl !== undefined && ctrl.DatePickerWithTimes === true
						? AppUtility.toIsoDateTime(new Date(original[definition.Name]), true)
						: AppUtility.toIsoDate(new Date(original[definition.Name]));
				});
			}
			else {
				contentType.ExtendedPropertyDefinitions.filter(definition => AppUtility.isNotNull(definition.DefaultValue)).forEach(definition => {
					let value: any = definition.DefaultValue;
					switch (definition.Mode) {
						case "YesNo":
							value = definition.DefaultValue.toLowerCase() === "true";
							break;
						case "DateTime":
							value = new Date(definition.DefaultValue);
							break;
						case "IntegralNumber":
						case "FloatingPointNumber":
							value = +definition.DefaultValue;
							break;
					}
					copy[definition.Name] = value;
				});
			}
		}
		if (onCompleted !== undefined) {
			onCompleted();
		}
	}

	static getThumbnailURI(thumbnails: AttachmentInfo[]) {
		return AppConfig.getThumbnailURI(thumbnails !== undefined && !!thumbnails.length ? AppUtility.isObject(thumbnails[0].URIs, true)	? thumbnails[0].URIs.Direct : AppUtility.isNotEmpty(thumbnails[0].URI) ? thumbnails[0].URI : undefined : undefined);
	}

	normalizeExtendedProperties(data: any, onCompleted?: () => void) {
		const contentType = this.contentType;
		if (contentType !== undefined && AppUtility.isArray(contentType.ExtendedPropertyDefinitions, true)) {
			contentType.ExtendedPropertyDefinitions.forEach(definition => {
				let value = data[definition.Name];
				if (AppUtility.isNull(value) && AppUtility.isNotNull(definition.DefaultValue)) {
					switch (definition.Mode) {
						case "YesNo":
							value = definition.DefaultValue.toLowerCase() === "true";
							break;
						case "DateTime":
							value = new Date(definition.DefaultValue);
							break;
						case "IntegralNumber":
						case "FloatingPointNumber":
							value = +definition.DefaultValue;
							break;
					}
				}
				else if (definition.Mode === "DateTime" && AppUtility.isNotEmpty(value)) {
					value = new Date(value);
				}
				this[definition.Name] = value;
			});
		}
		if (onCompleted !== undefined) {
			onCompleted();
		}
	}

	updateThumbnails(thumbnails: AttachmentInfo[], onLoaded?: (uri: string) => void, onCompleted?: () => void) {
		this._thumbnailURI = PortalCmsBase.getThumbnailURI(thumbnails);
		if (this._thumbnailURI !== undefined) {
			AppUtility.invoke(() => {
				const image = new Image();
				image.onload = () => {
					if (onLoaded !== undefined) {
						onLoaded(this._thumbnailURI);
					}
					this._thumbnailURI = undefined;
				};
				image.src = this._thumbnailURI;
			}, 456);
		}
		this._thumbnails = thumbnails;
		if (onCompleted !== undefined) {
			onCompleted();
		}
	}

	updateAttachments(attachments: AttachmentInfo[], onCompleted?: () => void) {
		this._attachments = attachments;
		if (onCompleted !== undefined) {
			onCompleted();
		}
	}

}

export interface FeaturedContent {
	ID: string;
	Title: string;
	Status: string;
	ThumbnailURI: string;
	Created: Date;
	LastModified: Date;
	StartDate: Date;
	PublishedTime: Date;
	SystemID: string;
	Category: string;
	CategoryTitle: string;
	ContentType: string;
	OriginalObject: PortalCmsBase;
}
