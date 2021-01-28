import { Dictionary } from "@app/components/app.collections";
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
	public static instances = new Dictionary<string, Portlet>();

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
	public static deserialize(json: any, portlet?: Portlet) {
		portlet = portlet || new Portlet();
		portlet.copy(json, data => {
			if (AppUtility.isNotEmpty(data.OriginalPortletID)) {
				portlet.CommonSettings = portlet.ListSettings = portlet.ViewSettings = portlet.PaginationSettings = portlet.BreadcrumbSettings = undefined;
			}
			else {
				if (data.CommonSettings !== undefined) {
					portlet.CommonSettings = portlet.CommonSettings || { HideTitle: true };
					portlet.CommonSettings.TitleUISettings = portlet.CommonSettings.TitleUISettings || {};
					portlet.CommonSettings.ContentUISettings = portlet.CommonSettings.ContentUISettings || {};
				}
				if (data.ListSettings !== undefined && data.ListSettings.Options !== undefined) {
					portlet.ListSettings = portlet.ListSettings || {};
					portlet.ListSettings.Options = typeof data.ListSettings.Options === "string"
						? JSON.parse(data.ListSettings.Options)
						: data.ListSettings.Options;
				}
				if (data.ViewSettings !== undefined && data.ViewSettings.Options !== undefined) {
					portlet.ViewSettings = portlet.ViewSettings || {};
					portlet.ViewSettings.Options = typeof data.ViewSettings.Options === "string"
						? JSON.parse(data.ViewSettings.Options)
						: data.ViewSettings.Options;
				}
				if (data.PaginationSettings !== undefined) {
					portlet.PaginationSettings = portlet.PaginationSettings || { ShowPageLinks: true, NumberOfPageLinks: 5 };
				}
				if (AppUtility.isArray(data.OtherDesktops, true)) {
					portlet.otherDesktops = (data.OtherDesktops as Array<string>).distinct();
				}
			}
		});
		portlet.ansiTitle = AppUtility.toANSI(portlet.Title).toLowerCase();
		portlet.routerParams["x-request"] = AppUtility.toBase64Url({ ID: portlet.ID, DesktopID: portlet.DesktopID });
		return portlet;
	}

	/** Gets by identity */
	public static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(portlet: Portlet) {
		return portlet === undefined ? undefined : this.instances.add(portlet.ID, portlet);
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Portlet ? data as Portlet : this.deserialize(data, this.get(data.ID)))
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

	public get organization() {
		return AppUtility.isNotEmpty(this.SystemID)
			? Organization.get(this.SystemID)
			: undefined;
	}

	public get contentType() {
		return AppUtility.isNotEmpty(this.RepositoryEntityID)
			? ContentType.get(this.RepositoryEntityID)
			: undefined;
	}

	public get desktop() {
		return Desktop.get(this.DesktopID);
	}

	public get originalPortlet() {
		return AppUtility.isNotEmpty(this.OriginalPortletID)
			? Portlet.get(this.OriginalPortletID)
			: this;
	}

	public get originalDesktop() {
		const originalPortlet = this.originalPortlet;
		return originalPortlet !== undefined ? originalPortlet.desktop : this.desktop;
	}

	public get routerLink() {
		return `/portals/core/portlets/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get listingInfo() {
		const originalPortlet = this.originalPortlet;
		const originalDesktop = this.originalDesktop;
		const contentType = originalPortlet !== undefined ? originalPortlet.contentType : this.contentType;
		return (contentType !== undefined ? contentType.Title : "Static")
			+ ` @ ${this.Zone} #${this.OrderIndex}`
			+ (AppUtility.isNotEmpty(this.OriginalPortletID) ? ` [${(originalDesktop !== undefined ? originalDesktop.FullTitle : "unknown")}]` : "");
	}

}
