import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { ElementUISettings } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";

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
	public static instances = new Dictionary<string, Site>();

	Title = undefined as string;
	Description = undefined as string;
	Status = undefined as string;
	PrimaryDomain = undefined as string;
	SubDomain = undefined as string;
	OtherDomains = undefined as string;
	AlwaysUseHTTPs = false;
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
	public static deserialize(json: any, site?: Site) {
		site = site || new Site();
		site.copy(json);
		site.ansiTitle = AppUtility.toANSI(site.Title).toLowerCase();
		return site;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(site: Site) {
		return site === undefined ? undefined : this.instances.add(site.ID, site);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Site ? data as Site : this.deserialize(data, this.get(data.ID)))
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

	public get routerLink() {
		return `/portals/core/sites/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
