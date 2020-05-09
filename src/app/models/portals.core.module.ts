import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { Privileges } from "@models/privileges";
import { PortalCoreBase as BaseModel } from "@models/portals.core.base";
import { ContentType } from "@models/portals.core.content.type";

export class Module extends BaseModel {

	constructor(
		organizationID?: string,
		title?: string,
		privileges?: Privileges
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
		this.OriginalPrivileges = privileges;
	}

	/** All instances of module */
	public static instances = new Dictionary<string, Module>();

	/** All instances of module */
	public static get all() {
		return this.instances.values();
	}

	Title = undefined as string;
	Description = undefined as string;
	DesktopID = undefined as string;
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
	Trackings = undefined as {
		[key: string]: string
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
	SystemID = undefined as string;
	ModuleDefinitionID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	public static deserialize(json: any, modul?: Module) {
		modul = modul || new Module();
		modul.copy(json);
		modul.ansiTitle = AppUtility.toANSI(modul.Title).toLowerCase();
		return modul;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(modul: Module) {
		if (modul !== undefined) {
			this.instances.setValue(modul.ID, modul);
		}
		return modul;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Module ? data as Module : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get ModuleDefinition() {
		return AppUtility.isNotEmpty(this.ModuleDefinitionID) && Module.ModuleDefinitions !== undefined
			? Module.ModuleDefinitions.find(definition => definition.ID === this.ModuleDefinitionID)
			: undefined;
	}

	public get ContentTypes() {
		return ContentType.all.filter(contentType => contentType.RepositoryID === this.ID).sort(AppUtility.getCompareFunction("Title"));
	}

}
