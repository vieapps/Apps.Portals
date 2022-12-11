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
		return this.thumbnails !== undefined && this.thumbnails.length > 0
			? AppUtility.isObject(this.thumbnails[0].URIs, true)
				? this.thumbnails[0].URIs.Direct
				: AppUtility.isNotEmpty(this.thumbnails[0].URI)
					? this.thumbnails[0].URI
					: `${AppConfig.URIs.files}thumbnails/no-image.png`
			: `${AppConfig.URIs.files}thumbnails/no-image.png`;
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

	updateThumbnails(thumbnails: AttachmentInfo[]) {
		this._thumbnails = thumbnails;
	}

	updateAttachments(attachments: AttachmentInfo[]) {
		this._attachments = attachments;
	}

}
