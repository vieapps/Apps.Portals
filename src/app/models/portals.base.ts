import { Base as BaseModel } from "@models/base";

/** Abstract class for all portals' entity classes */
export abstract class PortalBase extends BaseModel {

	constructor() {
		super();
	}

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

}

/** Interface of a module definition */
export interface ModuleDefinition {
	ID?: string;
	Title?: string;
	Description?: string;
	Icon?: string;
	ContentTypeDefinitions?: ContentTypeDefinition[];
}

/** Interface of a content-type definition */
export interface ContentTypeDefinition {
	ID?: string;
	Title?: string;
	Description?: string;
	Icon?: string;
	MultipleIntances?: boolean;
	Extendable?: boolean;
	Indexable?: boolean;
	ObjectName?: string;
	ModuleDefinition?: ModuleDefinition;
}

/** Interface of all nested classes */
export interface NestedObject {
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

/** Definition of an extended property */
export interface ExtendedPropertyDefinition {
	Name: string;
	Mode: string;
	Column?: string;
	DefaultValue?: string;
	DefaultValueFormula?: string;
}

/** Definition of an UI control of an extended property */
export interface ExtendedUIControlDefinition {
	Name: string;
	Excluded?: boolean;
	Hidden?: boolean;
	HiddenInView?: boolean;
	Required?: boolean;
	Label: string;
	PlaceHolder?: string;
	Description?: string;
	ValidatePattern?: string;
	PlaceBefore?: string;
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
	LookupMode?: string;
	LookupRepositoryID?: string;
	LookupRepositoryEntityID?: string;
	LookupProperty?: string;
}

/** Definition for working with a standard property */
export interface StandardUIDefinition {
	Name: string;
	Label?: string;
	PlaceHolder?: string;
	Description?: string;
	Hidden?: boolean;
	HiddenInView?: boolean;
	Formula?: string;
}

/** Definition of UI controls for working with extended properties of an entity */
export interface ExtendedUIDefinition {
	Controls: Array<ExtendedUIControlDefinition>;
	Specials?: Array<StandardUIDefinition>;
	ListXslt?: string;
	ViewXslt?: string;
}
