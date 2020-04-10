import { AppUtility } from "../components/app.utility";
import { PortalBase as BaseModel } from "./portals.base";

/** Abstract class for all portals' core entity classes */
export abstract class PortalCoreBase extends BaseModel {

	constructor() {
		super();
	}

	public get routerLink() {
		return `/portals/core/${this.constructor.name.toLowerCase()}s/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
