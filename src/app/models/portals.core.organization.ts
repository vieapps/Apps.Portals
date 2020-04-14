import { Dictionary } from "typescript-collections";
import { AppUtility } from "../components/app.utility";
import { PortalCoreBase as BaseModel } from "./portals.core.base";
import { Privileges } from "./privileges";

export class Organization extends BaseModel {

	constructor() {
		super();
		delete this["OriginalPrivileges"];
	}

	/** All instances of organization */
	public static instances = new Dictionary<string, Organization>();

	/** Active organization */
	public static active: Organization;

	public static instructionElements = ["Activate", "Invite", "Reset", "Password", "Email"];

	ID = "";
	Title = "";
	Description = "";
	OwnerID = "";
	Status = "Pending";
	Alias = "";
	ExpiredDate = "-";
	FilesQuotes = 10;
	Required2FA = false;
	TrackDownloadFiles = false;
	Theme = "default";
	HomeDesktopID = "";
	SearchDesktopID = "";
	Created = new Date();
	CreatedID = "";
	LastModified = new Date();
	LastModifiedID = "";
	Notifications = {} as {
		Events?: Array<string>;
		Methods?: Array<string>;
		Emails?: {
			ToAddresses?: string;
			CcAddresses?: string;
			BccAddresses?: string;
			Subject?: string;
			Body?: string;
		};
		WebHooks?: {
			EndpointURLs?: Array<string>;
			SignAlgorithm?: string;
			SignKey?: string;
			SignatureName?: string;
			SignatureAsHex?: boolean;
			SignatureInQuery?: boolean;
			AdditionalQuery?: string;
			AdditionalHeader?: string;
		};
	};
	Instructions = {} as {
		[type: string]: {
			[language: string]: {
				Subject?: string;
				Body?: string;
			}
		}
	};
	Socials = new Array<string>();
	Trackings = {} as {
		[key: string]: string
	};
	MetaTags = "";
	Scripts = "";
	RefreshUrls = {} as {
		Addresses?: Array<string>;
		Interval?: number;
	};
	RedirectUrls = {} as {
		Addresses?: Array<string>;
		AllHttp404?: boolean;
	};
	EmailSettings = {} as {
		Sender?: string;
		Signature?: string;
		Smtp?: {
			Host?: string;
			Port?: number;
			EnableSsl?: boolean;
			User?: string;
			UserPassword?: string;
		}
	};
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
