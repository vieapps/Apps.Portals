import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { PortalNested as NestedModel } from "@models/portals.base";
import { PortalCoreBase as BaseModel } from "@models/portals.core.base";

export class Role extends BaseModel implements NestedModel {

	constructor(
		organizationID?: string,
		title?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
	}

	/** All instances of role */
	public static instances = new Dictionary<string, Role>();

	/** All instances of role */
	public static get all() {
		return this.instances.values();
	}

	ParentID = undefined as string;
	Title = undefined as string;
	Description = undefined as string;
	UserIDs = undefined as Array<string>;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;
	childrenIDs: Array<string>;

	/** Deserializes data to object */
	public static deserialize(json: any, role?: Role) {
		role = role || new Role();
		role.copy(json);
		role.ansiTitle = AppUtility.toANSI(role.Title).toLowerCase();
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
		return Role.get(this.ParentID);
	}

	get Children() {
		const roles = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Role.get(id))
			: Role.all.filter(role => role.ParentID === this.ID);
		return roles.sort(AppUtility.getCompareFunction("Title"));
	}

	public get listURI() {
		return `${this.routerLink.replace("/update/", "/list/")}?x-request=${AppUtility.toBase64Url({ ParentID: this.ID })}`;
	}

}
