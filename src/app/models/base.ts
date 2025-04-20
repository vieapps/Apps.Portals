import { AppConfig } from "@app/app.config";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppDataFilter } from "@app/components/app.objects";
import { Privileges } from "@app/models/privileges";
import { CounterInfo } from "@app/models/counters";

/** Base of all model/entity classes */
export abstract class Base {

	/** Gets URI of 'no-thumbnail' image */
	static get noThumbnailURI() {
		return `${AppConfig.URIs.files}thumbnails/no-image.png`;
	}

	/** Gets URI of a thumbnail image */
	static getThumbnailURI(data: Array<AttachmentInfo> | AttachmentInfo | string, isAttachment: boolean = false) {
		let uri: string;
		const settings = AppConfig.options.thumbnails || AppConfig.defaultOptions.thumbnails;
		const attachment = data === undefined || typeof data === "string"
			? undefined
			: AppUtility.isArray(data, true)
				? (data as Array<AttachmentInfo>).first()
				: data as AttachmentInfo;
		if (attachment !== undefined && isAttachment) {
			return AppConfig.URIs.files + (settings.preferWebP ? "thumbnailwebps/" : "thumbnails/") + (AppUtility.isNotEmpty(attachment.SystemID) ? attachment.SystemID : attachment.ServiceName) + `/1/${settings.width}/0/${attachment.ID}/${encodeURIComponent(attachment.Filename)}` + (settings.preferWebP && !attachment.Filename.endsWith(".webp") ? ".webp" : "");
		}
		uri = attachment !== undefined
			? AppUtility.isObject(attachment.URIs, true)
				? attachment.URIs.Direct
				: AppUtility.isNotEmpty(attachment.URI)
					? attachment.URI
					: undefined
			: AppUtility.isNotEmpty(data)
				? data as string
				: undefined;
		if (AppUtility.isNotEmpty(uri)) {
			if (settings.preferWebP) {
				uri = uri.replace("/thumbnails/", "/thumbnailwebps/").replace("/thumbnailbigs/", "/thumbnailwebps/").replace("/thumbnailpngs/", "/thumbnailwebps/");
			}
			if (uri.indexOf("/0/0/0/") > 0) {
				if (settings.width > 0) {
					uri = uri.replace("/0/0/0/", `/0/${settings.width}/0/`);
				}
				if (uri.endsWith(".jpg") || uri.endsWith(".png") || uri.endsWith(".webp")) {
					if (settings.preferWebP) {
						uri = uri.endsWith(".webp") ? uri : uri.substring(0, uri.length - 4) + ".webp";
					}
					else if (uri.endsWith(".png")) {
						uri = uri.replace("/thumbnails/", "/thumbnailpngs/");
					}
				}
				else {
					uri += settings.preferWebP ? ".webp" : ".jpg";
				}
			}
			else if (settings.preferWebP && !uri.endsWith(".webp")) {
				uri += ".webp";
			}
			uri += (AppConfig.isDebug ? "?x-logs=true" : "");
		}
		return AppUtility.isEmpty(uri) ? this.noThumbnailURI : uri;
	}

	/** Prepare required information of an attachment */
	static prepareAttachment(attachment: AttachmentInfo, isAttachment: boolean = true) {
		if (attachment.Created !== undefined) {
			attachment.Created = new Date(attachment.Created);
		}
		if (attachment.LastModified !== undefined) {
			attachment.LastModified = new Date(attachment.LastModified);
		}
		if (isAttachment && AppUtility.isNotEmpty(attachment.ContentType)) {
			attachment.isImage = attachment.ContentType.indexOf("image/") > -1;
			attachment.isVideo = attachment.ContentType.indexOf("video/") > -1;
			attachment.isAudio = attachment.ContentType.indexOf("audio/") > -1;
			attachment.isText = attachment.ContentType.indexOf("text/") > -1;
			attachment.icon = attachment.isImage
				? "image"
				: attachment.isVideo
				? "videocam"
				: attachment.isAudio
					? "volume-medium"
					: attachment.isText
						? "document-text"
						: "document-attach";
			if (attachment.isImage && !attachment.Filename.endsWith(".ico") && !attachment.Filename.endsWith(".svg")) {
				attachment.URIs["Thumbnail"] = this.getThumbnailURI(attachment, true);
				const uri = attachment.URIs.Direct.split("/");
				attachment.URIs["Alternative"] = `${AppConfig.URIs.files}images/${uri[4]}/${uri[6]}/${uri[7]}${uri[7].endsWith(".webp") ? "" : ".webp"}`;
			}
			else {
				attachment.URIs["Alternative"] = attachment.URIs.Direct;
			}
		}
		attachment.friendlyFilename = attachment.Filename.length < 47
			? attachment.Filename
			: attachment.Filename.substring(0, 40) + "..." + attachment.Filename.substring(attachment.Filename.length - 4);
		return attachment;
	}

	/** Gets the predicate function to tilter a collection of objects using 'indexOf' on ANSI Title */
	static getFilterBy(query: string, predicate?: (object: any) => boolean) {
		const terms = AppUtility.toANSI(query.replace(/\"/g, "")).split(" ");
		const andTerms = terms.filter(term => term[0] === "+").map(term => term.substring(1));
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

	/** The title (only ANSI characters) for working with URIs and filters */
	abstract ansiTitle: string;

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
