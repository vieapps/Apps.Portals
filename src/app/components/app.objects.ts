/** Presents the side bar of the app */
export interface AppSidebar {
	Header: {
		Avatar: string;
		AvatarOnClick: (sidebar?: AppSidebar, event?: Event) => void;
		Title: string;
		TitleOnClick: (sidebar?: AppSidebar, event?: Event) => void;
	};
	Footer: Array<AppSidebarFooterItem>;
	TopMenu: Array<AppSidebarMenuItem>;
	MainMenu: Array<{
		Name: string;
		Parent?: AppSidebarMenuItem;
		Items: Array<AppSidebarMenuItem>
	}>;
	State: {
		Profile: boolean;
		Search: boolean;
		Visible: boolean;
		Active: string;
	};
	toggle: (visible?: boolean) => void;
	active: (name?: string, open?: boolean) => void;
	updateTopMenu: (items: Array<AppSidebarMenuItem>) => void;
	normalizeTopMenu: () => void;
	updateMainMenu: (name: string, parent: AppSidebarMenuItem, items: Array<AppSidebarMenuItem>, index?: number) => void;
	updateHeader: (args: { title?: string; onClick?: (sidebar?: AppSidebar, event?: Event) => void; updateAvatar?: boolean; }) => void;
	updateFooter: (args: { items: Array<AppSidebarFooterItem>; reset?: boolean; predicate?: (sidebar: AppSidebar, item: AppSidebarFooterItem) => boolean; onUpdated?: (sidebar: AppSidebar, item: AppSidebarFooterItem) => void; }) => void;
	normalizeFooter: () => void;
}

/** Presents an item in the app side bar main menu */
export interface AppSidebarMenuItem {
	Title: string;
	Link?: string;
	Params?: { [key: string]: string };
	Direction?: string;
	OnClick?: (data?: any, sidebar?: AppSidebar, event?: Event) => void;
	Children?: Array<AppSidebarMenuItem>;
	Expanded?: boolean;
	Detail?: boolean;
	ID?: string;
	Thumbnail?: string;
	Icon?: {
		Name: string;
		Color?: string;
		Slot?: string;
	};
}

/** Presents an item in the app side bar footer */
export interface AppSidebarFooterItem {
	Name: string;
	Icon: string;
	Title?: string;
	Badge?: number;
	OnClick?: (name: string, sidebar: AppSidebar, event?: Event) => void;
	Position?: number;
}

/** Presents a shortcut of the app */
export interface AppShortcut {
	Title: string;
	Link?: string;
	Direction?: string;
	Icon?: {
		Name?: string;
		Color?: string;
	};
	Order?: number;
	Editable?: boolean;
	Removable?: boolean;
	OnClick?: (shortcut?: AppShortcut, index?: number, event?: Event) => void;
	OnRemove?: (shortcut?: AppShortcut, index?: number, event?: Event) => void;
}

/** Presents the struct of a requesting information */
export interface AppRequestInfo {
	Path?: string;
	ServiceName?: string;
	ObjectName?: string;
	Verb?: string;
	Header?: { [key: string]: string };
	Query?: { [key: string]: string };
	Extra?: { [key: string]: string };
	Body?: any;
}

/** Presents the struct of an updating message */
export interface AppMessage {
	Type: {
		Service: string;
		Object?: string;
		Event?: string;
	};
	Data: any;
}

/** Presents a filtering expression for requesting data */
export interface AppDataFilter {
	Query?: string;
	And?: Array<{ [key: string]: any }>;
	Or?: Array<{ [key: string]: any }>;
}

/** Presents a data pagination */
export interface AppDataPagination {
	TotalRecords: number;
	TotalPages: number;
	PageSize: number;
	PageNumber: number;
}

/** Presents a information for requesting data */
export interface AppDataRequest {
	FilterBy?: AppDataFilter;
	SortBy?: { [key: string]: any };
	Pagination?: AppDataPagination;
}
