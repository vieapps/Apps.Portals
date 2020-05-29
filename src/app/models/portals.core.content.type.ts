import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { Privileges } from "@models/privileges";
import { PortalBase as BaseModel, NotificationSettings, EmailSettings } from "@models/portals.base";
import { ExtendedPropertyDefinition, ExtendedUIDefinition } from "@models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@models/portals.core.base";

export class ContentType extends CoreBaseModel {

	constructor(
		systemID?: string,
		title?: string,
		privileges?: Privileges
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
		this.OriginalPrivileges = privileges;
	}

	/** All instances of contentType */
	public static instances = new Dictionary<string, ContentType>();

	/** All instances of contentType */
	public static get all() {
		return this.instances.values();
	}

	Title = undefined as string;
	Description = undefined as string;
	DesktopID = undefined as string;
	CreateNewVersionWhenUpdated = true;
	AllowComments = false;
	UseSocialNetworkComments = false;
	DefaultCommentStatus = "Pending";
	Notifications = undefined as NotificationSettings;
	Trackings = undefined as {
		[key: string]: string
	};
	EmailSettings = undefined as EmailSettings;
	ExtendedPropertyDefinitions = undefined as Array<ExtendedPropertyDefinition>;
	ExtendedUIDefinition = undefined as ExtendedUIDefinition;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	RepositoryID = undefined as string;
	ContentTypeDefinitionID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	public static deserialize(json: any, contentType?: ContentType) {
		contentType = contentType || new ContentType();
		contentType.copy(json);
		contentType.ansiTitle = AppUtility.toANSI(contentType.Title).toLowerCase();
		return contentType;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(contentType: ContentType) {
		if (contentType !== undefined) {
			this.instances.setValue(contentType.ID, contentType);
		}
		return contentType;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof ContentType ? data as ContentType : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get routerLink() {
		return `/portals/core/content.types/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get contentTypeDefinition() {
		return AppUtility.isNotEmpty(this.ContentTypeDefinitionID)
			? (BaseModel.contentTypeDefinitions || []).find(definition => definition.ID === this.ContentTypeDefinitionID)
			: undefined;
	}

	public getObjectName(includePrefixAndSuffix: boolean = false) {
		const definition = this.contentTypeDefinition;
		return definition !== undefined
			? includePrefixAndSuffix
				? (AppUtility.isNotEmpty(definition.ObjectNamePrefix) ? definition.ObjectNamePrefix : "") + definition.ObjectName + (AppUtility.isNotEmpty(definition.ObjectNameSuffix) ? definition.ObjectNameSuffix : "")
				: definition.ObjectName
			: undefined;
	}

}
