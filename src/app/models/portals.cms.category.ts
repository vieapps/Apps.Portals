import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { INestedObject } from "@models/portals.base";
import { PortalCmsBase as CmsBaseModel } from "@models/portals.cms.base";

export class Category extends CmsBaseModel implements INestedObject {

	constructor(
		organizationID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		parentID?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(organizationID) ? organizationID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.ParentID = AppUtility.isNotEmpty(parentID) ? parentID : "";
	}

	/** All instances of category */
	public static instances = new Dictionary<string, Category>();

	/** All instances of category */
	public static get all() {
		return this.instances.values();
	}

	ParentID = undefined as string;
	OrderIndex = 0;
	Title = undefined as string;
	Alias = undefined as string;
	Description = undefined as string;
	DesktopID = undefined as string;
	OpenBy = "DesktopWithAlias";
	SpecifiedURI = undefined as string;
	Notifications = undefined as {
		Events?: Array<string>;
		Methods?: Array<string>;
		Emails?: {
			ToAddresses?: string;
			CcAddresses?: string;
			BccAddresses?: string;
			Subject?: string;
			Body?: string;
		};
		WebHooks?: {
			EndpointURLs?: Array<string>;
			SignAlgorithm?: string;
			SignKey?: string;
			SignatureName?: string;
			SignatureAsHex?: boolean;
			SignatureInQuery?: boolean;
			AdditionalQuery?: string;
			AdditionalHeader?: string;
		};
	};
	EmailSettings = undefined as {
		Sender?: string;
		Signature?: string;
		Smtp?: {
			Host?: string;
			Port?: number;
			EnableSsl?: boolean;
			User?: string;
			UserPassword?: string;
		}
	};
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
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(category: Category) {
		if (category !== undefined) {
			this.instances.setValue(category.ID, category);
		}
		return category;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Category ? data as Category : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get Parent() {
		return Category.get(this.ParentID);
	}

	public get Children() {
		const categories = AppUtility.isArray(this.childrenIDs, true)
			? this.childrenIDs.map(id => Category.get(id))
			: Category.all.filter(category => category.ParentID === this.ID);
		return categories.sort(AppUtility.getCompareFunction("OrderIndex", "Title"));
	}

	public get FullTitle(): string {
		const parent = this.Parent;
		return (parent !== undefined ? `${parent.FullTitle} > ` : "") + this.Title;
	}

	public get routerLink() {
		return `/portals/cms/categories/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get listURI() {
		return `${this.routerLink.replace("/update/", "/list/")}?x-request=${AppUtility.toBase64Url({ ParentID: this.ID })}`;
	}

}
