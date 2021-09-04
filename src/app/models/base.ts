import { AppDataFilter } from "@app/components/app.objects";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { Privileges } from "@app/models/privileges";
import { CounterInfo } from "@app/models/counters";

/** Base of all model/entity classes */
export abstract class Base {

	/** The identity */
	public ID: string;

	/** The working privileges */
	public Privileges: Privileges;

	/** The original privileges */
	public OriginalPrivileges: Privileges;

	/** Gets the link for working with router */
	public abstract get routerLink(): string;

	/** The params for working with router */
	protected _routerParams: { [key: string]: any };

	/** Gets the params for working with router */
	public get routerParams() {
		this._routerParams = this._routerParams || {
			"x-request": AppCrypto.jsonEncode({ ID: this.ID })
		};
		return this._routerParams;
	}

	/** Gets the URI (means link with 'x-request' param) for working with router */
	public get routerURI() {
		return this.getRouterURI();
	}

	/** The title (only ANSI characters) for working with URIs and filters */
	public abstract ansiTitle: string;

	/** Gets the predicate function to tilter a collection of objects using 'indexOf' on ANSI Title */
	public static getFilterBy(query: string, predicate?: (object: any) => boolean) {
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
	public static getParams(filterBy: AppDataFilter, onCompleted?: (params: { [key: string]: string }) => boolean) {
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
	public getRouterURI(params?: { [key: string]: any }) {
		return `${this.routerLink}?x-request=${(params !== undefined ? AppCrypto.jsonEncode(params) : this.routerParams["x-request"])}`;
	}

	/** Copies data from source (object or JSON) and fill into this objects' properties */
	public copy(source: any, onCompleted?: (data: any) => void) {
		AppUtility.copy(source, this, data => {
			if (AppUtility.isNotEmpty(data.Created)) {
				this["Created"] = new Date(data.Created);
			}
			if (AppUtility.isNotEmpty(data.LastModified)) {
				this["LastModified"] = new Date(data.LastModified);
			}
			this.Privileges = AppUtility.isObject(data.Privileges, true)
				? Privileges.deserialize(data.Privileges)
				: undefined;
			this.OriginalPrivileges = AppUtility.isObject(data.OriginalPrivileges, true)
				? Privileges.deserialize(data.OriginalPrivileges)
				: undefined;
			if (onCompleted !== undefined) {
				onCompleted(data);
			}
		});
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
