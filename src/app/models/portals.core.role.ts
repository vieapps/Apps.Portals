import { Dictionary } from "typescript-collections";
import { AppUtility } from "../components/app.utility";
import { PortalCoreBase as BaseModel } from "./portals.core.base";

export class Role extends BaseModel {

	constructor() {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
	}

	/** All instances of role */
	public static instances = new Dictionary<string, Role>();

	ID = "";
	Title = "";
	Description = "";
	UserIDs = new Array<string>();
	SystemID = "";
	Created = new Date();
	CreatedID = "";
	LastModified = new Date();
	LastModifiedID = "";
	ansiTitle = "";

	/** Deserializes data to object */
	public static deserialize(json: any, role?: Role) {
		role = role || new Role();
		role.copy(json, _ => role.ansiTitle = AppUtility.toANSI(role.Title).toLowerCase());
		return role;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(role: Role) {
		return role === undefined
			? undefined
			: this.instances.setValue(role.ID, role) || role;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Role ? data as Role : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

}
