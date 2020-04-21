import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { PortalNested as NestedModel } from "@models/portals.base";
import { PortalCoreBase as BaseModel } from "@models/portals.core.base";

export class Desktop extends BaseModel implements NestedModel {

	constructor(
		organizationID?: string,
		title?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
	}

	/** All instances of desktop */
	public static instances = new Dictionary<string, Desktop>();

	/** All instances of desktop */
	public static get all() {
		return this.instances.values();
	}

	ParentID = "";
	Title = "";
	Alias = "";
	Aliases: string;
	Language: string;
	Theme: string;
	Template: string;
	UISettings?: {
		Padding?: string;
		Margin?: string;
		Width?: string;
		Height?: string;
		Color?: string;
		BackgroundColor?: string;
		BackgroundImageURI?: string;
		BackgroundImageRepeat?: string;
		BackgroundImagePosition?: string;
		BackgroundImageSize?: string;
		Css?: string;
		Style?: string;
	};
	IconURI: string;
	MetaTags: string;
	Scripts: string;
	MainPortletID: string;
	SEOSettings?: {
		SEOInfo?: {
			Title?: string;
			Description?: string;
			Keywords?: string;
		};
		TitleMode?: string;
		DescriptionMode?: string;
		KeywordsMode?: string;
	};
	Created = new Date();
	CreatedID = "";
	LastModified = new Date();
	LastModifiedID = "";
	SystemID = "";
	ID = "";

	ansiTitle = "";
	childrenIDs: Array<string>;

	/** Deserializes data to object */
	public static deserialize(json: any, desktop?: Desktop) {
		desktop = desktop || new Desktop();
		desktop.copy(json);
		desktop.ansiTitle = AppUtility.toANSI(desktop.Title).toLowerCase();
		return desktop;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(desktop: Desktop) {
		if (desktop !== undefined) {
			this.instances.setValue(desktop.ID, desktop);
		}
		return desktop;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Desktop ? data as Desktop : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	get FullTitle() {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	get OrderIndex() {
		return 0;
	}

	get Parent() {
		return Desktop.get(this.ParentID);
	}

	get Children() {
		const desktops = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Desktop.get(id))
			: Desktop.all.filter(desktop => desktop.ParentID === this.ID);
		return desktops.sort(AppUtility.getCompareFunction("Title"));
	}

	public get listURI() {
		return `${this.routerLink.replace("/update/", "/list/")}?x-request=${AppUtility.toBase64Url({ ParentID: this.ID })}`;
	}

}
