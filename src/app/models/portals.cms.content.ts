import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@models/portals.cms.base";
import { Category } from "@models/portals.cms.category";

export class Content extends CmsBaseModel {

	constructor(
		organizationID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		categoryID?: string,
		startDate?: Date
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.CategoryID = AppUtility.isNotEmpty(categoryID) ? categoryID : "";
		this.StartDate = startDate !== undefined ? new Date(startDate) : undefined;
	}

	/** All instances of first 60 contents */
	public static instances = new Dictionary<string, Content>();

	/** All instances of first 60 contents */
	public static get all() {
		return this.instances.values();
	}

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
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(content: Content) {
		if (content !== undefined) {
			this.instances.setValue(content.ID, content);
		}
		return content;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Content ? data as Content : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get routerLink() {
		return `/portals/cms/contents/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get category() {
		return Category.get(this.CategoryID);
	}

}

export interface ExternalRelated {
	Title: string;
	Summary?: string;
	URL: string;
}
