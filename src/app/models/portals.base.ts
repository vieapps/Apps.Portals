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

export interface PortalNested {

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
	Parent: PortalNested;

	/** The children objects */
	Children: PortalNested[];

}
