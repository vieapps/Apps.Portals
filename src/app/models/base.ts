import { AppDataFilter } from "@app/components/app.objects";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { CounterInfo } from "@app/models/counters";

/** Base of all model/entity classes */
export abstract class Base {

	/** The identity */
	ID: string;

	/** The total of versions */
	TotalVersions = 0;

	/** The collection of versions */
	Versions?: Array<VersionContent>;

	/** The working privileges */
	Privileges: Privileges;

	/** The original privileges */
	OriginalPrivileges: Privileges;

	/** Gets the link for working with router */
	abstract get routerLink(): string;

	/** The params for working with router */
	protected _routerParams: { [key: string]: any };

	/** Gets the params for working with router */
	get routerParams() {
		this._routerParams = this._routerParams || {
			"x-request": AppCrypto.jsonEncode({ ID: this.ID })
		};
		return this._routerParams;
	}

	/** Gets the URI (means link with 'x-request' param) for working with router */
	get routerURI() {
		return this.getRouterURI();
	}

	/** The title (only ANSI characters) for working with URIs and filters */
	abstract ansiTitle: string;

	/** Gets the predicate function to tilter a collection of objects using 'indexOf' on ANSI Title */
	static getFilterBy(query: string, predicate?: (object: any) => boolean) {
		const terms = AppUtility.toANSI(query.replace(/\"/g, "")).split(" ");
		const andTerms = terms.filter(term => term[0] === "+").map(term => term.substr(1));
		const orTerms = terms.except(terms.filter(term => term[0] === "+"));
		const filterBy: (object: Base) => boolean = object => {
			let matched = predicate !== undefined ? predicate(object) : true;
			if (matched && andTerms.length > 0) {
				for (let index = 0; index < andTerms.length; index++) {
					matched = object.ansiTitle.indexOf(andTerms[index]) > -1;
					if (!matched) {
						break;
					}
				}
			}
			if (matched && orTerms.length > 0) {
				for (let index = 0; index < orTerms.length; index++) {
					matched = object.ansiTitle.indexOf(orTerms[index]) > -1;
					if (matched) {
						break;
					}
				}
			}
			return matched;
		};
		return filterBy;
	}

	/** Gets the params for navigating */
	static getParams(filterBy: AppDataFilter, onCompleted?: (params: { [key: string]: string }) => boolean) {
		const params: { [key: string]: string } = {};
		(filterBy.And || []).forEach(param => {
			const key = AppUtility.getAttributes(param).first();
			const value = param[key];
			if (AppUtility.isObject(value, true) && AppUtility.isNotEmpty(value.Equals)) {
				params[key] = value.Equals;
			}
		});
		if (onCompleted !== undefined) {
			onCompleted(params);
		}
		return params;
	}

	/** Gets the URI (means link with 'x-request' param) for working with router */
	getRouterURI(params?: { [key: string]: any }) {
		return `${this.routerLink}?x-request=${(params !== undefined ? AppCrypto.jsonEncode(params) : this.routerParams["x-request"])}`;
	}

	/** Copies data from source (object or JSON) and fill into this objects' properties */
	copy(source: any, onCompleted?: (data: any, instance: Base) => void) {
		AppUtility.copy(source, this, data => {
			if (AppUtility.isNotEmpty(data.Created)) {
				this["Created"] = new Date(data.Created);
			}
			if (AppUtility.isNotEmpty(data.LastModified)) {
				const lastModified = new Date(data.LastModified);
				this["LastModified"] = lastModified;
				if (Math.round((new Date().getTime() - lastModified.getTime()) / (1000 * 3600 * 24)) > 30) {
					this.Versions = [];
				}
			}
			if (AppUtility.isArray(data.Versions, true)) {
				this.Versions = (data.Versions as Array<VersionContent>).sortBy({ name: "VersionNumber", reverse: true });
				this.Versions.forEach(version => version.Created = new Date(version.Created));
				this.TotalVersions = this.Versions.length;
			}
			this.Privileges = AppUtility.isObject(data.Privileges, true)
				? Privileges.deserialize(data.Privileges)
				: undefined;
			this.OriginalPrivileges = AppUtility.isObject(data.OriginalPrivileges, true)
				? Privileges.deserialize(data.OriginalPrivileges)
				: undefined;
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
		return this;
	}

	/** Updates data from source (object or JSON) into this objects' properties */
	update(source: any, onCompleted?: (data: any, instance: Base) => void) {
		const data = AppUtility.isNotEmpty(source)
			? AppUtility.parse(source)
			: AppUtility.isObject(source, true)
				? source
				: {};
		AppUtility.toKeyValuePair(data).forEach(kvp => this[kvp.key] = kvp.value);
		if (this.Versions !== undefined) {
			this.Versions.forEach(version => version.Created = new Date(version.Created));
		}
		if (onCompleted !== undefined) {
			onCompleted(data, this);
		}
		return this;
	}

}

export interface AttachmentInfo {
	ID: string;
	ServiceName: string;
	ObjectName: string;
	SystemID: string;
	EntityInfo: string;
	ObjectID: string;
	Filename: string;
	Size: number;
	ContentType: string;
	Downloads: CounterInfo;
	IsShared: boolean;
	IsTracked: boolean;
	IsTemporary: boolean;
	Title: string;
	Description: string;
	Created: Date;
	CreatedID: string;
	LastModified: Date;
	LastModifiedID: string;
	URI: string;
	URIs: {
		Direct: string;
		Download: string;
	};
	isImage: boolean;
	isVideo: boolean;
	isAudio: boolean;
	isText: boolean;
	icon: string;
	friendlyFilename: string;
}

export interface TrashContent {
	ID: string;
	Title: string;
	ServiceName: string;
	SystemID?: string;
	RepositoryID?: string;
	RepositoryEntityID?: string;
	Created: Date;
	CreatedID: string;
}

export interface VersionContent {
	ID: string;
	Title: string;
	ServiceName: string;
	SystemID?: string;
	RepositoryID?: string;
	RepositoryEntityID?: string;
	VersionNumber: number;
	ObjectID: string;
	Created: Date;
	CreatedID: string;
}

export interface ServiceLog {
	ID: string;
	Time: Date;
	CorrelationID: string;
	DeveloperID?: string;
	AppID?: string;
	NodeID?: string;
	ServiceName: string;
	ObjectName: string;
	Logs: string;
	Stack: string;
}
