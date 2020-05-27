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

	public getEntityInfo(objectName: string) {
		const objectDefinition = BaseModel.ModuleDefinitions !== undefined && BaseModel.ModuleDefinitions.length > 0
			? BaseModel.ModuleDefinitions[0].ObjectDefinitions.find(definition => AppUtility.isEquals(definition.ObjectName, objectName))
			: undefined;
		return objectDefinition !== undefined ? objectDefinition.EntityDefinitionTypeName : undefined;
	}
}
