import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { PortalBase as BaseModel, NotificationSettings, EmailSettings } from "@app/models/portals.base";
import { ExtendedPropertyDefinition, ExtendedControlDefinition, StandardControlDefinition } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";

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
	ExtendedControlDefinitions = undefined as Array<ExtendedControlDefinition>;
	StandardControlDefinitions = undefined as Array<StandardControlDefinition>;
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
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(contentType: ContentType) {
		return contentType === undefined ? undefined : this.instances.add(contentType.ID, contentType);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof ContentType ? data as ContentType : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	public static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	public static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
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
