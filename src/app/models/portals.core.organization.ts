import { List } from "linqts";
import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { Privileges } from "@models/privileges";
import { PortalCoreBase as BaseModel } from "@models/portals.core.base";
import { Module } from "@models/portals.core.module";

export class Organization extends BaseModel {

	constructor(
		id?: string,
		status?: string,
		privileges?: Privileges
	) {
		super();
		delete this["OriginalPrivileges"];
		this.ID = AppUtility.isNotEmpty(id) ? id : "";
		this.Status = AppUtility.isNotEmpty(status) ? status : "Pending";
		this.Privileges = privileges;
	}

	public static instructionElements = ["Activate", "Invite", "Reset", "Password", "Email"];

	/** All instances of organization */
	public static instances = new Dictionary<string, Organization>();

	/** All instances of organization */
	public static get all() {
		return this.instances.values();
	}

	/** Active organization */
	public static active: Organization;

	Title = undefined as string;
	Description = undefined as string;
	OwnerID = undefined as string;
	Status = undefined as string;
	Alias = undefined as string;
	ExpiredDate = "-";
	FilesQuotes = 10;
	Required2FA = false;
	TrackDownloadFiles = false;
	Theme = "default";
	HomeDesktopID = undefined as string;
	SearchDesktopID = undefined as string;
	Notifications = undefined as {
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
	Instructions = undefined as {
		[type: string]: {
			[language: string]: {
				Subject?: string;
				Body?: string;
			}
		}
	};
	Socials = undefined as Array<string>;
	Trackings = undefined as {
		[key: string]: string
	};
	MetaTags = undefined as string;
	Scripts = undefined as string;
	RefreshUrls = undefined as {
		Addresses?: Array<string>;
		Interval?: number;
	};
	RedirectUrls = undefined as {
		Addresses?: Array<string>;
		AllHttp404?: boolean;
	};
	EmailSettings = undefined as {
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
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;
	owner: string;

	/** Deserializes data to object */
	public static deserialize(json: any, organization?: Organization) {
		organization = organization || new Organization();
		organization.copy(json);
		organization.ansiTitle = AppUtility.toANSI(organization.Title).toLowerCase();
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
		if (organization !== undefined) {
			this.instances.setValue(organization.ID, organization);
		}
		return organization;
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

	public get Modules() {
		return new List(Module.all).Where(mod => mod.SystemID === this.ID).OrderBy(mod => mod.Title).ToArray();
	}

	public get ContentTypes() {
		return new List(Module.all).Where(mod => mod.SystemID === this.ID).Select(mod => mod.ContentTypes).SelectMany(contentTypes => new List(contentTypes)).OrderBy(contentType => contentType.Title).ToArray();
	}

}
