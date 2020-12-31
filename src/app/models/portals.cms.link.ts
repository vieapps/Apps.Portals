import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { NestedObject } from "@app/models/portals.base";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";

export class Link extends CmsBaseModel implements NestedObject {

	constructor(
		systemID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		parentID?: string,
		status?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.ParentID = AppUtility.isNotEmpty(parentID) ? parentID : "";
		this.Status = AppUtility.isNotEmpty(status) ? status : "Published";
	}

	/** All instances of first 60 links */
	public static instances = new Dictionary<string, Link>();

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
		link.copy(json, data => link.normalizeExtendedProperties(data));
		link.ansiTitle = AppUtility.toANSI(link.Title).toLowerCase();
		return link;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(link: Link) {
		return link === undefined ? undefined : this.instances.add(link.ID, link);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Link ? data as Link : this.deserialize(data, this.get(data.ID)))
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

	public get Parent() {
		return Link.get(this.ParentID);
	}

	public get Children() {
		const links = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Link.get(id))
			: Link.instances.toArray(link => link.ParentID === this.ID);
		return links.sortBy("OrderIndex", "Title");
	}

	public get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	public get routerLink() {
		return `/portals/cms/links/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get listURI() {
		return `${this.routerLink.replace("/view/", "/list/sub-")}?x-request=${AppUtility.toBase64Url({ ParentID: this.ID })}`;
	}

}
