import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { FilterBy, SortBy } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel, Organization, Module, ContentType } from "@app/models/portals.core.all";

export class Expression extends CoreBaseModel {

	constructor(
		systemID?: string,
		repositoryID?: string,
		contentTypeDefinitionID?: string,
		repositoryEntityID?: string,
		title?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.ContentTypeDefinitionID = AppUtility.isNotEmpty(contentTypeDefinitionID) ? contentTypeDefinitionID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
		this.Title = title;
	}

	/** All instances of expression */
	public static instances = new Dictionary<string, Expression>();

	Title = undefined as string;
	Description = undefined as string;
	RepositoryID = undefined as string;
	ContentTypeDefinitionID = undefined as string;
	RepositoryEntityID = undefined as string;
	Filter = undefined as FilterBy;
	Sorts = undefined as Array<SortBy>;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;

	/** Deserializes data to object */
	public static deserialize(json: any, expression?: Expression) {
		expression = expression || new Expression();
		expression.copy(json);
		expression.ansiTitle = AppUtility.toANSI(expression.Title).toLowerCase();
		return expression;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(expression: Expression) {
		return expression === undefined ? undefined : this.instances.add(expression.ID, expression);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Expression ? data as Expression : this.deserialize(data, this.get(data.ID)))
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

	public get routerLink() {
		return `/portals/core/expressions/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get organization() {
		return AppUtility.isNotEmpty(this.SystemID)
			? Organization.get(this.SystemID)
			: undefined;
	}

	public get module() {
		return AppUtility.isNotEmpty(this.RepositoryID)
			? Module.get(this.RepositoryID)
			: undefined;
	}

	public get contentType() {
		return AppUtility.isNotEmpty(this.RepositoryEntityID)
			? ContentType.get(this.RepositoryEntityID)
			: undefined;
	}

	public get contentTypeDefinition() {
		const contentType = this.contentType;
		return AppUtility.isNotEmpty(this.ContentTypeDefinitionID)
			? ContentType.contentTypeDefinitions.find(definition => definition.ID === this.ContentTypeDefinitionID)
			: contentType !== undefined ? contentType.contentTypeDefinition : undefined;
	}

}
