import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@models/portals.cms.base";

export class Item extends CmsBaseModel {

	constructor(
		organizationID?: string,
		repositoryID?: string,
		repositoryEntityID?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
	}

	/** All instances of first 60 items */
	public static instances = new Dictionary<string, Item>();

	/** All instances of first 60 items */
	public static get all() {
		return this.instances.values();
	}

	Title = undefined as string;
	Summary = undefined as string;
	Tags = undefined as string;
	Status = undefined as string;
	AllowComments = false;
	Alias = undefined as string;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	RepositoryID = undefined as string;
	RepositoryEntityID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	public static deserialize(json: any, item?: Item) {
		item = item || new Item();
		item.copy(json, data => {
			if (AppUtility.isArray(data.Thumbnails, true)) {
				item.updateThumbnails(data.Thumbnails);
			}
			if (AppUtility.isArray(data.Attachments, true)) {
				item.updateAttachments(data.Attachments);
			}
		});
		item.ansiTitle = AppUtility.toANSI(item.Title).toLowerCase();
		return item;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(item: Item) {
		if (item !== undefined) {
			this.instances.setValue(item.ID, item);
		}
		return item;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Item ? data as Item : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get routerLink() {
		return `/portals/cms/items/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
