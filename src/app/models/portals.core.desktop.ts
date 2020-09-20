import { List } from "linqts";
import { AppUtility, Dictionary } from "@app/components/app.utility";
import { NestedObject, ElementUISettings } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { Portlet } from "@app/models/portals.core.portlet";

export class Desktop extends CoreBaseModel implements NestedObject {

	constructor(
		systemID?: string,
		title?: string,
		parentID?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
		this.ParentID = AppUtility.isNotEmpty(parentID) ? parentID : "";
	}

	/** All instances of desktop */
	public static instances = new Dictionary<string, Desktop>();

	ParentID = undefined as string;
	Title = undefined as string;
	Alias = undefined as string;
	Aliases = undefined as string;
	Language = undefined as string;
	Theme = undefined as string;
	Template = undefined as string;
	UISettings = undefined as ElementUISettings;
	IconURI = undefined as string;
	CoverURI = undefined as string;
	MetaTags = undefined as string;
	Scripts = undefined as string;
	MainPortletID = undefined as string;
	SEOSettings = undefined as {
		SEOInfo?: {
			Title?: string;
			Description?: string;
			Keywords?: string;
		};
		TitleMode?: string;
		DescriptionMode?: string;
		KeywordsMode?: string;
	};
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;
	childrenIDs: Array<string>;
	portlets: Array<Portlet>;

	/** Deserializes data to object */
	public static deserialize(json: any, desktop?: Desktop) {
		desktop = desktop || new Desktop();
		desktop.copy(json);
		desktop.ansiTitle = AppUtility.toANSI(desktop.Title).toLowerCase();
		return desktop;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(desktop: Desktop) {
		return desktop === undefined ? undefined : this.instances.add(desktop.ID, desktop);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Desktop ? data as Desktop : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Converts the array of objects to list */
	public static toList(objects: Array<any>) {
		return new List(objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID))));
	}

	public get Parent() {
		return Desktop.get(this.ParentID);
	}

	public get Children() {
		const desktops = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Desktop.get(id))
			: Desktop.instances.toArray(desktop => desktop.ParentID === this.ID);
		return desktops.sort(AppUtility.getCompareFunction("Title"));
	}

	public get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	public get OrderIndex() {
		return 0;
	}

	public get routerLink() {
		return `/portals/core/desktops/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get listURI() {
		return `${this.routerLink.replace("/update/", "/list/")}?x-request=${AppUtility.toBase64Url({ ParentID: this.ID })}`;
	}

}
