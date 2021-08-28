import { AppUtility } from "@app/components/app.utility";
import { AppDataFilter } from "@app/components/app.objects";
import { Base as BaseModel } from "@app/models/base";

/** Abstract class for all portals' entity classes */
export abstract class PortalBase extends BaseModel {

	constructor() {
		super();
	}

	/** Get the collection of all module definitions */
	public static moduleDefinitions: ModuleDefinition[];

	/** Get the collection of all content-type definition */
	public static get contentTypeDefinitions() {
		return (this.moduleDefinitions || []).map(definition => definition.ContentTypeDefinitions).flatMap(definitions => definitions);
	}

	/** Get the collection of all approval statuses */
	public static approvalStatus = ["Draft", "Pending", "Rejected", "Approved", "Published", "Archieved"];

	/** The title */
	public abstract Title: string;

	/** The time when the object was created */
	public abstract Created: Date;

	/** The identity of user who was created the object */
	public abstract CreatedID: string;

	/** The last time when the object was modified */
	public abstract LastModified: Date;

	/** The identity of user who was modified the object at the last time */
	public abstract LastModifiedID: string;

	/** The title (only ANSI characters) for working with URIs and filters */
	public abstract ansiTitle: string;

	/** Gets the predicate function to tilter a collection of objects using 'indexOf' on ANSI Title */
	public static getFilterBy(query: string, predicate?: (object: any) => boolean) {
		const terms = AppUtility.toANSI(query.replace(/\"/g, "")).split(" ");
		const andTerms = terms.filter(term => term[0] === "+").map(term => term.substr(1));
		const orTerms = terms.except(terms.filter(term => term[0] === "+"));
		const filterBy: (object: PortalBase) => boolean = object => {
			let matched = predicate !== undefined ? predicate(object) : true;
			if (matched && andTerms.length > 0) {
				for (let index = 0; index < andTerms.length; index++) {
					matched = object.ansiTitle.indexOf(andTerms[index]) > -1;
					if (!matched) {
						break;
					}
				}
			}
			if (matched && orTerms.length > 0) {
				for (let index = 0; index < orTerms.length; index++) {
					matched = object.ansiTitle.indexOf(orTerms[index]) > -1;
					if (matched) {
						break;
					}
				}
			}
			return matched;
		};
		return filterBy;
	}

	/** Gets the params for navigating */
	public static getParams(filterBy: AppDataFilter, onCompleted?: (params: { [key: string]: string }) => boolean) {
		const params: { [key: string]: string } = {};
		(filterBy.And || []).forEach(param => {
			const key = AppUtility.getAttributes(param).first();
			const value = param[key];
			if (AppUtility.isObject(value, true) && AppUtility.isNotEmpty(value.Equals)) {
				params[key] = value.Equals;
			}
		});
		if (onCompleted !== undefined) {
			onCompleted(params);
		}
		return params;
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
	SignatureName?: string;
	SignatureAsHex?: boolean;
	SignatureInQuery?: boolean;
	GenerateIdentity?: boolean;
	AdditionalQuery?: string;
	AdditionalHeader?: string;
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
	SignatureName?: string;
	SignatureAsHex?: boolean;
	SignatureInQuery?: boolean;
	AdditionalQuery?: string;
	AdditionalHeader?: string;
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
	Hidden?: boolean;
	Formula?: string;
	HiddenInView?: boolean;
}

