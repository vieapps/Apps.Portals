import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { NotificationSettings, EmailSettings, WebHookSettings } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";
import { UserProfile } from "@app/models/user";

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

	static instructionElements = ["Account", "Invite", "Reset", "Password", "Email"];

	/** All instances of organization */
	static instances = new Dictionary<string, Organization>();

	/** Active organization */
	static active: Organization;

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

	/** Deserializes data to object */
	static deserialize(json: any, organization?: Organization) {
		organization = organization || new Organization();
		organization.copy(json);
		organization.ansiTitle = AppUtility.toANSI(organization.Title).toLowerCase();
		return organization;
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(organization: Organization) {
		return organization === undefined ? undefined : this.instances.add(organization.ID, organization);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Organization ? data as Organization : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	get modules() {
		return Module.instances.toArray(module => module.SystemID === this.ID).sortBy("Title");
	}

	get contentTypes() {
		return ContentType.instances.toArray(contentType => contentType.SystemID === this.ID).sortBy("Title");
	}

	get routerLink() {
		return `/portals/core/organizations/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	get defaultModule() {
		return this.modules.firstOrDefault(module => module.ModuleDefinitionID === "A0000000000000000000000000000001");
	}

	get owner() {
		const profile = UserProfile.get(this.OwnerID);
		return profile !== undefined ? profile.Name : "";
	}

}
