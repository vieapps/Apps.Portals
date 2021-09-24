import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";
import { Category } from "@app/models/portals.cms.category";

export class Content extends CmsBaseModel {

	constructor(
		systemID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		categoryID?: string,
		startDate?: Date
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.CategoryID = AppUtility.isNotEmpty(categoryID) ? categoryID : "";
		this.StartDate = startDate !== undefined ? new Date(startDate) : undefined;
	}

	public static instances = new Dictionary<string, Content>();

	Status = "Pending";
	CategoryID = undefined as string;
	OtherCategories = undefined as Array<string>;
	Alias = undefined as string;
	StartDate = undefined as Date;
	EndDate = undefined as Date;
	PublishedTime = undefined as Date;
	Tags = undefined as string;
	AllowComments = false;
	Title = undefined as string;
	SubTitle = undefined as string;
	Author = undefined as string;
	AuthorTitle = undefined as string;
	Source = undefined as string;
	SourceURL = undefined as string;
	Summary = undefined as string;
	Details = undefined as string;
	Relateds = undefined as Array<string>;
	ExternalRelateds = undefined as Array<ExternalRelated>;
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
	public static deserialize(json: any, content?: Content) {
		content = content || new Content();
		content.copy(json, data => {
			content.StartDate = AppUtility.isNotEmpty(data.StartDate) ? new Date(data.StartDate) : undefined;
			content.EndDate = AppUtility.isNotEmpty(data.EndDate) && data.EndDate !== "-" ? new Date(data.EndDate) : undefined;
			content.PublishedTime = AppUtility.isNotEmpty(data.PublishedTime) ? new Date(data.PublishedTime) : undefined;
			content.normalizeExtendedProperties(data);
			if (AppUtility.isArray(data.Thumbnails, true)) {
				content.updateThumbnails(data.Thumbnails);
			}
			if (AppUtility.isArray(data.Attachments, true)) {
				content.updateAttachments(data.Attachments);
			}
		});
		content.ansiTitle = AppUtility.toANSI(content.Title).toLowerCase();
		return content;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(content: Content) {
		return content === undefined ? undefined : this.instances.add(content.ID, content);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Content ? data as Content : this.deserialize(data, this.get(data.ID)))
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

	public get category() {
		return Category.get(this.CategoryID);
	}

	public get routerLink() {
		return `/portals/cms/contents/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public async preloadAsync(getCategoryAsync: (id: string) => Promise<void>, getContentAsync: (id: string) => Promise<void>) {
		if (getCategoryAsync !== undefined && AppUtility.isArray(this.OtherCategories, true)) {
			await Promise.all(this.OtherCategories.filter(id => !Category.contains(id)).map(id => getCategoryAsync(id)));
		}
		if (getContentAsync !== undefined && AppUtility.isArray(this.Relateds, true)) {
			await Promise.all(this.Relateds.filter(id => !Content.contains(id)).map(id => getContentAsync(id)));
		}
	}

}

export interface ExternalRelated {
	Title: string;
	Summary?: string;
	URL: string;
}
