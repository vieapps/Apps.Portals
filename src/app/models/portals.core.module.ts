import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { PortalBase as BaseModel, NotificationSettings, EmailSettings } from "@app/models/portals.base";
import { ContentType, PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.all";

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
	public static instances = new Dictionary<string, Module>();

	/** Active module */
	public static active: Module;

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
	public static deserialize(json: any, module?: Module) {
		module = module || new Module();
		module.copy(json);
		module.ansiTitle = AppUtility.toANSI(module.Title).toLowerCase();
		return module;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(module: Module) {
		return module === undefined ? undefined : this.instances.add(module.ID, module);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Module ? data as Module : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	public static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	public static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	public get moduleDefinition() {
		return AppUtility.isNotEmpty(this.ModuleDefinitionID)
			? (BaseModel.moduleDefinitions || []).find(definition => definition.ID === this.ModuleDefinitionID)
			: undefined;
	}

	public get contentTypes() {
		return ContentType.instances.toArray(contentType => contentType.RepositoryID === this.ID).sortBy("Title");
	}

	public get routerLink() {
		return `/portals/core/modules/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
