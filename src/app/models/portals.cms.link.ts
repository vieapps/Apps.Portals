import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { INestedObject } from "@models/portals.base";
import { PortalCmsBase as CmsBaseModel } from "@models/portals.cms.base";

export class Link extends CmsBaseModel implements INestedObject {

	constructor(
		systemID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		parentID?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.ParentID = AppUtility.isNotEmpty(parentID) ? parentID : "";
	}

	/** All instances of first 60 links */
	public static instances = new Dictionary<string, Link>();

	/** All instances of first 60 links */
	public static get all() {
		return this.instances.values();
	}

	ParentID = undefined as string;
	OrderIndex = 0;
	Title = undefined as string;
	Summary = undefined as string;
	URL = undefined as string;
	Target = undefined as string;
	Status = undefined as string;
	ChildrenMode = "Normal";
	LookupRepositoryID = undefined as string;
	LookupRepositoryEntityID = undefined as string;
	LookupRepositoryObjectID = undefined as string;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	RepositoryID = undefined as string;
	RepositoryEntityID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;
	childrenIDs: Array<string>;

	/** Deserializes data to object */
	public static deserialize(json: any, link?: Link) {
		link = link || new Link();
		link.copy(json);
		link.ansiTitle = AppUtility.toANSI(link.Title).toLowerCase();
		return link;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(link: Link) {
		if (link !== undefined) {
			this.instances.setValue(link.ID, link);
		}
		return link;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Link ? data as Link : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get Parent() {
		return Link.get(this.ParentID);
	}

	public get Children() {
		const links = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Link.get(id))
			: Link.all.filter(link => link.ParentID === this.ID);
		return links.sort(AppUtility.getCompareFunction("OrderIndex", "Title"));
	}

	public get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	public get routerLink() {
		return `/portals/cms/links/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
