import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";

export class Form extends CmsBaseModel {

	constructor(
		systemID?: string,
		repositoryID?: string,
		repositoryEntityID?: string,
		status?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : undefined as string;
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : undefined as string;
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : undefined as string;
		this.Status = AppUtility.isNotEmpty(status) ? status : "Published";
	}

	static instances = new Dictionary<string, Form>();

	Title = undefined as string;
	Details = undefined as string;
	Name = undefined as string;
	Phone = undefined as string;
	Email = undefined as string;
	Address = undefined as string;
	County = undefined as string;
	Province = undefined as string;
	Postal = undefined as string;
	Country = undefined as string;
	Notes = undefined as string;
	IPAddress = undefined as string;
	Profiles = undefined as Dictionary<string, string>;
	Status = undefined as string;
	AllowComments = false;
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

	static deserialize(json: any, form?: Form) {
		return (form || new Form()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(item: Form) {
		return item === undefined ? undefined : this.instances.add(item.ID, item);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Form ? data as Form : this.deserialize(data, this.get(data.ID)))
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
		return `/portals/cms/forms/view/${AppUtility.toURI(this.ansiTitle)}`;
	}

	get fullAddress() {
		return this.Address
			+ (AppUtility.isNotEmpty(this.Province) ? (AppUtility.isNotEmpty(this.Address) ? ", " : "")
			+ this.County + ", " + this.Province + ", " + this.Country : "");
	}

	copy(source: any, onCompleted?: (data: any, instance: Form) => void) {
		return super.copy(source, data => {
			this.normalizeExtendedProperties(data);
			this.Profiles = new Dictionary<string, string>();
			AppUtility.toKeyValuePair(data.Profiles).forEach(kvp => this.Profiles.add(kvp.key, kvp.value));
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}
