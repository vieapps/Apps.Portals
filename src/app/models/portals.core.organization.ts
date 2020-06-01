import { List } from "linqts";
import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { Privileges } from "@models/privileges";
import { NotificationSettings, EmailSettings } from "@models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@models/portals.core.base";
import { Module } from "@models/portals.core.module";

export class Organization extends CoreBaseModel {

	constructor(
		status?: string,
		privileges?: Privileges
	) {
		super();
		delete this["OriginalPrivileges"];
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
	Notifications = undefined as NotificationSettings;
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
	AlwaysUseHtmlSuffix = true;
	RefreshUrls = undefined as {
		Addresses?: Array<string>;
		Interval?: number;
	};
	RedirectUrls = undefined as {
		Addresses?: Array<string>;
		AllHttp404?: boolean;
	};
	EmailSettings = undefined as EmailSettings;
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

	public get modules() {
		return new List(Module.all).Where(module => module.SystemID === this.ID).OrderBy(module => module.Title).ToArray();
	}

	public get contentTypes() {
		return new List(Module.all).Where(module => module.SystemID === this.ID).Select(module => module.contentTypes).SelectMany(contentTypes => new List(contentTypes)).OrderBy(contentType => contentType.Title).ToArray();
	}

	public get routerLink() {
		return `/portals/core/organizations/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
