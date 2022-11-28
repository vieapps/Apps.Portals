import { Dictionary } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { ElementUISettings } from "@app/models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { Organization } from "@app/models/portals.core.organization";
import { ContentType } from "@app/models/portals.core.content.type";
import { Desktop } from "@app/models/portals.core.desktop";

export class Portlet extends CoreBaseModel {

	constructor(
		systemID?: string,
		desktopID?: string,
		repositoryEntityID?: string,
		zone?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.DesktopID = AppUtility.isNotEmpty(desktopID) ? desktopID : "";
		this.RepositoryEntityID = AppUtility.isNotEmpty(repositoryEntityID) ? repositoryEntityID : undefined;
		this.Zone = AppUtility.isNotEmpty(zone) ? zone : "Content";
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
	}

	/** All instances of portlet */
	static instances = new Dictionary<string, Portlet>();

	Title = undefined as string;
	Action = undefined as string;
	AlternativeAction = undefined as string;
	DesktopID = undefined as string;
	Zone = undefined as string;
	OrderIndex = 0;
	RepositoryEntityID = undefined as string;
	OriginalPortletID = undefined as string;
	CommonSettings = undefined as {
		Template?: string;
		HideTitle?: boolean;
		TitleURL?: string;
		IconURI?: string;
		TitleUISettings?: ElementUISettings;
		ContentUISettings?: ElementUISettings;
	};
	ExpressionID = undefined as string;
	ListSettings = undefined as {
		Template?: string;
		PageSize?: number;
		AutoPageNumber?: boolean;
		Options?: { [key: string]: any };
		ShowBreadcrumbs?: boolean;
		ShowPagination?: boolean;
	};
	ViewSettings = undefined as {
		Template?: string;
		Options?: { [key: string]: any };
		ShowBreadcrumbs?: boolean;
		ShowPagination?: boolean;
	};
	PaginationSettings = undefined as {
		Template?: string;
		PreviousPageLabel?: string;
		NextPageLabel?: string;
		CurrentPageLabel?: string;
		ShowPageLinks?: boolean;
		NumberOfPageLinks?: number;
	};
	BreadcrumbSettings = undefined as {
		Template?: string;
		SeparatedLabel?: string;
		HomeLabel?: string;
		HomeURL?: string;
		HomeAdditionalLabel?: string;
		HomeAdditionalURL?: string;
		ShowModuleLink?: boolean;
		ModuleLabel?: string;
		ModuleURL?: string;
		ModuleAdditionalLabel?: string;
		ModuleAdditionalURL?: string;
		ShowContentTypeLink?: boolean;
		ContentTypeLabel?: string;
		ContentTypeURL?: string;
		ContentTypeAdditionalLabel?: string;
		ContentTypeAdditionalURL?: string;
	};
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ID = undefined as string;

	ansiTitle: string;
	otherDesktops: Array<string>;

	/** Deserializes data to object */
	static deserialize(json: any, portlet?: Portlet) {
		return (portlet || new Portlet()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(portlet: Portlet) {
		return portlet === undefined ? undefined : this.instances.add(portlet.ID, portlet);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Portlet ? data as Portlet : this.deserialize(data, this.get(data.ID)))
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

	get organization() {
		return AppUtility.isNotEmpty(this.SystemID)
			? Organization.get(this.SystemID)
			: undefined;
	}

	get contentType() {
		return AppUtility.isNotEmpty(this.RepositoryEntityID)
			? ContentType.get(this.RepositoryEntityID)
			: undefined;
	}

	get desktop() {
		return Desktop.get(this.DesktopID);
	}

	get originalPortlet() {
		return AppUtility.isNotEmpty(this.OriginalPortletID)
			? Portlet.get(this.OriginalPortletID)
			: this;
	}

	get originalDesktop() {
		const originalPortlet = this.originalPortlet;
		return originalPortlet !== undefined ? originalPortlet.desktop : this.desktop;
	}

	get routerLink() {
		return `/portals/core/portlets/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	get listingInfo() {
		const originalPortlet = this.originalPortlet;
		const originalDesktop = this.originalDesktop;
		const contentType = originalPortlet !== undefined ? originalPortlet.contentType : this.contentType;
		return (contentType !== undefined ? contentType.Title : "Static")
			+ ` @ ${this.Zone} #${this.OrderIndex}`
			+ (AppUtility.isNotEmpty(this.OriginalPortletID) ? ` [${(originalDesktop !== undefined ? originalDesktop.FullTitle : "unknown")}]` : "");
	}

	copy(source: any, onCompleted?: (data: any, instance: Portlet) => void) {
		return super.copy(source, data => {
			if (AppUtility.isNotEmpty(data.OriginalPortletID)) {
				this.CommonSettings = this.ListSettings = this.ViewSettings = this.PaginationSettings = this.BreadcrumbSettings = undefined;
			}
			else {
				if (data.CommonSettings !== undefined) {
					this.CommonSettings = this.CommonSettings || { HideTitle: true };
					this.CommonSettings.TitleUISettings = this.CommonSettings.TitleUISettings || {};
					this.CommonSettings.ContentUISettings = this.CommonSettings.ContentUISettings || {};
				}
				if (data.ListSettings !== undefined && data.ListSettings.Options !== undefined) {
					this.ListSettings = this.ListSettings || {};
					this.ListSettings.Options = typeof data.ListSettings.Options === "string"
						? AppUtility.parse(data.ListSettings.Options)
						: data.ListSettings.Options;
				}
				if (data.ViewSettings !== undefined && data.ViewSettings.Options !== undefined) {
					this.ViewSettings = this.ViewSettings || {};
					this.ViewSettings.Options = typeof data.ViewSettings.Options === "string"
						? AppUtility.parse(data.ViewSettings.Options)
						: data.ViewSettings.Options;
				}
				if (data.PaginationSettings !== undefined) {
					this.PaginationSettings = this.PaginationSettings || { ShowPageLinks: true, NumberOfPageLinks: 5 };
				}
				if (AppUtility.isArray(data.OtherDesktops, true)) {
					this.otherDesktops = (data.OtherDesktops as Array<string>).distinct();
				}
			}
			this.routerParams["x-request"] = AppCrypto.jsonEncode({ ID: this.ID, DesktopID: this.DesktopID });
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}
