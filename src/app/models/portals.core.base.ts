import { AppUtility } from "@components/app.utility";
import { PortalBase as BaseModel } from "@models/portals.base";

/** Abstract class for all portals' core entity classes */
export abstract class PortalCoreBase extends BaseModel {

	constructor() {
		super();
	}

	public static get moduleDefinitions() {
		return BaseModel.moduleDefinitions;
	}

	public static get contentTypeDefinitions() {
		return BaseModel.contentTypeDefinitions;
	}

	public getEntityInfo(objectName: string) {
		const objectDefinition = BaseModel.moduleDefinitions !== undefined && BaseModel.moduleDefinitions.length > 0
			? BaseModel.moduleDefinitions.find(definition => AppUtility.isEquals(definition.ServiceName, "Portals")).ObjectDefinitions.find(definition => AppUtility.isEquals(definition.ObjectName, objectName))
			: undefined;
		return objectDefinition !== undefined ? objectDefinition.EntityDefinitionTypeName : undefined;
	}
}
