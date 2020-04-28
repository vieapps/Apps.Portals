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

/** Interface of all nested classes */
export interface NestedObject {
	/** The title */
	Title: string;

	/** The full title */
	FullTitle: string;

	/** The identity of the parent object */
	ParentID: string;

	/** The order-index for sorting */
	OrderIndex: number;

	/** The time when the object was created */
	Created: Date;

	/** The identity of user who was created the object */
	CreatedID: string;

	/** The last time when the object was modified */
	LastModified: Date;

	/** The identity of user who was modified the object at the last time */
	LastModifiedID: string;

	/** The parent object */
	Parent: NestedObject;

	/** The children objects */
	Children: NestedObject[];
}

/** Definition of an extended property */
export interface ExtendedPropertyDefinition {
	/** The name */
	Name: string;

	/** The mode (data-type) */
	Mode: string;

	/** The name of SQL table's column */
	Column?: string;

	/** The default value */
	DefaultValue?: string;

	/** The formula for computing the default value */
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
	Order?: number;
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
	LookupEntityID?: string;
	LookupProperty?: string;
}

/** Definition of UI controls for working with extended properties of an entity */
export interface ExtendedUIDefinition {
	Controls: Array<ExtendedUIControlDefinition>;
	ListXslt?: string;
	ViewXslt?: string;
}
