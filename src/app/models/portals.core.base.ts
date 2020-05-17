import { AppUtility } from "@components/app.utility";
import { PortalBase as BaseModel } from "@models/portals.base";

/** Abstract class for all portals' core entity classes */
export abstract class PortalCoreBase extends BaseModel {

	constructor() {
		super();
	}

	public static get ModuleDefinitions() {
		return BaseModel.ModuleDefinitions;
	}

	public static get ContentTypeDefinitions() {
		return BaseModel.ContentTypeDefinitions;
	}

}
