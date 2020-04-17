import { Dictionary } from "typescript-collections";
import { AppUtility } from "../components/app.utility";
import { PortalNested as NestedModel } from "./portals.base";
import { PortalCoreBase as BaseModel } from "./portals.core.base";

export class Role extends BaseModel implements NestedModel {

	constructor(
		organizationID?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
	}

	/** All instances of role */
	public static instances = new Dictionary<string, Role>();

	/** All instances of role */
	public static get all() {
		return this.instances.values();
	}

	ID = "";
	Title = "";
	Description = "";
	ParentID = "";
	UserIDs = new Array<string>();
	SystemID = "";
	Created = new Date();
	CreatedID = "";
	LastModified = new Date();
	LastModifiedID = "";

	ansiTitle = "";
	childrenIDs: Array<string>;

	public static filter(parentID?: string, organizationID?: string) {
		let roles = Role.all;
		if (AppUtility.isNotEmpty(parentID)) {
			roles = roles.filter(role => role.ParentID === parentID);
		}
		else if (AppUtility.isNotEmpty(organizationID)) {
			roles = roles.filter(role => role.SystemID === organizationID);
		}
		return roles.sort(AppUtility.getCompareFunction("Title"));
	}

	/** Deserializes data to object */
	public static deserialize(json: any, role?: Role) {
		role = role || new Role();
		role.copy(json, data => {
			role.ansiTitle = AppUtility.toANSI(role.Title).toLowerCase();
			if (AppUtility.isArray(data["Children"], true)) {
				role.childrenIDs = [];
				(data["Children"] as Array<any>).forEach(d => {
					const c = this.update(d);
					if (c !== undefined) {
						role.childrenIDs.push(c.ID);
					}
				});
			}
		});
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
		if (role !== undefined) {
			this.instances.setValue(role.ID, role);
		}
		return role;
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

	get FullTitle() {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	get OrderIndex() {
		return 0;
	}

	get Parent() {
		return AppUtility.isNotEmpty(this.ParentID) ? Role.get(this.ParentID) : undefined;
	}

	get Children() {
		return AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Role.get(id)).sort(AppUtility.getCompareFunction("Title"))
			: Role.filter(this.ID);
	}

}
