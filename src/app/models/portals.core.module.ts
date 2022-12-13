import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { PortalBase as BaseModel, NotificationSettings, EmailSettings } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { ContentType } from "@app/models/portals.core.content.type";

export class Module extends CoreBaseModel {

	constructor(
		systemID?: string,
		title?: string,
		privileges?: Privileges
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
		this.OriginalPrivileges = privileges;
	}

	/** All instances of module */
	static instances = new Dictionary<string, Module>();

	/** Active module */
	static active: Module;

	Title = undefined as string;
	Description = undefined as string;
	DesktopID = undefined as string;
	Notifications = undefined as NotificationSettings;
	Trackings = undefined as {
		[key: string]: string
	};
	EmailSettings = undefined as EmailSettings;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ModuleDefinitionID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	static deserialize(json: any, module?: Module) {
		return (module || new Module()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(module: Module) {
		return module === undefined ? undefined : this.instances.add(module.ID, module);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Module ? data as Module : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	get moduleDefinition() {
		return AppUtility.isNotEmpty(this.ModuleDefinitionID)
			? (BaseModel.moduleDefinitions || []).find(definition => definition.ID === this.ModuleDefinitionID)
			: undefined;
	}

	get contentTypeDefinitions() {
		return this.moduleDefinition !== undefined
			? this.moduleDefinition.ContentTypeDefinitions.filter(definition => definition.Portlets)
			: undefined;
	}

	get contentTypes() {
		return ContentType.instances.toArray(contentType => contentType.RepositoryID === this.ID).sortBy("Title");
	}

	get routerLink() {
		return `/portals/core/modules/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
