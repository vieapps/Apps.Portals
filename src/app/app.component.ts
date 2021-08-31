import { Component, OnInit, ViewChild } from "@angular/core";
import { Router, RoutesRecognized, NavigationEnd } from "@angular/router";
import { Platform, IonMenu } from "@ionic/angular";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppStorage } from "@app/components/app.storage";
import { AppFormsService } from "@app/components/forms.service";
import { AppSidebar, AppSidebarMenuItem, AppSidebarFooterItem } from "@app/components/app.objects";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { BooksService } from "@app/services/books.service";

@Component({
	selector: "app-root",
	templateUrl: "./app.component.html"
})

export class AppComponent implements OnInit {

	constructor(
		private platform: Platform,
		private splashScreen: SplashScreen,
		private statusBar: StatusBar,
		private appFormsSvc: AppFormsService,
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService,
		private booksSvc: BooksService,
		router: Router
	) {
		console.log("<AppComponent>: Initializing...");
		router.events.subscribe(event => {
			if (event instanceof RoutesRecognized) {
				if (AppAPIs.isPingPeriodTooLarge) {
					AppAPIs.reopenWebSocket("<AppComponent>: Ping period is too large...");
				}
				this.configSvc.appConfig.URLs.routerParams = (event as RoutesRecognized).state.root.params;
				this.configSvc.pushURL((event as RoutesRecognized).url, (event as RoutesRecognized).state.root.queryParams);
				const current = this.configSvc.getCurrentURL();
				AppEvents.broadcast("App", { Type: "Router", Mode: "Navigating", URL: current.url, Params: current.params });
			}
			else if (event instanceof NavigationEnd) {
				const current = this.configSvc.getCurrentURL();
				AppEvents.broadcast("App", { Type: "Router", Mode: "Navigated", URL: current.url, Params: current.params });
			}
		});
	}

	@ViewChild(IonMenu, { static: true }) private menuCtrl: IonMenu;

	sidebar: AppSidebar = {
		Header: {
			Avatar: undefined,
			AvatarOnClick: undefined,
			Title: undefined,
			TitleOnClick: undefined
		},
		Footer: new Array<AppSidebarFooterItem>(),
		TopMenu: new Array<AppSidebarMenuItem>(),
		MainMenu: new Array<{
			Name: string;
			Parent?: AppSidebarMenuItem;
			Items: Array<AppSidebarMenuItem>
		}>(),
		State: {
			Profile: false,
			Search: true,
			Visible: true,
			Active: ""
		},
		toggle: undefined,
		active: undefined,
		updateTopMenu: undefined,
		normalizeTopMenu: undefined,
		updateMainMenu: undefined,
		updateHeader: undefined,
		updateFooter: undefined,
		normalizeFooter: undefined,
		updateBadge: undefined
	};

	get sidebarFooter() {
		return this.sidebar.Footer.filter(btn => !!btn.Name && !!btn.Icon);
	}

	get color() {
		return this.configSvc.color;
	}

	get isSidebarShown() {
		return this.sidebar.State.Visible && this.configSvc.screenWidth >= 1200;
	}

	get isSidebarTopMenuShown() {
		return !(this.sidebar.State.Active === "notifications" || this.sidebar.State.Active === "chat" || this.sidebar.State.Active === "preferences");
	}

	public ngOnInit() {
		this.platform.ready().then(async () => {
			await this.configSvc.loadURIsAsync();
			await this.configSvc.loadOptionsAsync();
			await this.configSvc.prepareLanguagesAsync();

			const appConfig = this.configSvc.appConfig;
			const session = await AppStorage.getAsync("Session") || {};
			if (AppUtility.isNotEmpty(session.device) ) {
				appConfig.session.device = session.device;
			}
			this.configSvc.prepare();
			this.prepareSidebar();
			this.prepareEventProcessors();

			if (!appConfig.isNativeApp) {
				const uri = AppUtility.parseURI();
				appConfig.services.all.map((svc, index) => ({ hosts: svc.availableHosts || [], index: index })).forEach(info => {
					if (info.hosts.length > 0 && info.hosts.indexOf(uri.Host) < 0) {
						appConfig.services.all.removeAt(info.index);
					}
				});
				AppUtility.toArray(uri.QueryParams["disabled"]).filter(name => AppUtility.isNotEmpty(name)).forEach(name => {
					appConfig.services.all.removeAt(appConfig.services.all.findIndex(svc => svc.name === name));
				});
			}

			let activeService = appConfig.services.all.first(svc => svc.name === appConfig.services.active.service);
			if (activeService === undefined) {
				activeService = appConfig.services.all.first();
				appConfig.services.active.service = activeService.name;
				appConfig.app.name = activeService.appName || appConfig.app.name;
				appConfig.app.description = activeService.appDescription || appConfig.app.description;
			}
			this.sidebar.State.Active = activeService.sidebar || activeService.name.toLowerCase();

			[this.usersSvc, this.portalsCoreSvc, this.portalsCmsSvc, this.booksSvc]
				.filter(service => "Users" === service.name || appConfig.services.all.findIndex(svc => svc.name === service.name) > -1)
				.forEach(service => service.initialize());

			this.sidebar.Header.Title = appConfig.app.name;
			await this.updateSidebarAsync({}, true);

			if (this.platform.is("cordova")) {
				this.splashScreen.hide();
				if (appConfig.isNativeApp) {
					this.statusBar.styleDefault();
					this.statusBar.overlaysWebView(false);
				}
			}

			const isActivate = this.configSvc.isWebApp && AppUtility.isEquals("activate", this.configSvc.queryParams["prego"]);
			const message = await this.configSvc.getResourceAsync(`common.messages.${isActivate ? "activating" : "loading"}`);
			this.appFormsSvc.showLoadingAsync(message).then(isActivate ? () => this.activate() : () => this.initialize());

			if (appConfig.isDebug && !appConfig.isNativeApp) {
				window["__vieapps"] = { app: this, apis: AppAPIs, events: AppEvents };
			}
		});
	}

	private prepareSidebar() {
		this.sidebar.Header.AvatarOnClick = () => AppEvents.broadcast("Navigate", { Type: "Profile" });
		this.sidebar.Header.TitleOnClick = () => {};

		this.sidebar.toggle = (visible?: boolean) => {
			this.sidebar.State.Visible = visible !== undefined ? !!visible : !this.sidebar.State.Visible;
			if (this.sidebar.State.Visible) {
				this.menuCtrl.open();
			}
			else {
				this.menuCtrl.close();
			}
		};

		this.sidebar.active = (name?: string, open?: boolean) => {
			if (!!name && name !== this.sidebar.State.Active) {
				const onClick = (this.sidebar.Footer.find(item => item.Name === name) || {}).OnClick;
				if (typeof onClick === "function") {
					onClick(name, this.sidebar);
				}
				this.sidebar.State.Active = name;
			}
			if (!!open) {
				this.sidebar.toggle(true);
			}
		};

		this.sidebar.updateTopMenu = (items: Array<AppSidebarMenuItem>) => {
			this.sidebar.TopMenu = items || [];
		};

		this.sidebar.normalizeTopMenu = () => {
			if (!this.sidebar.State.Search) {
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.indexOf("/search") > 0));
			}
			if (this.configSvc.isAuthenticated) {
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.login)));
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.register)));
				if (!this.sidebar.State.Profile) {
					this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.profile)));
				}
			}
			else {
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.profile)));
				if (!this.authSvc.canRegisterNewAccounts) {
					this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.register)));
				}
			}
		};

		this.sidebar.updateMainMenu = (name: string, parent: AppSidebarMenuItem, items: Array<AppSidebarMenuItem>, index?: number) => {
			index = index !== undefined ? index : 0;
			if (index < 0) {
				index = this.sidebar.MainMenu.length;
			}
			while (this.sidebar.MainMenu.length < index + 1) {
				this.sidebar.MainMenu.push({ Name: undefined, Parent: undefined, Items: [] });
			}
			this.sidebar.MainMenu.update({ Name: name || this.sidebar.State.Active, Parent: parent, Items: items || [] }, index);
		};

		this.sidebar.updateHeader = (args: { title?: string; onClick?: (sidebar?: AppSidebar, event?: Event) => void; updateAvatar?: boolean; }) => {
			args = args || {};
			if (AppUtility.isNotEmpty(args.title)) {
				this.sidebar.Header.Title = args.title;
			}
			if (typeof args.onClick === "function") {
				this.sidebar.Header.TitleOnClick = args.onClick;
			}
			if (!!args.updateAvatar) {
				const profile = this.configSvc.getAccount().profile;
				this.sidebar.Header.Avatar = profile !== undefined ? profile.avatarURI : undefined;
			}
		};

		this.sidebar.updateFooter = (args: { items: Array<AppSidebarFooterItem>; reset?: boolean; predicate?: (sidebar: AppSidebar, item: AppSidebarFooterItem) => boolean; onUpdated?: (sidebar: AppSidebar, item: AppSidebarFooterItem) => void; }) => {
			const predicate: (sidebar: AppSidebar, item: AppSidebarFooterItem) => boolean = typeof args.predicate === "function"
				? (sidebar, item) => args.predicate(sidebar, item)
				: (sidebar, item) => sidebar.Footer.findIndex(icon => icon.Name === item.Name) < 0;
			const onUpdated: (sidebar: AppSidebar, item: AppSidebarFooterItem) => void = typeof args.onUpdated === "function" ? args.onUpdated : () => {};
			if (AppUtility.isArray(args.items, true)) {
				args.items.filter(item => predicate(this.sidebar, item)).forEach(item => {
					const position = item.Position !== undefined ? item.Position : this.sidebar.Footer.length;
					while (this.sidebar.Footer.length <= position) {
						this.sidebar.Footer.push({ Name: undefined, Icon: undefined });
					}
					this.sidebar.Footer.update(item, position);
					onUpdated(this.sidebar, item);
				});
				this.sidebar.normalizeFooter();
			}
		};

		this.sidebar.normalizeFooter = () => {
			if (!this.configSvc.isAuthenticated) {
				this.sidebar.Footer.removeAt(this.sidebar.Footer.findIndex(item => item.Name === "preferences"));
			}
			else if (this.sidebar.Footer.findIndex(item => item.Name === "preferences") < 0) {
				AppUtility.invoke(async () => this.sidebar.updateFooter({ items: [{
					Name: "preferences",
					Icon: "settings",
					Title: await this.configSvc.getResourceAsync("common.preferences.label"),
					OnClick: (name: string, sidebar: AppSidebar) => {
						sidebar.State.Active = name;
						sidebar.active(name, true);
					}
				}]}), 1234);
			}
		};

		this.sidebar.updateBadge = (name: string, badge: number) => {
			const item = !!name ? this.sidebar.Footer.find(btn => btn.Name === name) : undefined;
			if (item !== undefined) {
				item.Badge = badge;
			}
		};
	}

	private async updateSidebarAsync(args: { header?: any; footer?: Array<AppSidebarFooterItem>; name?: string; parent?: AppSidebarMenuItem, items?: Array<AppSidebarMenuItem>; index?: number; }, updateTopMenu: boolean = false, onNext?: () => void) {
		args = args || {};

		if (AppUtility.isObject(args.header, true)) {
			this.sidebar.Header = {
				Avatar: args.header.Avatar || this.sidebar.Header.Avatar,
				AvatarOnClick: args.header.AvatarOnClick || this.sidebar.Header.AvatarOnClick || (() => {}),
				Title: args.header.Title || this.sidebar.Header.Title,
				TitleOnClick: args.header.TitleOnClick || this.sidebar.Header.TitleOnClick || (() => {})
			};
		}

		if (AppUtility.isArray(args.footer, true)) {
			this.sidebar.Footer = args.footer;
			this.sidebar.normalizeFooter();
		}

		if (updateTopMenu) {
			this.sidebar.updateTopMenu([
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.home"),
					Link: this.configSvc.appConfig.URLs.home,
					Icon: { Name: "home", Color: "primary", Slot: "start" },
					OnClick: data => this.configSvc.navigateRootAsync(data.Link).then(() => AppEvents.broadcast("App", { Type: "HomePage", Mode: "Open", Source: "Sidebar", Active: this.sidebar.State.Active }))
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.login"),
					Link: this.configSvc.appConfig.URLs.users.login,
					Icon: { Name: "log-in", Color: "success", Slot: "start" },
					OnClick: data => this.configSvc.navigateForwardAsync(data.Link).then(() => AppEvents.broadcast("App", { Type: "LogInPage", Mode: "Open", Source: "Sidebar", Active: this.sidebar.State.Active }))
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.register"),
					Link: this.configSvc.appConfig.URLs.users.register,
					Icon: { Name: "person-add", Color: "warning", Slot: "start" },
					OnClick: data => this.configSvc.navigateForwardAsync(data.Link).then(() => AppEvents.broadcast("App", { Type: "RegisterPage", Mode: "Open", Source: "Sidebar", Active: this.sidebar.State.Active }))
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.profile"),
					Link: `${this.configSvc.appConfig.URLs.users.profile}/my`,
					Icon: { Name: "person", Color: "warning", Slot: "start" },
					OnClick: data => this.configSvc.navigateForwardAsync(data.Link).then(() => AppEvents.broadcast("App", { Type: "ProfilePage", Mode: "Open", Source: "Sidebar", Active: this.sidebar.State.Active }))
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.search"),
					Icon: { Name: "search", Color: "tertiary", Slot: "start" },
					OnClick: _ => this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.search).then(() => AppEvents.broadcast("App", { Type: "SearchPage", Mode: "Open", Source: "Sidebar", Active: this.sidebar.State.Active }))
				}
			]);
		}

		if (args.name !== undefined || args.parent !== undefined || args.items !== undefined) {
			const parent = AppUtility.isObject(args.parent, true)
				? {
						ID: args.parent.ID,
						Title: args.parent.Title,
						Link: args.parent.Link,
						Params: args.parent.Params,
						Expanded: !!args.parent.Expanded,
						Detail: !!args.parent.Detail,
						Thumbnail: args.parent.Thumbnail,
						Icon: args.parent.Icon,
						OnClick: typeof args.parent.OnClick === "function" ? args.parent.OnClick : _ => {}
					} as AppSidebarMenuItem
				: undefined;
			if (parent !== undefined && AppUtility.isNotEmpty(parent.Title) && parent.Title.startsWith("{{") && parent.Title.endsWith("}}")) {
				parent.Title = await this.configSvc.getResourceAsync(parent.Title.substr(2, parent.Title.length - 4).trim());
			}
			const items = AppUtility.isArray(args.items, true)
				? args.items.map(item => ({
						ID: item.ID,
						Title: item.Title,
						Link: item.Link,
						Params: item.Params,
						Direction: item.Direction,
						Children: item.Children,
						Expanded: item.Expanded,
						Detail: item.Detail,
						Thumbnail: item.Thumbnail,
						Icon: item.Icon,
						OnClick: item.OnClick
					} as AppSidebarMenuItem))
					.filter(item => AppUtility.isNotEmpty(item.Title))
					.map(item => this.getSidebarMainMenuItem(item))
				: undefined;
			if (items !== undefined) {
				await Promise.all(items.map(async item => {
					if (AppUtility.isNotEmpty(item.Title) && item.Title.startsWith("{{") && item.Title.endsWith("}}")) {
						item.Title = await this.configSvc.getResourceAsync(item.Title.substr(2, item.Title.length - 4).trim());
					}
				}));
			}
			this.sidebar.updateMainMenu(args.name, parent, items, args.index);
		}

		if (onNext !== undefined) {
			onNext();
		}
	}

	private async updateSidebarMainMenuItemAsync(args: any) {
		let menuIndex = args.menuIndex !== undefined ? args.menuIndex as number : -1;
		if (menuIndex < 0) {
			menuIndex = 0;
		}
		else if (menuIndex >= this.sidebar.MainMenu.length) {
			menuIndex = this.sidebar.MainMenu.length;
			this.sidebar.MainMenu.push({ Name: undefined, Parent: undefined, Items: [] });
		}
		const menuItem = this.getSidebarMainMenuItem(args.itemInfo);
		if (AppUtility.isNotEmpty(menuItem.Title) && menuItem.Title.startsWith("{{") && menuItem.Title.endsWith("}}")) {
			menuItem.Title = await this.configSvc.getResourceAsync(menuItem.Title.substr(2, menuItem.Title.length - 4).trim());
		}
		this.sidebar.MainMenu[menuIndex].Items.update(menuItem, args.itemIndex !== undefined ? args.itemIndex as number : -1);
	}

	private getSidebarMainMenuItem(args: any): AppSidebarMenuItem {
		const gotChildren = AppUtility.isArray(args.Children, true) && AppUtility.isGotData(args.Children);
		return {
			ID: args.ID,
			Title: args.Title,
			Link: args.Link,
			Params: args.Params,
			Direction: args.Direction,
			Children: gotChildren ? (args.Children as Array<any>).map(item => this.getSidebarMainMenuItem(item)) : [],
			Expanded: gotChildren && !!args.Expanded,
			Detail: !gotChildren && !!args.Detail,
			Thumbnail: args.Thumbnail,
			Icon: args.Icon,
			OnClick: typeof args.OnClick === "function"
				? args.OnClick
				: (data, sidebar) => {
					const menuItem = data.childIndex !== undefined ? sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].Children[data.childIndex] : sidebar.MainMenu[data.menuIndex].Items[data.itemIndex];
					this.configSvc.navigateAsync(menuItem.Direction, menuItem.Link, menuItem.Params);
				}
		} as AppSidebarMenuItem;
	}

	public trackSidebarItem(index: number, item: any) {
		return `${item.ID || item.Name || item.Title}@${index}`;
	}

	private prepareEventProcessors() {
		AppEvents.on("ToggleSidebar", info => this.sidebar.toggle(info.args.Visible));
		AppEvents.on("ActiveSidebar", info => this.sidebar.active(info.args.Name, info.args.Visible));
		AppEvents.on("OpenSidebar", info => this.sidebar.active(info.args.Name, true));
		AppEvents.on("CloseSidebar", _ => this.sidebar.toggle(false));

		AppEvents.on("UpdateSidebar", info => this.updateSidebarAsync(info.args));
		AppEvents.on("UpdateSidebarItem", info => this.updateSidebarMainMenuItemAsync(info.args));

		AppEvents.on("UpdateSidebarHeader", info => this.sidebar.updateHeader(info.args));
		AppEvents.on("UpdateSidebarFooter", info => this.sidebar.updateFooter(info.args));

		AppEvents.on("Navigate", info => this.configSvc.navigateAsync(
			info.args.Direction,
			"LogIn" === info.args.Type
				? this.configSvc.appConfig.URLs.users.login
				: "Profile" === info.args.Type
					? `${this.configSvc.appConfig.URLs.users.profile}/my`
					: "Profiles" === info.args.Type || "Accounts" === info.args.Type
						? this.configSvc.appConfig.URLs.users.list
						: info.args.url || this.configSvc.appConfig.URLs.home
		));

		AppEvents.on("App", info => {
			if ("Language" === info.args.Type && "Changed" === info.args.Mode) {
				this.updateSidebarAsync({}, true, () => this.sidebar.normalizeTopMenu());
			}
		});

		AppEvents.on("Session", info => {
			if ("LogIn" === info.args.Type || "LogOut" === info.args.Type) {
				if ("LogOut" === info.args.Type) {
					this.sidebar.updateHeader({ title: this.configSvc.appConfig.app.name, onClick: () => {}, updateAvatar: true });
				}
				this.updateSidebarAsync({}, true, () => this.sidebar.normalizeTopMenu());
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode) {
				this.sidebar.updateHeader({ updateAvatar: true });
			}
		});
	}

	private activate() {
		TrackingUtility.trackAsync({ title: "Users - Activate",  campaignUrl: "users/activate", category: "Users:Activation", action: "Activate" }, false);
		const mode = this.configSvc.queryParams["mode"];
		const code = this.configSvc.queryParams["code"];
		if (AppUtility.isNotEmpty(mode) && AppUtility.isNotEmpty(code)) {
			this.usersSvc.activateAsync(
				mode,
				code,
				() => this.initialize(async () => this.showActivationResult({
					Header: await this.configSvc.getResourceAsync(`users.activate.header.${("account" === mode ? "account" : "password")}`),
					Message: await this.configSvc.getResourceAsync(`users.activate.subHeader.success`),
					SubMessage: await this.configSvc.getResourceAsync(`users.activate.success.${("account" === mode ? "account" : "password")}`)
				}), true),
				error => this.initialize(async () => this.showActivationResult({
					Header: await this.configSvc.getResourceAsync(`users.activate.header.${("account" === mode ? "account" : "password")}`),
					Message: await this.configSvc.getResourceAsync(`users.activate.subHeader.error`),
					SubMessage: await this.configSvc.getResourceAsync("users.activate.messages.error.general", { error: (error ? ` (${error.Message})` : "") })
				}))
			);
		}
		else {
			this.initialize(async () => this.showActivationResult({
				Header: await this.configSvc.getResourceAsync(`users.activate.header.${("account" === mode ? "account" : "password")}`),
				Message: await this.configSvc.getResourceAsync(`users.activate.subHeader.error`),
				SubMessage: await this.configSvc.getResourceAsync("users.activate.messages.error.invalid", { mode: mode, code: code })
			}));
		}
	}

	private showActivationResult(data: any) {
		this.appFormsSvc.showAlertAsync(data.Header, data.Message, data.SubMessage, () => this.configSvc.navigateRootAsync());
	}

	private initialize(onNext?: () => void, noInitializeSession?: boolean) {
		this.configSvc.initializeAsync(
			() => {
				if (this.configSvc.isReady && this.configSvc.isAuthenticated) {
					console.log("<AppComponent>: The session is initialized & registered (user)", this.configSvc.isDebug ? this.configSvc.appConfig.session : "");
					this.finalize(onNext);
				}
				else {
					console.log("<AppComponent>: Register the initialized session (anonymous)", this.configSvc.isDebug ? this.configSvc.appConfig.session : "");
					this.configSvc.registerSessionAsync(
						() => {
							console.log("<AppComponent>: The session is registered (anonymous)", this.configSvc.isDebug ? this.configSvc.appConfig.session : "");
							this.finalize(onNext);
						},
						error => {
							if (AppUtility.isGotSecurityException(error)) {
								console.warn("<AppComponent>: Cannot register, the session is need to be re-initialized (anonymous)");
								this.configSvc.resetSessionAsync(() => AppUtility.invoke(() => this.initialize(onNext, noInitializeSession), 234));
							}
							else {
								this.appFormsSvc.hideLoadingAsync(() => console.error(`<AppComponent>: Cannot initialize the app => ${AppUtility.getErrorMessage(error)}`, error));
							}
						}
					);
				}
			},
			error => {
				if (AppUtility.isGotSecurityException(error)) {
					console.warn("<AppComponent>: Cannot initialize, the session is need to be re-initialized (anonymous)");
					this.configSvc.resetSessionAsync(() => AppUtility.invoke(() => this.initialize(onNext, noInitializeSession), 234));
				}
				else {
					this.appFormsSvc.hideLoadingAsync(() => console.error(`<AppComponent>: Cannot initialize the app => ${AppUtility.getErrorMessage(error)}`, error));
				}
			},
			noInitializeSession
		);
	}

	private finalize(onNext?: () => void) {
		const appConfig = this.configSvc.appConfig;
		AppUtility.invoke(() => console.log("<AppComponent>: Initialized", appConfig.isDebug ? appConfig.app : undefined))
			.then(this.configSvc.isWebApp ? () => PlatformUtility.preparePWAEnvironment(() => this.configSvc.watchFacebookConnect()) : () => {})
			.then(() => this.sidebar.normalizeTopMenu())
			.then(() => AppAPIs.openWebSocket(() => Promise.all([this.portalsCoreSvc, this.portalsCmsSvc, this.booksSvc].filter(service => appConfig.services.all.findIndex(svc => svc.name === service.name) > -1).map(service => service.initializeAsync()))
				.then(() => this.appFormsSvc.hideLoadingAsync())
				.then(() => {
					const data = {
						URIs: appConfig.URIs,
						app: appConfig.app,
						session: appConfig.session,
						services: appConfig.services,
						accounts: appConfig.accounts,
						options: appConfig.options,
						languages: appConfig.languages
					};
					AppEvents.broadcast("App", { Type: "Initialized", Data: data });
					AppEvents.sendToElectron("App", { Type: "Initialized", Data: data});
					AppUtility.invoke(onNext !== undefined ? () => onNext() : () => {
						let redirect = this.configSvc.queryParams["redirect"] as string || appConfig.URLs.redirectToWhenReady;
						if (AppUtility.isNotEmpty(redirect)) {
							appConfig.URLs.redirectToWhenReady = undefined;
							appConfig.URLs.stack.update({ url: appConfig.URLs.home, params: {} }, appConfig.URLs.stack.length - 1);
							try {
								redirect = AppCrypto.base64urlDecode(redirect);
								if (appConfig.isDebug) {
									console.warn(`<AppComponent>: Redirect to the requested URI => ${redirect}`);
								}
								this.configSvc.navigateForwardAsync(redirect);
							}
							catch (error) {
								console.error(`<AppComponent>: The requested URI for redirecting is not well-form => ${redirect}`, error);
							}
						}
					});
				}
			)
		));
	}

}
