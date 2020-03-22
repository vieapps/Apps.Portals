import { Dictionary } from "typescript-collections";
import { AppUtility } from "../components/app.utility";
import { PortalBase as BaseModel } from "./portals.base";

export class Organization extends BaseModel {

	constructor() {
		super();
	}

	/** All instances of organization */
	public static instances = new Dictionary<string, Organization>();

	ID = "";
	Title = "";
	Description = "";
	OwnerID = "";
	Status = "Pending";
	Alias = "";
	ExpiredDate = "-";
	FilesQuotes = 0;
	Required2FA = false;
	TrackDownloadFiles = false;
	Theme = "default";
	HomeDesktopID = "";
	SearchDesktopID = "";
	Created = new Date();
	CreatedID = "";
	LastModified = new Date();
	LastModifiedID = "";

	ansiTitle = "";

	/** Deserializes data to object */
	public static deserialize(json: any, organization?: Organization) {
		organization = organization || new Organization();
		organization.copy(json, _ => organization.ansiTitle = AppUtility.toANSI(organization.Title).toLowerCase());
		return organization;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(organization: Organization) {
		return organization === undefined
			? undefined
			: this.instances.setValue(organization.ID, organization) || organization;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Organization ? data as Organization : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

}
