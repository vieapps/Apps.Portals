import { Component, OnInit } from "@angular/core";
import { Router, RoutesRecognized, NavigationEnd } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { Platform } from "@ionic/angular";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { AppRTU, AppXHR } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsService } from "@app/components/forms.service";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";

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
		http: HttpClient
	) {
		if (this.configSvc.isDebug) {
			console.log("<AppComponent>: Initializing...");
		}
		AppXHR.initialize(http);
	}

	sidebar = {
		visible: true,
		profile: false,
		search: true,
		active: "cms",
		header: {
			title: undefined as string,
			thumbnail: undefined as string,
			onClick: () => {}
		},
		footer: new Array<{
			name: string,
			icon: string,
			title?: string,
			onClick?: (name: string, sidebar: any) => void
		}>(),
		top: new Array<{
			title: string,
			link: string,
			queryParams?: { [key: string]: any },
			direction?: string,
			detail: boolean,
			icon?: string,
			thumbnail?: string,
			onClick?: (sidebar: any) => void
		}>(),
		menu: new Array<{
			name: string,
			parent?: {
				title: string,
				link: string,
				queryParams?: { [key: string]: any },
				detail: boolean,
				icon?: string,
				thumbnail?: string,
				onClick?: (info: any, sidebar: any) => void
			},
			items: Array<{
				title: string,
				link: string,
				queryParams?: { [key: string]: any },
				direction?: string,
				detail: boolean,
				icon?: string,
				thumbnail?: string,
				onClick?: (info: any, sidebar: any) => void
			}>
		}>()
	};

	get color() {
		return this.configSvc.color;
	}

	get isSidebarShown() {
		return this.sidebar.visible && this.configSvc.screenWidth >= 1200;
	}

	get sidebarSignColor() {
		return this.isSidebarShown ? "medium" : "light";
	}

	ngOnInit() {
		this.router.events.subscribe(event => {
			if (event instanceof RoutesRecognized) {
				this.configSvc.appConfig.url.routerParams = (event as RoutesRecognized).state.root.params;
				this.configSvc.pushUrl((event as RoutesRecognized).url, (event as RoutesRecognized).state.root.queryParams);
				const current = this.configSvc.getCurrentUrl();
				AppEvents.broadcast("Navigating", { Url: current.url, Params: current.params });
				if (new Date().getTime() - AppRTU.pingTime > 300000) { // 5 minutes
					AppRTU.restart("[Router]: Ping period is too large...");
				}
			}
			else if (event instanceof NavigationEnd) {
				const current = this.configSvc.getCurrentUrl();
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
			AppEvents.broadcast("App", { Type: "PlatformIsReady" });

			if (this.platform.is("cordova")) {
				this.splashScreen.hide();
				if (this.configSvc.isNativeApp) {
					this.statusBar.styleDefault();
					this.statusBar.overlaysWebView(false);
				}
			}

			this.sidebar.header.title = this.configSvc.appConfig.app.name;
			await this.updateSidebarAsync({}, true);

			const isActivate = this.configSvc.isWebApp && AppUtility.isEquals("activate", this.configSvc.queryParams["prego"]);
			await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync(`common.messages.${isActivate ? "activating" : "loading"}`));
			await (isActivate ? this.activateAsync() : this.initializeAsync());
		});
	}

	trackSidebarItem(index: number, item: any) {
		return `${item.title || item.icon}@${index}`;
	}

	toggleSidebar() {
		this.sidebar.visible = !this.sidebar.visible;
	}

	private async updateSidebarItemAsync(menuIndex: number = -1, itemIndex: number = -1, itemInfo: any = {}) {
		if (menuIndex < 0) {
			menuIndex = 0;
		}
		else if (menuIndex >= this.sidebar.menu.length) {
			menuIndex = this.sidebar.menu.length;
			this.sidebar.menu.push({ name: undefined, items: []});
		}

		const oldItem = itemIndex > -1 && itemIndex < this.sidebar.menu[menuIndex].items.length
			? this.sidebar.menu[menuIndex].items[itemIndex]
			: {
					title: undefined as string,
					link: undefined as string,
					queryParams: undefined as { [key: string]: any },
					icon: undefined as string,
					thumbnail: undefined as string,
					direction: undefined as string
				};

		const updatedItem: {
			title: string,
			link: string,
			queryParams?: { [key: string]: any },
			icon?: string,
			thumbnail?: string,
			direction?: string,
			detail: boolean,
			onClick?: (info: any, sidebar: any) => void
		} = {
			title: itemInfo.title || oldItem.title,
			link: itemInfo.link || oldItem.link,
			queryParams: itemInfo.queryParams as { [key: string]: any } || oldItem.queryParams,
			direction: itemInfo.direction || oldItem.direction || "forward",
			icon: itemInfo.icon || oldItem.icon,
			thumbnail: itemInfo.thumbnail || oldItem.thumbnail,
			detail: !!itemInfo.detail,
			onClick: itemInfo.onClick !== undefined && typeof itemInfo.onClick === "function" ? itemInfo.onClick : () => {}
		};

		updatedItem.title = updatedItem.title.startsWith("{{") && updatedItem.title.endsWith("}}")
			? await this.configSvc.getResourceAsync(updatedItem.title.substr(2, updatedItem.title.length - 4).trim())
			: updatedItem.title;

		this.sidebar.menu[menuIndex].items.update(updatedItem, itemIndex);
	}

	private async updateSidebarAsync(info: any = {}, updateTopItems: boolean = false) {
		const header = info.header || {};
		this.sidebar.header = {
			title: header.title || this.sidebar.header.title,
			thumbnail: header.thumbnail || this.sidebar.header.thumbnail,
			onClick: header.onClick || this.sidebar.header.onClick
		},

		this.sidebar.footer = await this.portalsCoreSvc.getSidebarFooterButtonsAsync();
		if (this.sidebar.footer.length > 0 && this.configSvc.isAuthenticated) {
			this.sidebar.footer.push({
				name: "preferences",
				icon: "settings",
				title: await this.configSvc.getResourceAsync("common.preferences.label"),
				onClick: (name, sidebar) => sidebar.active = name
			});
		}

		if (updateTopItems) {
			const topItems = await this.configSvc.getSidebarTopItemsAsync();
			this.sidebar.top = [topItems.home, topItems.profile, topItems.login, topItems.register, topItems.search];
		}

		const index = info.index !== undefined ? info.index as number : 0;
		while (this.sidebar.menu.length <= index) {
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
					link: info.parent.link,
					queryParams: info.parent.queryParams,
					detail: !!info.parent.detail,
					icon: info.parent.icon,
					thumbnail: info.parent.thumbnail,
					onClick: info.parent.onClick !== undefined && typeof info.parent.onClick === "function" ? info.parent.onClick as (info: any, sidebar: any) => void : () => {}
				}
			: this.sidebar.menu[index].parent;

		await Promise.all((info.items as Array<any> || []).map(item => {
			return {
				title: item.title,
				link: item.link,
				queryParams: item.queryParams,
				direction: item.direction,
				detail: item.detail,
				icon: item.icon,
				thumbnail: item.thumbnail,
				onClick: item.onClick
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

	private setupEventHandlers() {
		AppEvents.on("OpenSidebar", _ => this.sidebar.visible = true);
		AppEvents.on("CloseSidebar", _ => this.sidebar.visible = false);
		AppEvents.on("ToggleSidebar", _ => this.toggleSidebar());
		AppEvents.on("ActiveSidebar", info => this.sidebar.active = info.args.name || "cms");

		AppEvents.on("UpdateSidebar", async info => await this.updateSidebarAsync(info.args));
		AppEvents.on("UpdateSidebarTitle", info => this.sidebar.header.title = AppUtility.isNotEmpty(info.args.Title) ? info.args.Title : this.sidebar.header.title);

		AppEvents.on("Navigate", async info => {
			const url = AppUtility.isEquals(info.args.Type, "LogIn")
				? this.configSvc.appConfig.url.users.login
				: AppUtility.isEquals(info.args.Type, "Profile")
					? this.configSvc.appConfig.url.users.profile + "/my"
					: AppUtility.isEquals(info.args.Type, "Accounts")
						? this.configSvc.appConfig.url.users.list
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

		AppEvents.on("Profile", async info => {
			if (AppUtility.isEquals(info.args.Type, "Updated")) {
				const profile = this.configSvc.getAccount().profile;
				if (profile !== undefined) {
					this.sidebar.header = {
						title: profile.Name,
						thumbnail: profile.avatarURI,
						onClick: () => {}
					};
				}
				else {
					this.sidebar.header.title = this.configSvc.appConfig.app.name;
					this.sidebar.header.thumbnail = undefined;
				}
			}
		});

		AppEvents.on("App", async info => {
			if (AppUtility.isEquals(info.args.Type, "LanguageChanged")) {
				await this.updateSidebarAsync({}, true);
				await this.normalizeSidebarAsync();
				AppEvents.sendToElectron("App", { Type: "LanguageChanged", Language: this.configSvc.appConfig.language });
			}
		});

		AppEvents.on("Session", async info => {
			if (AppUtility.isEquals(info.args.Type, "LogIn") || AppUtility.isEquals(info.args.Type, "LogOut")) {
				await this.updateSidebarAsync({}, true);
				await this.normalizeSidebarAsync();
				this.sidebar.active = "cms";
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
				this.configSvc.appConfig.url.stack[this.configSvc.appConfig.url.stack.length - 1] = {
					url: this.configSvc.appConfig.url.home,
					params: {}
				};
				await this.router.navigateByUrl(this.configSvc.appConfig.url.home);
			}
		);
	}

	private initializeAsync(onNext?: () => void, noInitializeSession?: boolean) {
		return this.configSvc.initializeAsync(
			async _ => {
				if (this.configSvc.isReady && this.configSvc.isAuthenticated) {
					console.log("<AppComponent>: The session is initialized & registered (user)", this.configSvc.isDebug ? this.configSvc.isNativeApp ? JSON.stringify(this.configSvc.appConfig.session) : this.configSvc.appConfig.session : "");
					this.finalize(onNext);
				}
				else {
					console.log("<AppComponent>: Register the initialized session (anonymous)", this.configSvc.isDebug ? this.configSvc.isNativeApp ? JSON.stringify(this.configSvc.appConfig.session) : this.configSvc.appConfig.session : "");
					await this.configSvc.registerSessionAsync(
						() => {
							console.log("<AppComponent>: The session is registered (anonymous)", this.configSvc.isDebug ? this.configSvc.isNativeApp ? JSON.stringify(this.configSvc.appConfig.session) : this.configSvc.appConfig.session : "");
							this.finalize(onNext);
						},
						async error => {
							if (AppUtility.isGotSecurityException(error)) {
								console.warn("<AppComponent>: Cannot register, the session is need to be re-initialized (anonymous)");
								await this.configSvc.resetSessionAsync(() => PlatformUtility.invoke(async () => await this.initializeAsync(onNext, noInitializeSession), 234));
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
					await this.configSvc.resetSessionAsync(() => PlatformUtility.invoke(async () => await this.initializeAsync(onNext, noInitializeSession), 234));
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
		console.log("<AppComponent>: The app was initialized", this.configSvc.isNativeApp ? JSON.stringify(appConfig.app) : appConfig.app);
		if (this.configSvc.isWebApp) {
			PlatformUtility.preparePWAEnvironment(() => this.configSvc.watchFacebookConnect());
		}

		AppRTU.start(() => {
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
			this.appFormsSvc.hideLoadingAsync(async () => {
				await this.normalizeSidebarAsync();
				await this.portalsCoreSvc.initializeAysnc();
				await this.portalsCmsSvc.initializeAsync();
				if (onNext !== undefined) {
					onNext();
				}
				else {
					let redirect = this.configSvc.queryParams["redirect"] as string || this.configSvc.appConfig.url.redirectToWhenReady;
					if (redirect !== undefined) {
						this.configSvc.appConfig.url.redirectToWhenReady = undefined;
						this.configSvc.appConfig.url.stack[this.configSvc.appConfig.url.stack.length - 1] = {
							url: this.configSvc.appConfig.url.home,
							params: {}
						};
						try {
							redirect = AppCrypto.urlDecode(redirect);
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
				AppEvents.broadcast("App", { Type: "FullyInitialized" });
			});
		});
	}

}
