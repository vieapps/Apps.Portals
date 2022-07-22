import { Dictionary } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
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

	static instances = new Dictionary<string, Link>();

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

	SubTitle = undefined as string;
	ansiTitle: string;
	childrenIDs: Array<string>;

	/** Deserializes data to object */
	static deserialize(json: any, link?: Link) {
		link = link || new Link();
		link.copy(json, data => link.normalizeExtendedProperties(data));
		link.ansiTitle = AppUtility.toANSI(link.Title).toLowerCase();
		return link;
	}

	/** Gets by identity */
	static get(id: string): Link {
		return id !== undefined
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(link: Link) {
		return link === undefined ? undefined : this.instances.add(link.ID, link);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Link ? data as Link : this.deserialize(data, this.get(data.ID)))
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

	get Parent() {
		return Link.get(this.ParentID);
	}

	get Children() {
		const children = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Link.get(id))
			: Link.instances.toArray(link => link.ParentID === this.ID);
		return children.sortBy("OrderIndex", "Title");
	}

	get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	get routerLink() {
		return `/portals/cms/links/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	get listURI() {
		return `${this.routerLink.replace("/view/", "/list/sub-")}?x-request=${AppCrypto.jsonEncode({ ParentID: this.ID })}`;
	}

}
