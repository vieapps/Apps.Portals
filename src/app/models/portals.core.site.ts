import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { ElementUISettings } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { Organization } from "@app/models/portals.core.organization";

export class Site extends CoreBaseModel {

	constructor(
		systemID?: string,
		title?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
	}

	/** All instances of site */
	static instances = new Dictionary<string, Site>();

	Title = undefined as string;
	Description = undefined as string;
	Status = undefined as string;
	PrimaryDomain = undefined as string;
	SubDomain = undefined as string;
	OtherDomains = undefined as string;
	AlwaysUseHTTPs = false;
	AlwaysReturnHTTPs = true;
	Language = undefined as string;
	Theme = undefined as string;
	HomeDesktopID = undefined as string;
	SearchDesktopID = undefined as string;
	UISettings = undefined as ElementUISettings;
	IconURI = undefined as string;
	CoverURI = undefined as string;
	MetaTags = undefined as string;
	Stylesheets = undefined as string;
	ScriptLibraries = undefined as string;
	Scripts = undefined as string;
	RedirectToNoneWWW = true;
	UseInlineStylesheets = false;
	UseInlineScripts = false;
	SEOInfo = undefined as {
		Title?: string;
		Description?: string;
		Keywords?: string;
	};
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	static deserialize(json: any, site?: Site) {
		return (site || new Site()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(site: Site) {
		return site === undefined ? undefined : this.instances.add(site.ID, site);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Site ? data as Site : this.deserialize(data, this.get(data.ID)))
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

	get organization() {
		return AppUtility.isNotEmpty(this.SystemID)
			? Organization.get(this.SystemID)
			: undefined;
	}

	get routerLink() {
		return `/portals/core/sites/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
