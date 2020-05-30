import { Dictionary } from "typescript-collections";
import { AppUtility } from "@components/app.utility";
import { ElementUISettings } from "@models/portals.base";
import { PortalCoreBase as CoreBaseModel } from "@models/portals.core.base";
import { ContentType } from "@models/portals.core.content.type";
import { Desktop } from "@models/portals.core.desktop";

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
	}

	/** All instances of portlet */
	public static instances = new Dictionary<string, Portlet>();

	/** All instances of portlet */
	public static get all() {
		return this.instances.values();
	}

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
	ListSettings = undefined as {
		Template?: string;
		ExpressionID?: string;
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
	};
	BreadcrumbSettings = undefined as {
		Template?: string;
		SeperatedLabel?: string;
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

	/** Deserializes data to object */
	public static deserialize(json: any, portlet?: Portlet) {
		portlet = portlet || new Portlet();
		portlet.copy(json);
		portlet.ansiTitle = AppUtility.toANSI(portlet.Title).toLowerCase();
		portlet.routerParams["x-request"] = AppUtility.toBase64Url({ ID: portlet.ID, DesktopID: portlet.DesktopID });
		return portlet;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.getValue(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(portlet: Portlet) {
		if (portlet !== undefined) {
			this.instances.setValue(portlet.ID, portlet);
		}
		return portlet;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Portlet ? data as Portlet : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.containsKey(id);
	}

	public get routerLink() {
		return `/portals/core/portlets/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	public get contentType() {
		return AppUtility.isNotEmpty(this.RepositoryEntityID)
			? ContentType.get(this.RepositoryEntityID)
			: undefined;
	}

	public get desktop() {
		return Desktop.get(this.DesktopID);
	}

}
