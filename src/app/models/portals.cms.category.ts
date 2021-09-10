import { Dictionary } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { NestedObject, NotificationSettings, EmailSettings } from "@app/models/portals.base";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";

export class Category extends CmsBaseModel implements NestedObject {

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

	public static instances = new Dictionary<string, Category>();

	Status = undefined as string;
	ParentID = undefined as string;
	OrderIndex = 0;
	Title = undefined as string;
	Alias = undefined as string;
	Description = undefined as string;
	DesktopID = undefined as string;
	OpenBy = "DesktopWithAlias";
	SpecifiedURI = undefined as string;
	Notes = undefined as string;
	Notifications = undefined as NotificationSettings;
	EmailSettings = undefined as EmailSettings;
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
	public static deserialize(json: any, category?: Category) {
		category = category || new Category();
		category.copy(json);
		category.ansiTitle = AppUtility.toANSI(category.Title).toLowerCase();
		return category;
	}

	/** Gets by identity */
	public static get(id: string): Category {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(category: Category) {
		return category === undefined ? undefined : this.instances.add(category.ID, category);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Category ? data as Category : this.deserialize(data, this.get(data.ID)))
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
		return Category.get(this.ParentID);
	}

	public get Children() {
		const children = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Category.get(id))
			: Category.instances.toArray(category => category.ParentID === this.ID);
		return children.sortBy("OrderIndex", "Title");
	}

	public get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	public get routerLink() {
		return `/portals/cms/categories/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get listLink() {
		return this.routerLink.replace("/update/", "/list/");
	}

	public get listURI() {
		return `${this.listLink}?x-request=${AppCrypto.jsonEncode({ ParentID: this.ID })}`;
	}

}
