import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { NestedObject } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel, Organization } from "@app/models/portals.core.all";

export class Role extends CoreBaseModel implements NestedObject {

	constructor(
		systemID?: string,
		title?: string,
		parentID?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
		this.ParentID = AppUtility.isNotEmpty(parentID) ? parentID : "";
	}

	/** All instances of role */
	public static instances = new Dictionary<string, Role>();

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
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(role: Role) {
		return role === undefined ? undefined : this.instances.add(role.ID, role);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Role ? data as Role : this.deserialize(data, this.get(data.ID)))
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

	public get Parent() {
		return Role.get(this.ParentID);
	}

	public get Children() {
		return (AppUtility.isArray(this.childrenIDs, true) ? this.childrenIDs.map(id => Role.get(id)) : Role.instances.toArray(role => role.ParentID === this.ID)).sortBy("Title");
	}

	public get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	public get OrderIndex() {
		return 0;
	}

	public get organization() {
		return AppUtility.isNotEmpty(this.SystemID)
			? Organization.get(this.SystemID)
			: undefined;
	}

	public get routerLink() {
		return `/portals/core/roles/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get listURI() {
		return this.getRouterURI({ ParentID: this.ID }).replace("/update/", "/list/");
	}

}
