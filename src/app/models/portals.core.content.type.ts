import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { Privileges } from "@models/privileges";
import { ExtendedPropertyDefinition, ExtendedUIDefinition } from "@models/portals.base";
import { PortalCoreBase as PortalCoreBaseModel } from "@models/portals.core.base";

export class ContentType extends PortalCoreBaseModel {

	constructor(
		organizationID?: string,
		title?: string,
		privileges?: Privileges
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
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
	Notifications = undefined as {
		Events?: Array<string>;
		Methods?: Array<string>;
		Emails?: {
			ToAddresses?: string;
			CcAddresses?: string;
			BccAddresses?: string;
			Subject?: string;
			Body?: string;
		};
		WebHooks?: {
			EndpointURLs?: Array<string>;
			SignAlgorithm?: string;
			SignKey?: string;
			SignatureName?: string;
			SignatureAsHex?: boolean;
			SignatureInQuery?: boolean;
			AdditionalQuery?: string;
			AdditionalHeader?: string;
		};
	};
	Trackings = undefined as {
		[key: string]: string
	};
	EmailSettings = undefined as {
		Sender?: string;
		Signature?: string;
		Smtp?: {
			Host?: string;
			Port?: number;
			EnableSsl?: boolean;
			User?: string;
			UserPassword?: string;
		}
	};
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

	public get ContentTypeDefinition() {
		return (PortalCoreBaseModel.ContentTypeDefinitions || []).find(definition => definition.ID === this.ContentTypeDefinitionID);
	}

}
