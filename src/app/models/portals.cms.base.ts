import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";
import { AppEvents } from "@app/components/app.events";
import { AttachmentInfo } from "@app/models/base";
import { PortalBase as BaseModel } from "@app/models/portals.base";
import { Organization } from "@app/models/portals.core.organization";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";

/** Abstract class for all portals' core entity classes */
export abstract class PortalCmsBase extends BaseModel {

	constructor() {
		super();
	}

	public static get ModuleDefinitions() {
		return BaseModel.moduleDefinitions;
	}

	public static get ContentTypeDefinitions() {
		return BaseModel.contentTypeDefinitions;
	}

	public abstract SystemID: string;
	public abstract RepositoryID: string;
	public abstract RepositoryEntityID: string;
	public abstract Status: string;
	protected _thumbnails: AttachmentInfo[];
	protected _attachments: AttachmentInfo[];

	public get organization() {
		const organization = AppUtility.isNotEmpty(this.SystemID) ? Organization.get(this.SystemID) : undefined;
		if (organization === undefined && AppUtility.isNotEmpty(this.SystemID)) {
			AppEvents.broadcast("Portals", { Object: "Organization", Type: "RequestInfo", ID: this.SystemID });
		}
		return organization;
	}

	public get module() {
		const module = AppUtility.isNotEmpty(this.RepositoryID) ? Module.get(this.RepositoryID) : undefined;
		if (module === undefined && AppUtility.isNotEmpty(this.RepositoryID)) {
			AppEvents.broadcast("Portals", { Object: "Module", Type: "RequestInfo", ID: this.RepositoryID });
		}
		return module;
	}

	public get contentType() {
		const contentType = AppUtility.isNotEmpty(this.RepositoryEntityID) ? ContentType.get(this.RepositoryEntityID) : undefined;
		if (contentType === undefined && AppUtility.isNotEmpty(this.RepositoryEntityID)) {
			AppEvents.broadcast("Portals", { Object: "ContentType", Type: "RequestInfo", ID: this.RepositoryEntityID });
		}
		return contentType;
	}

	public get moduleDefinition() {
		return (this.module || new Module()).moduleDefinition;
	}

	public get contentTypeDefinition() {
		return (this.contentType || new ContentType()).contentTypeDefinition;
	}

	public get thumbnailURI() {
		return this.thumbnails !== undefined && this.thumbnails.length > 0
			? AppUtility.isObject(this.thumbnails[0].URIs, true)
				? this.thumbnails[0].URIs.Direct
				: AppUtility.isNotEmpty(this.thumbnails[0].URI)
					? this.thumbnails[0].URI
					: AppConfig.URIs.files + "thumbnails/no-image.png"
			: AppConfig.URIs.files + "thumbnails/no-image.png";
	}

	public get thumbnails() {
		return this._thumbnails;
	}

	public get attachments() {
		return this._attachments;
	}

	public static normalizeClonedProperties(original: PortalCmsBase, copy: any, onCompleted?: () => void) {
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

	public normalizeExtendedProperties(data: any, onCompleted?: () => void) {
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

	public updateThumbnails(thumbnails: AttachmentInfo[]) {
		this._thumbnails = thumbnails;
	}

	public updateAttachments(attachments: AttachmentInfo[]) {
		this._attachments = attachments;
	}

}
