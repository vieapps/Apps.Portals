import { AppUtility } from "@components/app.utility";
import { AppEvents } from "@components/app.events";
import { PortalBase as BaseModel } from "@models/portals.base";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";

/** Abstract class for all portals' core entity classes */
export abstract class PortalCmsBase extends BaseModel {

	constructor() {
		super();
	}

	SystemID = undefined as string;
	RepositoryID = undefined as string;
	RepositoryEntityID = undefined as string;

	public get routerLink() {
		return `/portals/cms/${this.constructor.name.toLowerCase()}s/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get Organization() {
		const organization = AppUtility.isNotEmpty(this.SystemID) ? Organization.get(this.SystemID) : undefined;
		if (organization === undefined && AppUtility.isNotEmpty(this.SystemID)) {
			AppEvents.broadcast("Portals", { Object: "Organization", Type: "RequestInfo", ID: this.SystemID });
		}
		return organization;
	}

	public get Module() {
		const modul = AppUtility.isNotEmpty(this.RepositoryID) ? Module.get(this.RepositoryID) : undefined;
		if (modul === undefined && AppUtility.isNotEmpty(this.RepositoryID)) {
			AppEvents.broadcast("Portals", { Object: "Module", Type: "RequestInfo", ID: this.RepositoryID });
		}
		return modul;
	}

	public get ContentType() {
		const contentType = AppUtility.isNotEmpty(this.RepositoryEntityID) ? ContentType.get(this.RepositoryEntityID) : undefined;
		if (contentType === undefined && AppUtility.isNotEmpty(this.RepositoryEntityID)) {
			AppEvents.broadcast("Portals", { Object: "ContentType", Type: "RequestInfo", ID: this.RepositoryEntityID });
		}
		return contentType;
	}

	public get ModuleDefinition() {
		const definitionID = this.Module !== undefined ? this.Module.ModuleDefinitionID : undefined;
		return definitionID !== undefined && Organization.ModuleDefinitions !== undefined
			? Organization.ModuleDefinitions.find(definition => definition.ID === definitionID)
			: undefined;
	}

	public get ContentTypeDefinition() {
		const definitionID = this.ContentType !== undefined ? this.ContentType.ContentTypeDefinitionID : undefined;
		return definitionID !== undefined && Organization.ContentTypeDefinitions !== undefined
			? Organization.ContentTypeDefinitions.find(definition => definition.ID === definitionID)
			: undefined;
	}

}
