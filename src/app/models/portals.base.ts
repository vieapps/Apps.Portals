import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";
import { Base as BaseModel } from "@app/models/base";
import { AttachmentInfo } from "@app/models/base";

/** Abstract class for all portals' entity classes */
export abstract class PortalBase extends BaseModel {

	constructor() {
		super();
	}

	/** Get the collection of all approval statuses */
	static approvalStatus = ["Draft", "Pending", "Rejected", "Approved", "Published", "Archieved"];

	/** Get the collection of all module definitions */
	static moduleDefinitions: ModuleDefinition[];

	/** Get the collection of all content-type definition */
	static get contentTypeDefinitions() {
		return (this.moduleDefinitions || []).map(definition => definition.ContentTypeDefinitions).flatMap(definitions => definitions);
	}

	/** Gets URI of 'no-thumbnail' image */
	static get noThumbnailURI() {
		return `${AppConfig.URIs.files}thumbnails/no-image.png`;
	}

	/** Gets URI of a thumbnail image */
	static getThumbnailURI(data: Array<AttachmentInfo> | AttachmentInfo | string, isAttachment: boolean = false) {
		let uri: string;
		const settings = AppConfig.options.thumbnails || AppConfig.defaultOptions.thumbnails;
		const attachment = data === undefined || typeof data === "string"
			? undefined
			: AppUtility.isArray(data, true)
				? (data as Array<AttachmentInfo>).first()
				: data as AttachmentInfo;
		if (attachment !== undefined) {
			if (isAttachment) {
				return AppConfig.URIs.files + (settings.preferWebP ? "thumbnailwebps/" : "thumbnails/") + (AppUtility.isNotEmpty(attachment.SystemID) ? attachment.SystemID : attachment.ServiceName) + `/1/${settings.width}/0/${attachment.ID}/${encodeURIComponent(attachment.Filename)}` + (settings.preferWebP && !attachment.Filename.endsWith(".webp") ? ".webp" : "");
			}
			uri = AppUtility.isObject(attachment, true)
				? AppUtility.isObject(attachment.URIs, true)
					? attachment.URIs.Direct
					: AppUtility.isNotEmpty(attachment.URI)
						? attachment.URI
						: undefined
				: undefined;
		}
		else {
			uri = data as string;
		}
		if (AppUtility.isNotEmpty(uri)) {
			if (settings.preferWebP) {
				uri = uri.replace("/thumbnails/", "/thumbnailwebps/").replace("/thumbnailbigs/", "/thumbnailwebps/").replace("/thumbnailpngs/", "/thumbnailwebps/");
			}
			if (uri.indexOf("/0/0/0/") > 0) {
				if (settings.width > 0) {
					uri = uri.replace("/0/0/0/", `/0/${settings.width}/0/`);
				}
				if (uri.endsWith(".jpg") || uri.endsWith(".png") || uri.endsWith(".webp")) {
					if (settings.preferWebP) {
						uri = uri.endsWith(".webp") ? uri : uri.substring(0, uri.length - 4) + ".webp";
					}
					else if (uri.endsWith(".png")) {
						uri = uri.replace("/thumbnails/", "/thumbnailpngs/");
					}
				}
				else {
					uri += settings.preferWebP ? ".webp" : ".jpg";
				}
			}
			else if (settings.preferWebP && !uri.endsWith(".webp")) {
				uri += ".webp";
			}
			uri += (AppConfig.isDebug ? "?x-logs=true" : "");
		}
		return AppUtility.isEmpty(uri) ? this.noThumbnailURI : uri;
	}

	/** Prepare required information of an attachment */
	static prepareAttachment(attachment: AttachmentInfo) {
		if (attachment.Created !== undefined) {
			attachment.Created = new Date(attachment.Created);
		}
		if (attachment.LastModified !== undefined) {
			attachment.LastModified = new Date(attachment.LastModified);
		}
		if (AppUtility.isNotEmpty(attachment.ContentType)) {
			attachment.isImage = attachment.ContentType.indexOf("image/") > -1;
			attachment.isVideo = attachment.ContentType.indexOf("video/") > -1;
			attachment.isAudio = attachment.ContentType.indexOf("audio/") > -1;
			attachment.isText = attachment.ContentType.indexOf("text/") > -1;
			attachment.icon = attachment.isImage
				? "image"
				: attachment.isVideo
				? "videocam"
				: attachment.isAudio
					? "volume-medium"
					: attachment.isText
						? "document-text"
						: "document-attach";
		}
		attachment.friendlyFilename = attachment.Filename.length < 47
			? attachment.Filename
			: attachment.Filename.substring(0, 40) + "..." + attachment.Filename.substring(attachment.Filename.length - 4);
		return attachment;
	}

	/** The title */
	abstract Title: string;

	/** The time when the object was created */
	abstract Created: Date;

	/** The identity of user who was created the object */
	abstract CreatedID: string;

	/** The last time when the object was modified */
	abstract LastModified: Date;

	/** The identity of user who was modified the object at the last time */
	abstract LastModifiedID: string;

	copy(source: any, onCompleted?: (data: any, instance: PortalBase) => void) {
		return super.copy(source, data => {
			this.ansiTitle = AppUtility.toANSI(this.Title).toLowerCase();
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}

/** Interface of a module definition */
export interface ModuleDefinition {
	ID: string;
	Title: string;
	Description: string;
	Icon?: string;
	Directory?: string;
	ServiceName?: string;
	RepositoryDefinitionTypeName?: string;
	ContentTypeDefinitions: ContentTypeDefinition[];
	ObjectDefinitions: ContentTypeDefinition[];
}

/** Interface of a content-type definition */
export interface ContentTypeDefinition {
	ID: string;
	Title: string;
	Description: string;
	Icon?: string;
	MultipleIntances: boolean;
	Extendable: boolean;
	Indexable: boolean;
	ObjectName: string;
	ObjectNamePrefix?: string;
	ObjectNameSuffix?: string;
	ParentObjectName?: string;
	NestedObject?: boolean;
	Portlets?: boolean;
	EntityDefinitionTypeName?: string;
	ModuleDefinition: ModuleDefinition;
}

/** Interface of all nested objects */
export interface NestedObject {
	ID: string;
	Title: string;
	FullTitle: string;
	ParentID: string;
	OrderIndex: number;
	Created: Date;
	CreatedID: string;
	LastModified: Date;
	LastModifiedID: string;
	Parent: NestedObject;
	Children: NestedObject[];
}

/** Interface of all filter expression */
export interface FilterBy {
	Attribute?: string;
	Operator?: string;
	Value?: string;
	Extra?: { [key: string]: any };
	Children?: Array<FilterBy>;
}

/** Interface of all sort expression */
export interface SortBy {
	Attribute?: string;
	Mode?: string;
	ThenBy?: SortBy;
}

/** Interfaces of notification settings */
export interface EmailNotificationSettings {
	ToAddresses?: string;
	CcAddresses?: string;
	BccAddresses?: string;
	Subject?: string;
	Body?: string;
}

export interface WebHookNotificationSettings {
	EndpointURLs?: Array<string>;
	SignAlgorithm?: string;
	SignKey?: string;
	SignKeyIsHex?: boolean;
	SignatureName?: string;
	SignatureAsHex?: boolean;
	SignatureInQuery?: boolean;
	Query?: string;
	Header?: string;
	EncryptionKey?: string;
	EncryptionIV?: string;
	GenerateIdentity?: boolean;
	PrepareBodyScript?: string;
}

export interface NotificationSettings {
	Events?: Array<string>;
	Methods?: Array<string>;
	Emails?: EmailNotificationSettings;
	EmailsByApprovalStatus?: { [status: string]: EmailNotificationSettings };
	EmailsWhenPublish?: EmailNotificationSettings;
	WebHooks?: WebHookNotificationSettings;
}

/** Interface of email settings */
export interface EmailSettings {
	Sender?: string;
	Signature?: string;
	Smtp?: {
		Host?: string;
		Port?: number;
		EnableSsl?: boolean;
		User?: string;
		UserPassword?: string;
	};
}

/** Interface of web-hook settings */
export interface WebHookSettings {
	SignAlgorithm?: string;
	SignKey?: string;
	SignKeyIsHex?: boolean;
	SignatureName?: string;
	SignatureAsHex?: boolean;
	SecretToken?: string;
	Query?: string;
	Header?: string;
	EncryptionKey?: string;
	EncryptionIV?: string;
	GenerateIdentity?: boolean;
	PrepareBodyScript?: string;
}

/** Interface of UI settings of all elements */
export interface ElementUISettings {
	Padding?: string;
	Margin?: string;
	Width?: string;
	Height?: string;
	Color?: string;
	BackgroundColor?: string;
	BackgroundImageURI?: string;
	BackgroundImageRepeat?: string;
	BackgroundImagePosition?: string;
	BackgroundImageSize?: string;
	Css?: string;
	Style?: string;
}

/** Definition of an extended property */
export interface ExtendedPropertyDefinition {
	Name: string;
	Mode: string;
	Column: string;
	DefaultValue?: string;
	DefaultValueFormula?: string;
}

/** Definition of a control of an extended property */
export interface ExtendedControlDefinition {
	Name: string;
	Label: string;
	PlaceHolder?: string;
	Description?: string;
	Hidden?: boolean;
	Formula?: string;
	HiddenInView?: boolean;
	Required?: boolean;
	Disabled?: boolean;
	ReadOnly?: boolean;
	AutoFocus?: boolean;
	MinValue?: string;
	MaxValue?: string;
	MinLength?: number;
	MaxLength?: number;
	Css?: string;
	Width?: string;
	Height?: string;
	AsTextEditor?: boolean;
	DatePickerWithTimes?: boolean;
	Multiple?: boolean;
	SelectValues?: string;
	SelectAsBoxes?: boolean;
	SelectInterface?: string;
	LookupType?: string;
	LookupRepositoryID?: string;
	LookupRepositoryEntityID?: string;
	ValidatePattern?: string;
	PlaceBefore?: string;
}

/** Definition for working with a control of a standard property */
export interface StandardControlDefinition {
	Name: string;
	Label?: string;
	PlaceHolder?: string;
	Description?: string;
	Css?: string;
	Hidden?: boolean;
	HiddenInView?: boolean;
	DefaultValue?: string;
	Formula?: string;
}

