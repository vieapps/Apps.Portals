import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";

export class Crawler extends CmsBaseModel {

	constructor(
		systemID?: string,
		status?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Status = AppUtility.isNotEmpty(status) ? status : "Draft";
		delete this["_thumbnails"];
		delete this["_attachments"];
	}

	static instances = new Dictionary<string, Crawler>();

	Status = undefined as string;
	Title = undefined as string;
	Description = undefined as string;
	Type = "WordPress";
	URL = undefined as string;
	SystemID = undefined as string;
	RepositoryID = undefined as string;
	RepositoryEntityID = undefined as string;
	SetAuthor = false;
	SetSource = false;
	NormalizingAdapter = undefined as string;
	DefaultStatus = "Published";
	MaxPages = 1;
	Interval = 720;
	LastActivity = undefined as Date;
	SelectedCategories = undefined as Array<string>;
	CategoryMappings = undefined as Array<string>;
	DefaultCategoryID = undefined as string;
	Options = undefined as string;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	static deserialize(json: any, crawler?: Crawler) {
		return (crawler || new Crawler()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(crawler: Crawler) {
		return crawler === undefined ? undefined : this.instances.add(crawler.ID, crawler);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Crawler ? data as Crawler : this.deserialize(data, this.get(data.ID)))
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

	get routerLink() {
		return `/portals/cms/crawlers/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

}
