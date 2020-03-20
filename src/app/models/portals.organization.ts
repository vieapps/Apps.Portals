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
	Theme = "";
	HomeDesktopID = "";
	SearchDesktopID = "";
	Created = new Date();
	CreatedID = "";
	LastModified = new Date();
	LastModifiedID = "";

	ansiTitle = "";

	/*** Deserializes data to object */
	public static deserialize(json: any, org?: Organization) {
		org = org || new Organization();
		org.copy(json, _ => org.ansiTitle = AppUtility.toANSI(org.Title).toLowerCase());
		return org;
	}

	/*** Gets by identity */
	public static get(id: string) {
		return id !== undefined ? this.instances.getValue(id) : undefined;
	}

	/*** Updates into dictionary */
	public static update(data: any) {
		if (AppUtility.isObject(data, true)) {
			const org = data instanceof Organization
				? data as Organization
				: this.deserialize(data, this.get(data.ID));
			this.instances.setValue(org.ID, org);
		}
	}

	/*** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

}
