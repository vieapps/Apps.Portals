import { Dictionary } from "typescript-collections";
import { AppUtility } from "../components/app.utility";
import { PortalBase as BaseModel } from "./portals.base";
import { Privileges } from "./privileges";

export class Organization extends BaseModel {

	constructor() {
		super();
		this.Notifications = {
			Events: [],
			Methods: [],
			WebHooks: {
				SignAlgorithm: "SHA256",
				SignatureAsHex: true
			}
		};
		this.RefreshUrls = { Interval: 15 };
		this.RedirectUrls = { AllHttp404: true };
		this.Emails = { Smtp: { Port: 25 } };
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

	Privileges = new Privileges(true);
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
			EndpointURLs?: string;
			SignAlgorithm?: string;
			SignKey?: string;
			SignatureName?: string;
			SignatureAsHex?: boolean;
			SignatureInQuery?: boolean;
			AdditionalQuery?: string;
			AdditionalHeader?: string;
		};
	};
	RefreshUrls = {} as {
		Addresses?: string;
		Interval?: number;
	};
	RedirectUrls = {} as {
		Addresses?: string;
		AllHttp404?: boolean;
	};
	Emails = {} as {
		From?: string;
		ReplyTo?: string;
		Signature?: string;
		Smtp?: {
			Host?: string;
			Port?: number;
			EnableSsl?: boolean;
			UserName?: string;
			UserPassword?: string;
		}
	};
	Socials = {} as {
		[key: string]: string
	};
	Trackings = {} as {
		[key: string]: string
	};
	Instructions = {} as {
		[key: string]: {
			[key: string]: string
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
