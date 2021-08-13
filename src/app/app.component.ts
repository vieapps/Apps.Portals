import { Component, OnInit } from "@angular/core";
import { Router, RoutesRecognized, NavigationEnd } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { Platform } from "@ionic/angular";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility, AppSidebar, AppSidebarMenuItem } from "@app/components/app.utility";
import { AppFormsService } from "@app/components/forms.service";
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
		visible: true,
		profile: false,
		search: true,
		children: true,
		active: "cms",
		header: {
			thumbnail: undefined as string,
			onThumbnailClick: (_: Event, __: AppSidebar) => {},
			title: undefined as string,
			onTitleClick: (_: Event, __: AppSidebar) => {}
		},
		footer: new Array<{
			name: string,
			icon: string,
			title?: string,
			onClick?: (event: Event, name: string, sidebar: AppSidebar) => void
		}>(),
		top: new Array<{
			title: string,
			link: string,
			params?: { [key: string]: string },
			direction?: string,
			icon?: string,
			onClick?: (event: Event, info: any, sidebar: AppSidebar) => void
		}>(),
		menu: new Array<{
			name: string,
			parent?: {
				title: string,
				thumbnail?: string,
				link: string,
				params?: { [key: string]: string },
				expandable: boolean,
				onClick?: (event: Event, info: any, sidebar: AppSidebar) => void,
				id?: string
			},
			items: Array<AppSidebarMenuItem>
		}>()
	};

	get color() {
		return this.configSvc.color;
	}

	get isSidebarShown() {
		return this.sidebar.visible && this.configSvc.screenWidth >= 1200;
	}

	get isSidebarTopMenuShown() {
		return !(this.sidebar.active === "portals" || this.sidebar.active === "notifications" || this.sidebar.active === "chat" || this.sidebar.active === "preferences");
	}

	get sidebarSignColor() {
		return this.isSidebarShown ? "medium" : "light";
	}

	ngOnInit() {
		this.router.events.subscribe(event => {
			if (event instanceof RoutesRecognized) {
				this.configSvc.appConfig.URLs.routerParams = (event as RoutesRecognized).state.root.params;
				this.configSvc.pushURL((event as RoutesRecognized).url, (event as RoutesRecognized).state.root.queryParams);
				const current = this.configSvc.getCurrentURL();
				AppEvents.broadcast("Navigating", { Url: current.url, Params: current.params });
				if (AppAPIs.isPingPeriodTooLarge) {
					AppAPIs.reopenWebSocket("<AppComponent>: Ping period is too large...");
				}
			}
			else if (event instanceof NavigationEnd) {
				const current = this.configSvc.getCurrentURL();
				AppEvents.broadcast("Navigated", { Url: current.url, Params: current.params });
			}
		});

		this.platform.ready().then(async () => {
			this.configSvc.prepare();
			await Promise.all([
				this.configSvc.loadURIsAsync(),
				this.configSvc.loadOptionsAsync()
			]);
			await this.configSvc.prepareLanguagesAsync();
			this.setupEventHandlers();

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
					this.configSvc.appConfig.app.name = service.appName || this.configSvc.appConfig.app.name;
					this.configSvc.appConfig.services.active = service.name;
				}
			}

			AppEvents.broadcast("App", { Type: "PlatformIsReady" });
			this.sidebar.header.title = this.configSvc.appConfig.app.name;
			await this.updateSidebarAsync({}, true);

			const isActivate = this.configSvc.isWebApp && AppUtility.isEquals("activate", this.configSvc.queryParams["prego"]);
			await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync(`common.messages.${isActivate ? "activating" : "loading"}`));
			await (isActivate ? this.activateAsync() : this.initializeAsync());
		});
	}

	trackSidebarItem(index: number, item: any) {
		return `${item.id || item.name || item.title}@${index}`;
	}

	toggleSidebar() {
		this.sidebar.visible = !this.sidebar.visible;
	}

	private getSidebarItem(itemInfo: any = {}, oldItem: any = {}, onCompleted?: (item: AppSidebarMenuItem) => void) {
		const gotChildren = AppUtility.isArray(itemInfo.children, true) && (itemInfo.children as Array<any>).length > 0;
		const isExpanded = gotChildren && !!itemInfo.expanded;
		const isDetail = !gotChildren && !!itemInfo.detail;
		const icon = itemInfo.icon || {};
		if (icon.name === undefined && (gotChildren || isDetail)) {
			icon.name = isDetail ? "chevron-forward" : isExpanded ? "chevron-down" : "chevron-forward",
			icon.slot = "end";
		}
		const sidebarItem: AppSidebarMenuItem = {
			title: itemInfo.title || oldItem.title,
			link: itemInfo.link || oldItem.link,
			params: itemInfo.params as { [key: string]: string } || oldItem.params,
			direction: itemInfo.direction || oldItem.direction || "forward",
			onClick: typeof itemInfo.onClick === "function"
				? itemInfo.onClick
				: async (_, info, sidebar) => {
					const menuItem = info.childIndex !== undefined
						? sidebar.menu[info.menuIndex].items[info.itemIndex].children[info.childIndex]
						: sidebar.menu[info.menuIndex].items[info.itemIndex];
					await this.configSvc.navigateAsync(menuItem.direction, menuItem.link, menuItem.params);
				},
			children: gotChildren ? (itemInfo.children as Array<any>).map(item => this.getSidebarItem(item)) : [],
			expanded: isExpanded,
			detail: isDetail,
			id: itemInfo.id,
			icon: icon
		};
		if (onCompleted !== undefined) {
			onCompleted(sidebarItem);
		}
		return sidebarItem;
	}

	private async updateSidebarItemAsync(menuIndex: number = -1, itemIndex: number = -1, itemInfo: any = {}) {
		if (menuIndex < 0) {
			menuIndex = 0;
		}
		else if (menuIndex >= this.sidebar.menu.length) {
			menuIndex = this.sidebar.menu.length;
			this.sidebar.menu.push({ name: undefined, items: []});
		}
		this.sidebar.menu[menuIndex].items.update(
			this.getSidebarItem(
				itemInfo,
				itemIndex > -1 && itemIndex < this.sidebar.menu[menuIndex].items.length ? this.sidebar.menu[menuIndex].items[itemIndex] : {},
				async sidebarItem => sidebarItem.title = sidebarItem.title.startsWith("{{") && sidebarItem.title.endsWith("}}")
					? await this.configSvc.getResourceAsync(sidebarItem.title.substr(2, sidebarItem.title.length - 4).trim())
					: sidebarItem.title
			),
			itemIndex
		);
	}

	private async updateSidebarAsync(info: any = {}, updateTopItems: boolean = false) {
		const header = info.header || {};
		this.sidebar.header = {
			thumbnail: header.thumbnail || this.sidebar.header.thumbnail,
			onThumbnailClick: header.onThumbnailClick || this.sidebar.header.onThumbnailClick,
			title: header.title || this.sidebar.header.title,
			onTitleClick: header.onTitleClick || this.sidebar.header.onTitleClick
		};

		if (updateTopItems) {
			const topItems = await this.configSvc.getSidebarTopItemsAsync();
			this.sidebar.top = [topItems.home, topItems.profile, topItems.login, topItems.register, topItems.search];
		}

		let index = info.index !== undefined ? info.index as number : 0;
		if (index < 0) {
			index = this.sidebar.menu.length;
		}
		while (this.sidebar.menu.length < index + 1) {
			this.sidebar.menu.push({
				name: undefined,
				parent: undefined,
				items: []
			});
		}

		if (info.reset !== undefined ? info.reset as boolean : true) {
			this.sidebar.menu[index].items = [];
		}

		this.sidebar.menu[index].name = info.name || this.sidebar.menu[index].name || "menu";
		this.sidebar.menu[index].parent = info.parent !== undefined
			? {
					title: info.parent.title,
					thumbnail: info.parent.thumbnail,
					link: info.parent.link,
					params: info.parent.params,
					expandable: !!info.parent.expandable,
					onClick: typeof info.parent.onClick === "function"
						? info.parent.onClick as (event: Event, info: any, sidebar: AppSidebar) => void
						: () => {}
				}
			: this.sidebar.menu[index].parent;
		if (this.sidebar.menu[index].parent !== undefined && this.sidebar.menu[index].parent.title.startsWith("{{") && this.sidebar.menu[index].parent.title.endsWith("}}")) {
			this.sidebar.menu[index].parent.title = await this.configSvc.getResourceAsync(this.sidebar.menu[index].parent.title.substr(2, this.sidebar.menu[index].parent.title.length - 4).trim());
		}

		await Promise.all((info.items as Array<any> || []).map(item => {
			const icon = item.icon || { name: undefined };
			icon.color = icon.color || "medium";
			icon.slot = icon.slot || "start";
			return {
				title: item.title,
				link: item.link,
				params: item.params,
				direction: item.direction,
				onClick: item.onClick,
				children: item.children,
				expanded: item.expanded,
				detail: item.detail,
				id: item.id,
				icon: icon
			};
		})
		.filter(item => AppUtility.isNotEmpty(item.title) && AppUtility.isNotEmpty(item.link))
		.map(item => this.updateSidebarItemAsync(index, -1, item)));
	}

	private async normalizeSidebarAsync() {
		const topItems = await this.configSvc.getSidebarTopItemsAsync();
		if (this.configSvc.isAuthenticated) {
			this.sidebar.top.removeAt(this.sidebar.top.findIndex(item => item.link.startsWith(topItems.login.link)));
			this.sidebar.top.removeAt(this.sidebar.top.findIndex(item => item.link.startsWith(topItems.register.link)));
			if (!this.sidebar.profile) {
				this.sidebar.top.removeAt(this.sidebar.top.findIndex(item => item.link.startsWith(topItems.profile.link)));
			}
		}
		else {
			this.sidebar.top.removeAt(this.sidebar.top.findIndex(item => item.link.startsWith(topItems.profile.link)));
			if (!this.authSvc.canRegisterNewAccounts) {
				this.sidebar.top.removeAt(this.sidebar.top.findIndex(item => item.link.startsWith(topItems.register.link)));
			}
		}
		if (!this.sidebar.search) {
			this.sidebar.top.removeAt(this.sidebar.top.findIndex(item => item.link.startsWith(topItems.search.link)));
		}
	}

	private updateSidebarImage() {
		const profile = this.configSvc.getAccount().profile;
		if (profile !== undefined) {
			this.sidebar.header.thumbnail = profile.avatarURI;
			this.sidebar.header.onThumbnailClick = () => AppEvents.broadcast("Navigate", { Type: "Profile" });
		}
		else {
			this.sidebar.header.thumbnail = this.sidebar.header.onThumbnailClick = undefined;
		}
	}

	private setupEventHandlers() {
		AppEvents.on("OpenSidebar", _ => this.sidebar.visible = true);
		AppEvents.on("CloseSidebar", _ => this.sidebar.visible = false);
		AppEvents.on("ToggleSidebar", _ => this.toggleSidebar());
		AppEvents.on("ActiveSidebar", info => this.sidebar.active = info.args.name || (this.sidebar.footer.first || {}).name);
		AppEvents.on("UpdateSidebar", async info => await this.updateSidebarAsync(info.args));
		AppEvents.on("UpdateSidebarTitle", info => {
			this.sidebar.header.title = AppUtility.isNotEmpty(info.args.title) ? info.args.title : this.sidebar.header.title;
			this.sidebar.header.onTitleClick = typeof info.args.onClick === "function" ? info.args.onClick : () => {};
		});
		AppEvents.on("AddSidebarItem", async info => await this.updateSidebarItemAsync(info.args.MenuIndex !== undefined ? info.args.MenuIndex : -1, -1, info.args.ItemInfo));
		AppEvents.on("UpdateSidebarItem", async info => await this.updateSidebarItemAsync(info.args.MenuIndex !== undefined ? info.args.MenuIndex : -1, info.args.ItemIndex !== undefined ? info.args.ItemIndex : -1, info.args.ItemInfo));
		AppEvents.on("UpdateSidebarFooter", info => {
			if (!!info.args.reset) {
				this.sidebar.footer = [];
			}
			if (typeof info.args.predicate === "function" ? info.args.predicate(this.sidebar) : true) {
				this.sidebar.footer.insert(info.args.button, info.args.index !== undefined ? info.args.index : 0);
				if (typeof info.args.onCompleted === "function") {
					info.args.onCompleted(this.sidebar);
				}
			}
			if (this.configSvc.isAuthenticated) {
				AppUtility.invoke(async () => {
					if (this.sidebar.footer.length > 0 && this.sidebar.footer.first(button => button.name === "preferences") === undefined) {
						this.sidebar.footer.push({
							name: "preferences",
							icon: "settings",
							title: await this.configSvc.getResourceAsync("common.preferences.label"),
							onClick: (_, name, sidebar) => sidebar.active = name
						});
					}
				}, 1234);
			}
		});

		AppEvents.on("Navigate", async info => {
			const url = AppUtility.isEquals(info.args.Type, "LogIn")
				? this.configSvc.appConfig.URLs.users.login
				: AppUtility.isEquals(info.args.Type, "Profile")
					? this.configSvc.appConfig.URLs.users.profile + "/my"
					: AppUtility.isEquals(info.args.Type, "Accounts")
						? this.configSvc.appConfig.URLs.users.list
						: info.args.Url;
			switch ((info.args.Direction as string || "Forward").toLowerCase()) {
				case "home":
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

		AppEvents.on("App", async info => {
			if ("LanguageChanged" === info.args.Type) {
				await this.updateSidebarAsync({}, true);
				await this.normalizeSidebarAsync();
				AppEvents.sendToElectron("App", { Type: "LanguageChanged", Language: this.configSvc.appConfig.language });
			}
		});

		AppEvents.on("Session", async info => {
			if ("LogIn" === info.args.Type || "LogOut" === info.args.Type) {
				await this.updateSidebarAsync({}, true);
				await this.normalizeSidebarAsync();
				if ("LogOut" === info.args.Type) {
					this.sidebar.header.title = this.configSvc.appConfig.app.name;
					this.sidebar.header.onTitleClick = () => {};
					this.updateSidebarImage();
				}
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type) {
				this.updateSidebarImage();
			}
		});

		AppEvents.on("Account", info => {
			if ("Updated" === info.args.Type) {
				this.updateSidebarImage();
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
					TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("common.loading.activate"), `users/activate/${mode}`),
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
			async () => {
				this.configSvc.appConfig.URLs.stack[this.configSvc.appConfig.URLs.stack.length - 1] = {
					url: this.configSvc.appConfig.URLs.home,
					params: {}
				};
				await this.router.navigateByUrl(this.configSvc.appConfig.URLs.home);
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
			await this.normalizeSidebarAsync();
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
