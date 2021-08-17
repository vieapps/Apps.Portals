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
import { AppSidebar, AppSidebarMenuItem } from "@app/components/app.objects";
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
			Thumbnail: undefined,
			ThumbnailOnClick: _ => AppEvents.broadcast("Navigate", { Type: "Profile" }),
			Title: undefined,
			TitleOnClick: undefined
		},
		Footer: new Array<{
			Name: string,
			Icon: string,
			Title?: string,
			OnClick?: (name: string, sidebar: AppSidebar, event?: Event) => void
		}>(),
		TopMenu: new Array<AppSidebarMenuItem>(),
		MainMenu: new Array<{
			Name: string,
			Parent?: AppSidebarMenuItem,
			Items: Array<AppSidebarMenuItem>
		}>()
	};

	@ViewChild(IonMenu, { static: true }) private menuCtrl: IonMenu;

	get color() {
		return this.configSvc.color;
	}

	get isSidebarShown() {
		return this.sidebar.Visible && this.configSvc.screenWidth >= 1200;
	}

	get isSidebarTopMenuShown() {
		return !(this.sidebar.Active === "portals" || this.sidebar.Active === "notifications" || this.sidebar.Active === "chat" || this.sidebar.Active === "preferences");
	}

	get sidebarSignColor() {
		return this.isSidebarShown ? "medium" : "light";
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
			this.configSvc.prepare();
			await Promise.all([
				this.configSvc.loadURIsAsync(),
				this.configSvc.loadOptionsAsync()
			]);
			await this.configSvc.prepareLanguagesAsync();
			this.registerEventProcessors();

			if (this.platform.is("cordova")) {
				this.splashScreen.hide();
				if (this.configSvc.isNativeApp) {
					this.statusBar.styleDefault();
					this.statusBar.overlaysWebView(false);
				}
			}

			if (this.configSvc.isWebApp) {
				const host = AppUtility.parseURI().Host;
				this.configSvc.appConfig.services.all.map((svc, index) => ({ hosts: svc.availableHosts || [], index: index })).forEach(info => {
					if (info.hosts.length > 0 && info.hosts.indexOf(host) < 0) {
						this.configSvc.appConfig.services.all.removeAt(info.index);
					}
				});
				if (this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.configSvc.appConfig.services.active) < 0) {
					const service = this.configSvc.appConfig.services.all.first();
					this.configSvc.appConfig.services.active = service.name;
					this.configSvc.appConfig.app.name = service.appName || this.configSvc.appConfig.app.name;
					this.configSvc.appConfig.app.description = service.appDescription || this.configSvc.appConfig.app.description;
				}
			}

			this.sidebar.Header.Title = this.configSvc.appConfig.app.name;
			await this.updateSidebarAsync({}, true, () => AppEvents.broadcast("App", { Type: "PlatformIsReady" }));

			const isActivate = this.configSvc.isWebApp && AppUtility.isEquals("activate", this.configSvc.queryParams["prego"]);
			await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync(`common.messages.${isActivate ? "activating" : "loading"}`));
			await (isActivate ? this.activateAsync() : this.initializeAsync());
		});
	}

	public trackSidebarItem(index: number, item: any) {
		return `${item.ID || item.Name || item.Title}@${index}`;
	}

	private getSidebarItem(itemInfo: any, onCompleted?: (item: AppSidebarMenuItem) => void) {
		const gotChildren = AppUtility.isArray(itemInfo.Children, true) && AppUtility.isGotData(itemInfo.Children);
		const isExpanded = gotChildren && !!itemInfo.Expanded;
		const isDetail = !gotChildren && !!itemInfo.Detail;
		const icon = itemInfo.Icon || {};
		if (icon.Name === undefined && (gotChildren || isDetail)) {
			icon.Name = isDetail ? "chevron-forward" : isExpanded ? "chevron-down" : "chevron-forward",
			icon.Slot = "end";
		}
		const sidebarItem: AppSidebarMenuItem = {
			ID: itemInfo.ID,
			Title: itemInfo.Title,
			Link: itemInfo.Link,
			Params: itemInfo.Params,
			Direction: itemInfo.Direction,
			Children: gotChildren ? (itemInfo.Children as Array<any>).map(item => this.getSidebarItem(item)) : [],
			Expanded: isExpanded,
			Detail: isDetail,
			Thumbnail: itemInfo.Thumbnail,
			Icon: icon,
			OnClick: typeof itemInfo.OnClick === "function"
				? itemInfo.OnClick
				:	async (data, sidebar) => {
						const menuItem = data.childIndex !== undefined
							? sidebar.MainMenu[data.menuIndex].Items[data.itemIndex].Children[data.childIndex]
							: sidebar.MainMenu[data.menuIndex].Items[data.itemIndex];
						await this.configSvc.navigateAsync(menuItem.Direction, menuItem.Link, menuItem.Params);
					}
		};
		if (onCompleted !== undefined) {
			onCompleted(sidebarItem);
		}
		return sidebarItem;
	}

	private async updateSidebarItemAsync(menuIndex: number, itemIndex: number, itemInfo: any) {
		if (menuIndex < 0) {
			menuIndex = 0;
		}
		else if (menuIndex >= this.sidebar.MainMenu.length) {
			menuIndex = this.sidebar.MainMenu.length;
			this.sidebar.MainMenu.push({ Name: undefined, Items: []});
		}
		this.sidebar.MainMenu[menuIndex].Items.update(
			this.getSidebarItem(
				itemInfo,
				async sidebarItem => sidebarItem.Title = AppUtility.isNotEmpty(sidebarItem.Title) && sidebarItem.Title.startsWith("{{") && sidebarItem.Title.endsWith("}}")
					? await this.configSvc.getResourceAsync(sidebarItem.Title.substr(2, sidebarItem.Title.length - 4).trim())
					: sidebarItem.Title
			),
			itemIndex
		);
	}

	private async updateSidebarAsync(info: any, updateTopItems: boolean = false, onNext?: () => void) {
		const header = info.Header;
		if (header !== undefined) {
			this.sidebar.Header = {
				Thumbnail: header.Thumbnail || this.sidebar.Header.Thumbnail,
				ThumbnailOnClick: header.ThumbnailOnClick || this.sidebar.Header.ThumbnailOnClick || (() => {}),
				Title: header.Title || this.sidebar.Header.Title,
				TitleOnClick: header.TitleOnClick || this.sidebar.Header.TitleOnClick || (() => {})
			};
		}

		const footer = info.Footer;
		if (AppUtility.isArray(footer, true)) {
			this.sidebar.Footer = footer;
			this.normalizeSidebarFooter();
		}

		this.sidebar.TopMenu = updateTopItems ? [
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
		] : this.sidebar.TopMenu;

		if (info.Name === undefined && info.Parent === undefined && info.Items === undefined) {
			if (onNext !== undefined) {
				onNext();
			}
			return;
		}

		let index = info.Index !== undefined ? info.Index as number : 0;
		if (index < 0) {
			index = this.sidebar.MainMenu.length;
		}
		while (this.sidebar.MainMenu.length < index + 1) {
			this.sidebar.MainMenu.push({ Name: undefined, Parent: undefined, Items: [] });
		}

		const parent = AppUtility.isObject(info.Parent, true)
			?	{
					ID: info.Parent.ID,
					Title: info.Parent.Title,
					Link: info.Parent.Link,
					Params: info.Parent.Params,
					Expanded: !!info.Parent.Expanded,
					Detail: !!info.Parent.Detail,
					Thumbnail: info.Parent.Thumbnail,
					Icon: info.Parent.Icon,
					OnClick: typeof info.Parent.OnClick === "function"
						? info.Parent.OnClick
						: _ => {}
				} as AppSidebarMenuItem
			: undefined;
		if (parent !== undefined && AppUtility.isNotEmpty(parent.Title) && parent.Title.startsWith("{{") && parent.Title.endsWith("}}")) {
			parent.Title = await this.configSvc.getResourceAsync(parent.Title.substr(2, parent.Title.length - 4).trim());
		}

		this.sidebar.MainMenu[index].Name = info.Name || "cms";
		this.sidebar.MainMenu[index].Parent = parent;

		if (AppUtility.isArray(info.Items, true)) {
			if (!!info.Reset) {
				this.sidebar.MainMenu[index].Items = [];
			}
			await Promise.all((info.Items as Array<any>).map(item => ({
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
			.map(item => this.updateSidebarItemAsync(index, -1, item)));
		}
		else {
			this.sidebar.MainMenu[index].Items = [];
		}

		if (onNext !== undefined) {
			onNext();
		}
	}

	private updateSidebarHeader(args?: any, updateThumbnai: boolean = true) {
		if (args !== undefined) {
			this.sidebar.Header.Title = AppUtility.isNotEmpty(args.Title) ? args.Title : this.sidebar.Header.Title;
			this.sidebar.Header.TitleOnClick = typeof args.OnClick === "function" ? args.OnClick : _ => {};
		}
		if (updateThumbnai) {
			const profile = this.configSvc.getAccount().profile;
			this.sidebar.Header.Thumbnail = profile !== undefined ? profile.avatarURI : undefined;
		}
	}

	private updateSidebarFooter(args: any) {
		if (!!args.Reset) {
			this.sidebar.Footer = [];
		}
		if (typeof args.Predicate === "function" ? args.Predicate(this.sidebar) : true) {
			this.sidebar.Footer.insert(args.Button, args.Index !== undefined ? args.Index : this.sidebar.Footer.length);
			if (typeof args.OnCompleted === "function") {
				args.OnCompleted(this.sidebar);
			}
			this.normalizeSidebarFooter();
		}
	}

	private normalizeSidebarFooter() {
		if (this.configSvc.isAuthenticated && this.sidebar.Footer.length > 0) {
			AppUtility.invoke(async () => {
				if (this.sidebar.Footer.findIndex(btn => btn.Name === "preferences") < 0) {
					this.sidebar.Footer.push({
						Name: "preferences",
						Icon: "settings",
						Title: await this.configSvc.getResourceAsync("common.preferences.label"),
						OnClick: (name, sidebar) => {
							sidebar.Active = name;
							this.activeSidebarAsync(name, true);
						}
					});
				}
			}, 1234);
		}
	}

	private normalizeSidebarItems() {
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
	}

	private async activeSidebarAsync(name: string, openSidebar: boolean = false) {
		if (!!name && name !== this.sidebar.Active) {
			const button = this.sidebar.Footer.find(btn => btn.Name === name);
			if (button !== undefined && typeof button.OnClick === "function") {
				button.OnClick(name, this.sidebar);
			}
			this.sidebar.Active = name;
		}
		if (openSidebar) {
			await this.toggleSidebarAsync(true);
		}
	}

	private async inactiveSidebarAsync() {
		await this.toggleSidebarAsync(false);
	}

	public async toggleSidebarAsync(state?: boolean) {
		this.sidebar.Visible = state !== undefined ? state : !this.sidebar.Visible;
		if (this.sidebar.Visible) {
			await this.menuCtrl.open();
		}
		else {
			await this.menuCtrl.close();
		}
	}

	private registerEventProcessors() {
		AppEvents.on("ToggleSidebar", _ => this.toggleSidebarAsync());
		AppEvents.on("ActiveSidebar", async info => await this.activeSidebarAsync(info.args.Name));
		AppEvents.on("OpenSidebar", async info => await this.activeSidebarAsync(info.args.Name, true));
		AppEvents.on("CloseSidebar", async _ => await this.inactiveSidebarAsync());

		AppEvents.on("UpdateSidebar", async info => await this.updateSidebarAsync(info.args));
		AppEvents.on("AddSidebarItem", async info => this.updateSidebarItemAsync(info.args.MenuIndex !== undefined ? info.args.MenuIndex : -1, info.args.ItemIndex !== undefined ? info.args.ItemIndex : -1, info.args.ItemInfo));
		AppEvents.on("UpdateSidebarItem", async info => await this.updateSidebarItemAsync(info.args.MenuIndex !== undefined ? info.args.MenuIndex : -1, info.args.ItemIndex !== undefined ? info.args.ItemIndex : -1, info.args.ItemInfo));

		AppEvents.on("UpdateSidebarTitle", info => this.updateSidebarHeader(info.args, false));
		AppEvents.on("UpdateSidebarHeader", info => this.updateSidebarHeader(info.args));
		AppEvents.on("UpdateSidebarFooter", info => this.updateSidebarFooter(info.args));

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
				AppUtility.invoke(async () => await this.updateSidebarAsync({}, true, () => this.normalizeSidebarItems()), 13);
			}
		});

		AppEvents.on("Session", info => {
			if ("LogIn" === info.args.Type || "LogOut" === info.args.Type) {
				if ("LogOut" === info.args.Type) {
					this.updateSidebarHeader({ Title: this.configSvc.appConfig.app.name });
				}
				AppUtility.invoke(async () => await this.updateSidebarAsync({}, true, () => this.normalizeSidebarItems()), 13);
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode) {
				this.updateSidebarHeader();
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
				this.configSvc.appConfig.URLs.stack[this.configSvc.appConfig.URLs.stack.length - 1] = {
					url: this.configSvc.appConfig.URLs.home,
					params: {}
				};
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
		console.log("<AppComponent>: The app was initialized", this.configSvc.isNativeApp ? AppUtility.stringify(appConfig.app) : appConfig.app);
		if (this.configSvc.isWebApp) {
			PlatformUtility.preparePWAEnvironment(() => this.configSvc.watchFacebookConnect());
		}
		AppAPIs.openWebSocket(async () => {
			AppEvents.broadcast("App", { Type: "Initialized" });
			AppEvents.sendToElectron("App", { Type: "Initialized", Data: {
				URIs: appConfig.URIs,
				app: appConfig.app,
				session: appConfig.session,
				services: appConfig.services,
				accountRegistrations: appConfig.accountRegistrations,
				options: appConfig.options,
				languages: appConfig.languages
			}});
			await this.normalizeSidebarItems();
			await this.appFormsSvc.hideLoadingAsync(async () => {
				if (this.configSvc.appConfig.services.all.map(svc => svc.name).indexOf(this.portalsCoreSvc.name) > -1) {
					await this.portalsCoreSvc.initializeAsync();
					await this.portalsCmsSvc.initializeAsync();
				}
				if (this.configSvc.appConfig.services.all.map(svc => svc.name).indexOf(this.booksSvc.name) > -1) {
					await this.booksSvc.initializeAsync();
				}
				AppEvents.broadcast("App", { Type: "FullyInitialized" });
				AppEvents.sendToElectron("App", { Type: "FullyInitialized", Data: {
					URIs: appConfig.URIs,
					app: appConfig.app,
					session: appConfig.session,
					services: appConfig.services,
					accountRegistrations: appConfig.accountRegistrations,
					options: appConfig.options,
					languages: appConfig.languages
				}});
				if (onNext !== undefined) {
					onNext();
				}
				else {
					let redirect = this.configSvc.queryParams["redirect"] as string || this.configSvc.appConfig.URLs.redirectToWhenReady;
					if (AppUtility.isNotEmpty(redirect)) {
						this.configSvc.appConfig.URLs.redirectToWhenReady = undefined;
						this.configSvc.appConfig.URLs.stack[this.configSvc.appConfig.URLs.stack.length - 1] = {
							url: this.configSvc.appConfig.URLs.home,
							params: {}
						};
						try {
							redirect = AppCrypto.base64urlDecode(redirect);
							if (this.configSvc.isDebug) {
								console.warn(`<AppComponent>: Redirect to the requested URI => ${redirect}`);
							}
							await this.configSvc.navigateForwardAsync(redirect);
						}
						catch (error) {
							console.error(`<AppComponent>: The requested URI for redirecting is not well-form => ${redirect}`, this.configSvc.isNativeApp ? JSON.stringify(error) : error);
						}
					}
				}
			});
		});
	}

}
