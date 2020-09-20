import { List } from "linqts";
import { AppUtility, Dictionary } from "@app/components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";

export class Item extends CmsBaseModel {

	constructor(
		systemID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		status?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.Status = AppUtility.isNotEmpty(status) ? status : "Published";
	}

	/** All instances of first 60 items */
	public static instances = new Dictionary<string, Item>();

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
			const contentType = item.contentType;
			if (contentType !== undefined && AppUtility.isArray(contentType.ExtendedPropertyDefinitions, true)) {
				contentType.ExtendedPropertyDefinitions.forEach(definition => item[definition.Name] = data[definition.Name]);
			}
		});
		item.ansiTitle = AppUtility.toANSI(item.Title).toLowerCase();
		return item;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(item: Item) {
		return item === undefined ? undefined : this.instances.add(item.ID, item);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Item ? data as Item : this.deserialize(data, this.get(data.ID)))
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

	public get routerLink() {
		return `/portals/cms/items/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
