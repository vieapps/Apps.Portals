import { AppUtility } from "../components/app.utility";
import { Base as BaseModel } from "./base";

/** Abstract class for all portals' entity classes */
export abstract class PortalBase extends BaseModel {

	constructor() {
		super();
	}

	/** The title */
	public abstract Title: string;

	/** The created time */
	public abstract Created: Date;

	/** The identity of user who created the object */
	public abstract CreatedID: string;

	/** The last updated time */
	public abstract LastModified: Date;

	/** The identity of user who modified the object */
	public abstract LastModifiedID: string;

	/** The title (only ANSI characters) for working with URIs and filters */
	public abstract ansiTitle: string;

	public get routerLink() {
		return `/portals/${this.constructor.name.toLowerCase()}s/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
