import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { PortalBase as BaseModel, NotificationSettings, EmailSettings, WebHookNotificationSettings, WebHookSettings } from "@app/models/portals.base";
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
	static instances = new Dictionary<string, ContentType>();

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
	WebHookNotifications = undefined as Array<WebHookNotificationSettings>;
	WebHookAdapters = undefined as Dictionary<string, WebHookSettings>;
	ExtendedPropertyDefinitions = undefined as Array<ExtendedPropertyDefinition>;
	ExtendedControlDefinitions = undefined as Array<ExtendedControlDefinition>;
	StandardControlDefinitions = undefined as Array<StandardControlDefinition>;
	SubTitleFormula = undefined as string;
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
	static deserialize(json: any, contentType?: ContentType) {
		return (contentType || new ContentType()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(contentType: ContentType) {
		return contentType === undefined ? undefined : this.instances.add(contentType.ID, contentType);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof ContentType ? data as ContentType : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	get contentTypeDefinition() {
		return AppUtility.isNotEmpty(this.ContentTypeDefinitionID)
			? (BaseModel.contentTypeDefinitions || []).find(definition => definition.ID === this.ContentTypeDefinitionID)
			: undefined;
	}

	get routerLink() {
		return `/portals/core/content.types/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	getObjectName(includePrefixAndSuffix: boolean = false) {
		const definition = this.contentTypeDefinition;
		return definition !== undefined
			? includePrefixAndSuffix
				? (AppUtility.isNotEmpty(definition.ObjectNamePrefix) ? definition.ObjectNamePrefix : "") + definition.ObjectName + (AppUtility.isNotEmpty(definition.ObjectNameSuffix) ? definition.ObjectNameSuffix : "")
				: definition.ObjectName
			: undefined;
	}

	copy(source: any, onCompleted?: (data: any, instance: ContentType) => void) {
		return super.copy(source, data => {
			if (data.WebHookAdapters !== undefined) {
				this.WebHookAdapters = new Dictionary<string, WebHookSettings>();
				AppUtility.toKeyValuePair(data.WebHookAdapters).forEach(kvp => this.WebHookAdapters.add(kvp.key, kvp.value as WebHookSettings));
			}
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}
