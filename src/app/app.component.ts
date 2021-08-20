import { Component, OnInit, ViewChild } from "@angular/core";
import { Router, RoutesRecognized, NavigationEnd } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { Platform, IonMenu } from "@ionic/angular";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
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
		private router: Router,
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
		http: HttpClient
	) {
		console.log("<AppComponent>: Initializing...");
		AppAPIs.initializeHttpClient(http);
	}

	sidebar: AppSidebar = {
		Visible: true,
		Profile: false,
		Search: true,
		Active: "cms",
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
		toggle: undefined,
		active: undefined,
		updateTopMenu: undefined,
		normalizeTopMenu: undefined,
		updateMainMenu: undefined,
		updateHeader: undefined,
		updateFooter: undefined,
		normalizeFooter: undefined
	};

	@ViewChild(IonMenu, { static: true }) private menuCtrl: IonMenu;

	get color() {
		return this.configSvc.color;
	}

	get isSidebarShown() {
		return this.sidebar.Visible && this.configSvc.screenWidth >= 1200;
	}

	get isSidebarTopMenuShown() {
		return !(this.sidebar.Active === "notifications" || this.sidebar.Active === "chat" || this.sidebar.Active === "preferences");
	}

	public ngOnInit() {
		this.router.events.subscribe(event => {
			if (event instanceof RoutesRecognized) {
				this.configSvc.appConfig.URLs.routerParams = (event as RoutesRecognized).state.root.params;
				this.configSvc.pushURL((event as RoutesRecognized).url, (event as RoutesRecognized).state.root.queryParams);
				const current = this.configSvc.getCurrentURL();
				AppEvents.broadcast("Navigating", { URL: current.url, Params: current.params });
				if (AppAPIs.isPingPeriodTooLarge) {
					AppAPIs.reopenWebSocket("<AppComponent>: Ping period is too large...");
				}
			}
			else if (event instanceof NavigationEnd) {
				const current = this.configSvc.getCurrentURL();
				AppEvents.broadcast("Navigated", { URL: current.url, Params: current.params });
			}
		});

		this.platform.ready().then(async () => {
			await this.configSvc.loadSessionAsync(async () => await Promise.all([
				this.configSvc.loadURIsAsync(),
				this.configSvc.loadOptionsAsync()
			]));

			this.configSvc.prepare();
			await this.configSvc.prepareLanguagesAsync();

			this.prepareSidebar();
			this.prepareEventProcessors();

			const appConfig = this.configSvc.appConfig;
			if (appConfig.isWebApp) {
				const host = AppUtility.parseURI().Host;
				appConfig.services.all.map((svc, index) => ({ hosts: svc.availableHosts || [], index: index })).forEach(info => {
					if (info.hosts.length > 0 && info.hosts.indexOf(host) < 0) {
						appConfig.services.all.removeAt(info.index);
					}
				});
				if (appConfig.services.all.findIndex(svc => svc.name === appConfig.services.active) < 0) {
					const service = appConfig.services.all.first();
					appConfig.services.active = service.name;
					appConfig.app.name = service.appName || appConfig.app.name;
					appConfig.app.description = service.appDescription || appConfig.app.description;
				}
			}

			this.sidebar.Header.Title = appConfig.app.name;
			await this.updateSidebarAsync({}, true, () => AppEvents.broadcast("App", { Type: "PlatformIsReady" }));

			if (this.platform.is("cordova")) {
				this.splashScreen.hide();
				if (appConfig.isNativeApp) {
					this.statusBar.styleDefault();
					this.statusBar.overlaysWebView(false);
				}
			}

			const isActivate = this.configSvc.isWebApp && AppUtility.isEquals("activate", this.configSvc.queryParams["prego"]);
			await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync(`common.messages.${isActivate ? "activating" : "loading"}`));

			if (isActivate) {
				await this.activateAsync();
			}
			else {
				await this.initializeAsync();
			}
		});
	}

	private prepareSidebar() {
		this.sidebar.Header.AvatarOnClick = () => AppEvents.broadcast("Navigate", { Type: "Profile" });
		this.sidebar.Header.TitleOnClick = () => {};

		this.sidebar.toggle = (visible?: boolean) => {
			this.sidebar.Visible = visible !== undefined ? !!visible : !this.sidebar.Visible;
			AppUtility.invoke(async () => await (this.sidebar.Visible ? this.menuCtrl.open() : this.menuCtrl.close()));
		};

		this.sidebar.active = (name?: string, open?: boolean) => {
			if (!!name && name !== this.sidebar.Active) {
				const button = this.sidebar.Footer.find(btn => btn.Name === name);
				if (button !== undefined && typeof button.OnClick === "function") {
					button.OnClick(name, this.sidebar);
				}
				this.sidebar.Active = name;
			}
			if (!!open) {
				this.sidebar.toggle(true);
			}
		};

		this.sidebar.updateTopMenu = (items: Array<AppSidebarMenuItem>) => {
			this.sidebar.TopMenu = items || [];
		};

		this.sidebar.normalizeTopMenu = () => {
			if (!this.sidebar.Search) {
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.length - 1);
			}
			if (this.configSvc.isAuthenticated) {
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.login)));
				this.sidebar.TopMenu.removeAt(this.sidebar.TopMenu.findIndex(item => item.Link.startsWith(this.configSvc.appConfig.URLs.users.register)));
				if (!this.sidebar.Profile) {
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
			this.sidebar.MainMenu[index].Name = name || "cms";
			this.sidebar.MainMenu[index].Parent = parent;
			this.sidebar.MainMenu[index].Items = items || [];
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
			const onUpdated: (sidebar: AppSidebar, item: AppSidebarFooterItem) => void = typeof args.onUpdated === "function"
				? (sidebar, item) => args.onUpdated(sidebar, item)
				: (sidebar, item) => {
						const index = item.Name === "preferences" ? 0 : sidebar.Footer.findIndex(icon => icon.Name === item.Name);
						if (index > 0 && sidebar.Footer[index - 1].Name === "preferences") {
							sidebar.Footer.move(index, index - 1);
						}
					};
			this.sidebar.Footer = !!args.reset ? [] : this.sidebar.Footer;
			if (AppUtility.isArray(args.items, true)) {
				args.items.filter(item => predicate(this.sidebar, item)).forEach(item => {
					this.sidebar.Footer.insert(item, item["Index"] as number);
					onUpdated(this.sidebar, item);
				});
				this.sidebar.normalizeFooter();
			}
		};

		this.sidebar.normalizeFooter = () => {
			if (this.configSvc.isAuthenticated && this.sidebar.Footer.length > 0) {
				AppUtility.invoke(async () => this.sidebar.updateFooter({ items: [{
					Name: "preferences",
					Icon: "settings",
					Title: await this.configSvc.getResourceAsync("common.preferences.label"),
					OnClick: (name: string, sidebar: AppSidebar) => {
						sidebar.Active = name;
						sidebar.active(name, true);
					}
				}]}), 1234);
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
					OnClick: async data => await this.configSvc.navigateHomeAsync(data.Link)
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.login"),
					Link: this.configSvc.appConfig.URLs.users.login,
					Icon: { Name: "log-in", Color: "success", Slot: "start" },
					OnClick: async data => await this.configSvc.navigateForwardAsync(data.Link)
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.register"),
					Link: this.configSvc.appConfig.URLs.users.register,
					Icon: { Name: "person-add", Color: "warning", Slot: "start" },
					OnClick: async data => await this.configSvc.navigateForwardAsync(data.Link)
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.profile"),
					Link: `${this.configSvc.appConfig.URLs.users.profile}/my`,
					Icon: { Name: "person", Color: "warning", Slot: "start" },
					OnClick: async data => await this.configSvc.navigateForwardAsync(data.Link)
				},
				{
					Title: await this.configSvc.getResourceAsync("common.sidebar.search"),
					Icon: { Name: "search", Color: "tertiary", Slot: "start" },
					OnClick: async _ => await this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.search)
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
						OnClick: item.OnClick,
						Children: item.Children,
						Expanded: item.Expanded,
						Detail: item.Detail,
						Thumbnail: item.Thumbnail,
						Icon: item.Icon
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
		const isExpanded = gotChildren && !!args.Expanded;
		const isDetail = !gotChildren && !!args.Detail;
		const icon = args.Icon || {};
		if (icon.Name === undefined && (gotChildren || isDetail)) {
			icon.Name = isDetail ? "chevron-forward" : isExpanded ? "chevron-down" : "chevron-forward",
			icon.Slot = "end";
		}
		return {
			ID: args.ID,
			Title: args.Title,
			Link: args.Link,
			Params: args.Params,
			Direction: args.Direction,
			Children: gotChildren ? (args.Children as Array<any>).map(item => this.getSidebarMainMenuItem(item)) : [],
			Expanded: isExpanded,
			Detail: isDetail,
			Thumbnail: args.Thumbnail,
			Icon: icon,
			OnClick: typeof args.OnClick === "function"
				? args.OnClick
				:	(data, sidebar) => {
						const menuItem = data.childIndex !== undefined ? sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].Children[data.childIndex] : sidebar.MainMenu[data.menuIndex].Items[data.itemIndex];
						AppUtility.invoke(async () => await this.configSvc.navigateAsync(menuItem.Direction, menuItem.Link, menuItem.Params));
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

		AppEvents.on("UpdateSidebar", info => AppUtility.invoke(async () => await this.updateSidebarAsync(info.args)));
		AppEvents.on("AddSidebarItem", info => AppUtility.invoke(async () => await this.updateSidebarMainMenuItemAsync(info.args)));
		AppEvents.on("UpdateSidebarItem", info => AppUtility.invoke(async () => await this.updateSidebarMainMenuItemAsync(info.args)));

		AppEvents.on("UpdateSidebarTitle", info => this.sidebar.updateHeader(info.args));
		AppEvents.on("UpdateSidebarHeader", info => this.sidebar.updateHeader(info.args));
		AppEvents.on("UpdateSidebarFooter", info => this.sidebar.updateFooter(info.args));

		AppEvents.on("Navigate", async info => {
			const url = "LogIn" === info.args.Type
				? this.configSvc.appConfig.URLs.users.login
				: "Profile" === info.args.Type
					? `${this.configSvc.appConfig.URLs.users.profile}/my`
					: "Profiles" === info.args.Type || "Accounts" === info.args.Type
						? this.configSvc.appConfig.URLs.users.list
						: info.args.url || this.configSvc.appConfig.URLs.home;
			switch ((info.args.Direction as string || "Forward").toLowerCase()) {
				case "home":
				case "root":
					await this.configSvc.navigateHomeAsync(url);
					break;
				case "back":
					await this.configSvc.navigateBackAsync(url);
					break;
				default:
					await this.configSvc.navigateForwardAsync(url);
					break;
			}
		});

		AppEvents.on("App", info => {
			if ("LanguageChanged" === info.args.Type) {
				AppEvents.sendToElectron("App", { Type: "LanguageChanged", Language: this.configSvc.appConfig.language });
				AppUtility.invoke(async () => await this.updateSidebarAsync({}, true, () => this.sidebar.normalizeTopMenu()));
			}
		});

		AppEvents.on("Session", info => {
			if ("LogIn" === info.args.Type || "LogOut" === info.args.Type) {
				if ("LogOut" === info.args.Type) {
					this.sidebar.updateHeader({ title: this.configSvc.appConfig.app.name, onClick: () => {}, updateAvatar: true });
				}
				AppUtility.invoke(async () => await this.updateSidebarAsync({}, true, () => this.sidebar.normalizeTopMenu()));
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode) {
				this.sidebar.updateHeader({ updateAvatar: true });
			}
		});
	}

	private async activateAsync() {
		const mode = this.configSvc.queryParams["mode"];
		const code = this.configSvc.queryParams["code"];
		if (AppUtility.isNotEmpty(mode) && AppUtility.isNotEmpty(code)) {
			await this.usersSvc.activateAsync(
				mode,
				code,
				async () => await this.initializeAsync(async () => await Promise.all([
					TrackingUtility.trackScreenAsync(await this.configSvc.getResourceAsync("common.loading.activate"), `users/activate/${mode}`),
					this.showActivationResultAsync({
						Status: "OK",
						Mode: mode
					})
				]), true),
				async error => await this.initializeAsync(async () => await this.showActivationResultAsync({
					Status: "Error",
					Mode: mode,
					Error: error
				}))
			);
		}
		else {
			await this.initializeAsync(async () => await this.showActivationResultAsync({
				Status: "Error",
				Mode: mode,
				Error: {
					Message: await this.configSvc.getResourceAsync("users.activate.messages.error.invalid", { mode: mode, code: code })
				}
			}));
		}
	}

	private async showActivationResultAsync(data: any) {
		await this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync(`users.activate.header.${("account" === data.Mode ? "account" : "password")}`),
			await this.configSvc.getResourceAsync(`users.activate.subHeader.${("OK" === data.Status ? "success" : "error")}`),
			"OK" === data.Status
				? await this.configSvc.getResourceAsync(`users.activate.messages.success.${("account" === data.Mode ? "account" : "password")}`)
				: await this.configSvc.getResourceAsync("users.activate.messages.error.general", { error: (data.Error ? ` (${data.Error.Message})` : "") }),
			_ => {
				this.configSvc.appConfig.URLs.stack.update({ url: this.configSvc.appConfig.URLs.home, params: {} }, this.configSvc.appConfig.URLs.stack.length - 1);
				AppEvents.broadcast("Navigate", { Direction: "Home" });
			}
		);
	}

	private initializeAsync(onNext?: () => void, noInitializeSession?: boolean) {
		return this.configSvc.initializeAsync(
			async _ => {
				if (this.configSvc.isReady && this.configSvc.isAuthenticated) {
					console.log("<AppComponent>: The session is initialized & registered (user)", this.configSvc.isDebug ? this.configSvc.isNativeApp ? AppUtility.stringify(this.configSvc.appConfig.session) : this.configSvc.appConfig.session : "");
					this.finalize(onNext);
				}
				else {
					console.log("<AppComponent>: Register the initialized session (anonymous)", this.configSvc.isDebug ? this.configSvc.isNativeApp ? AppUtility.stringify(this.configSvc.appConfig.session) : this.configSvc.appConfig.session : "");
					await this.configSvc.registerSessionAsync(
						() => {
							console.log("<AppComponent>: The session is registered (anonymous)", this.configSvc.isDebug ? this.configSvc.isNativeApp ? AppUtility.stringify(this.configSvc.appConfig.session) : this.configSvc.appConfig.session : "");
							this.finalize(onNext);
						},
						async error => {
							if (AppUtility.isGotSecurityException(error)) {
								console.warn("<AppComponent>: Cannot register, the session is need to be re-initialized (anonymous)");
								await this.configSvc.resetSessionAsync(() => AppUtility.invoke(async () => await this.initializeAsync(onNext, noInitializeSession), 234));
							}
							else {
								await this.appFormsSvc.hideLoadingAsync(() => console.error(`<AppComponent>: Cannot initialize the app => ${AppUtility.getErrorMessage(error)}`, error));
							}
						}
					);
				}
			},
			async error => {
				if (AppUtility.isGotSecurityException(error)) {
					console.warn("<AppComponent>: Cannot initialize, the session is need to be re-initialized (anonymous)");
					await this.configSvc.resetSessionAsync(() => AppUtility.invoke(async () => await this.initializeAsync(onNext, noInitializeSession), 234));
				}
				else {
					await this.appFormsSvc.hideLoadingAsync(() => console.error(`<AppComponent>: Cannot initialize the app => ${AppUtility.getErrorMessage(error)}`, error));
				}
			},
			noInitializeSession
		);
	}

	private finalize(onNext?: () => void) {
		const appConfig = this.configSvc.appConfig;
		console.log("<AppComponent>: The app was initialized", appConfig.isNativeApp ? AppUtility.stringify(appConfig.app) : appConfig.app);
		if (this.configSvc.isWebApp) {
			PlatformUtility.preparePWAEnvironment(() => this.configSvc.watchFacebookConnect());
		}
		this.sidebar.normalizeTopMenu();

		AppAPIs.openWebSocket(async () => {
			if (appConfig.services.all.findIndex(svc => svc.name === this.portalsCoreSvc.name) > -1) {
				await this.portalsCoreSvc.initializeAsync();
				await this.portalsCmsSvc.initializeAsync();
			}

			if (appConfig.services.all.findIndex(svc => svc.name === this.booksSvc.name) > -1) {
				await this.booksSvc.initializeAsync();
			}

			await this.appFormsSvc.hideLoadingAsync(() => {
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

				if (onNext !== undefined) {
					onNext();
				}
				else {
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
							console.error(`<AppComponent>: The requested URI for redirecting is not well-form => ${redirect}`, appConfig.isNativeApp ? AppUtility.stringify(error) : error);
						}
					}
				}
			});
		});
	}

}
