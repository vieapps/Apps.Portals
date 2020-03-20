import { AppUtility } from "../components/app.utility";
import { Base as BaseModel } from "./base";

/** Abstract class for all portals' entity classes */
export abstract class PortalBase extends BaseModel {

	constructor() {
		super();
	}

	abstract ID = "";
	abstract ansiTitle = "";

	protected _routerParams: { [key: string]: any };

	/** Gets the link for working with router */
	public get routerLink() {
		return `/portals/${this.constructor.name.toLowerCase()}s/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	/** Gets the params for working with router */
	public get routerParams() {
		this._routerParams = this._routerParams || {
			"x-request": AppUtility.toBase64Url({ ID: this.ID })
		};
		return this._routerParams;
	}

	/** Gets the URI (means link with 'x-request' param) for working with router */
	public get routerURI() {
		return `${this.routerLink}?x-request=${this.routerParams["x-request"]}`;
	}

}
