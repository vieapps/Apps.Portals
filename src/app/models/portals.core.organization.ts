import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { NotificationSettings, EmailSettings, WebHookSettings } from "@app/models/portals.base";
import { Module, ContentType, PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.all";

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

	public static instructionElements = ["Account", "Invite", "Reset", "Password", "Email"];

	/** All instances of organization */
	public static instances = new Dictionary<string, Organization>();

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
	ScriptLibraries = undefined as string;
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
	WebHookSettings = undefined as WebHookSettings;
	HttpIndicators = undefined as Array<{
		Name: string;
		Content: string;
	}>;
	FakeFilesHttpURI = undefined as string;
	FakePortalsHttpURI = undefined as string;
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
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(organization: Organization) {
		return organization === undefined ? undefined : this.instances.add(organization.ID, organization);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Organization ? data as Organization : this.deserialize(data, this.get(data.ID)))
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

	public get modules() {
		return Module.instances.toArray(module => module.SystemID === this.ID).sortBy("Title");
	}

	public get contentTypes() {
		return ContentType.instances.toArray(contentType => contentType.SystemID === this.ID).sortBy("Title");
	}

	public get routerLink() {
		return `/portals/core/organizations/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get defaultModule() {
		const modules = this.modules;
		return modules.first(module => module.ModuleDefinitionID === "A0000000000000000000000000000001") || modules.first();
	}

}
