import { AppConfig } from "../app.config";
import { AppUtility } from "@components/app.utility";
import { AppEvents } from "@components/app.events";
import { AttachmentInfo } from "@models/base";
import { PortalBase as BaseModel } from "@models/portals.base";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";

/** Abstract class for all portals' core entity classes */
export abstract class PortalCmsBase extends BaseModel {

	constructor() {
		super();
	}

	public static get ModuleDefinitions() {
		return BaseModel.ModuleDefinitions;
	}

	public static get ContentTypeDefinitions() {
		return BaseModel.ContentTypeDefinitions;
	}

	public abstract SystemID: string;
	public abstract RepositoryID: string;
	public abstract RepositoryEntityID: string;
	protected _thumbnails: AttachmentInfo[];
	protected _attachments: AttachmentInfo[];

	public get Organization() {
		const organization = AppUtility.isNotEmpty(this.SystemID) ? Organization.get(this.SystemID) : undefined;
		if (organization === undefined && AppUtility.isNotEmpty(this.SystemID)) {
			AppEvents.broadcast("Portals", { Object: "Organization", Type: "RequestInfo", ID: this.SystemID });
		}
		return organization;
	}

	public get Module() {
		const module = AppUtility.isNotEmpty(this.RepositoryID) ? Module.get(this.RepositoryID) : undefined;
		if (module === undefined && AppUtility.isNotEmpty(this.RepositoryID)) {
			AppEvents.broadcast("Portals", { Object: "Module", Type: "RequestInfo", ID: this.RepositoryID });
		}
		return module;
	}

	public get ContentType() {
		const contentType = AppUtility.isNotEmpty(this.RepositoryEntityID) ? ContentType.get(this.RepositoryEntityID) : undefined;
		if (contentType === undefined && AppUtility.isNotEmpty(this.RepositoryEntityID)) {
			AppEvents.broadcast("Portals", { Object: "ContentType", Type: "RequestInfo", ID: this.RepositoryEntityID });
		}
		return contentType;
	}

	public get ModuleDefinition() {
		return (this.Module || new Module()).ModuleDefinition;
	}

	public get ContentTypeDefinition() {
		return (this.ContentType || new ContentType()).ContentTypeDefinition;
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

	public updateThumbnails(thumbnails: AttachmentInfo[]) {
		this._thumbnails = thumbnails;
	}

	public updateAttachments(attachments: AttachmentInfo[]) {
		this._attachments = attachments;
	}

}
