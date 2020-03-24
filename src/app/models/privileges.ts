import { Set } from "typescript-collections";
import { AppUtility } from "../components/app.utility";

/** Privilege of an individual business service */
export class Privilege {

	constructor(
		serviceName?: string,
		objectName?: string,
		role?: string
	) {
		if (AppUtility.isNotEmpty(serviceName)) {
			this.ServiceName = serviceName;
			if (AppUtility.isNotEmpty(objectName)) {
				this.ObjectName = objectName;
			}
			if (AppUtility.isNotEmpty(role)) {
				this.Role = role;
			}
		}
	}

	ServiceName = "";
	ObjectName = "";
	ObjectIdentity = "";
	Role = "Viewer";
	Actions = new Array<string>();

	/** Deserializes data to object */
	public static deserialize(json: any, privilege?: Privilege) {
		privilege = privilege || new Privilege();
		AppUtility.copy(json, privilege);
		return privilege;
	}

}

/** Privilege of an individual business object */
export class Privileges {

	constructor() {
	}

	DownloadableRoles = new Set<string>();
	DownloadableUsers = new Set<string>();
	ViewableRoles = new Set<string>();
	ViewableUsers = new Set<string>();
	ContributiveRoles = new Set<string>();
	ContributiveUsers = new Set<string>();
	EditableRoles = new Set<string>();
	EditableUsers = new Set<string>();
	ModerateRoles = new Set<string>();
	ModerateUsers = new Set<string>();
	AdministrativeRoles = new Set<string>();
	AdministrativeUsers = new Set<string>();

	/** Deserializes data to object */
	public static deserialize(json: any, privileges?: Privileges) {
		privileges = privileges || new Privileges();
		Object.getOwnPropertyNames(privileges).forEach(property => {
			const data = json[property];
			if (AppUtility.isArray(data, true)) {
				const set = new Set<string>();
				(data as Array<string>).forEach(o => set.add(o));
				privileges[property] = set;
			}
		});
		return privileges;
	}

	public get isInheritFromParent() {
		return this.isEmpty(this.AdministrativeRoles, this.AdministrativeUsers)
			&& this.isEmpty(this.ModerateRoles, this.ModerateUsers)
			&& this.isEmpty(this.EditableRoles, this.EditableUsers)
			&& this.isEmpty(this.ContributiveRoles, this.ContributiveUsers)
			&& this.isEmpty(this.ViewableRoles, this.ViewableUsers)
			&& this.isEmpty(this.DownloadableRoles, this.DownloadableUsers);
	}

	private isEmpty(roles: Set<string>, users: Set<string>) {
		return (roles === undefined || roles.size() < 1) && (users === undefined || users.size() < 1);
	}

}
