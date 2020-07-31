import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { FilterBy, SortBy } from "@models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@models/portals.core.base";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";

export class Expression extends CoreBaseModel {

	constructor(
		systemID?: string,
		repositoryID?: string,
		contentTypeDefinitionID?: string,
		repositoryEntityID?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.RepositoryID = AppUtility.isNotEmpty(repositoryID) ? repositoryID : "";
		this.ContentTypeDefinitionID = AppUtility.isNotEmpty(contentTypeDefinitionID) ? contentTypeDefinitionID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : "";
	}

	/** All instances of expression */
	public static instances = new Dictionary<string, Expression>();

	/** All instances of expression */
	public static get all() {
		return this.instances.values();
	}

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
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(expression: Expression) {
		if (expression !== undefined) {
			this.instances.setValue(expression.ID, expression);
		}
		return expression;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Expression ? data as Expression : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.containsKey(id);
	}

	public get routerLink() {
		return `/portals/core/expressions/update/${AppUtility.toURI(this.ansiTitle)}`;
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
