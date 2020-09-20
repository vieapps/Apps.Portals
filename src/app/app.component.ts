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
		http: HttpClient
	) {
		if (this.configSvc.isDebug) {
			console.log("<AppComponent>: Initializing...");
		}
		AppXHR.initialize(http);
	}

	sidebar = {
		visible: true,
		active: "menu",
		menu: new Array<{
			title?: string,
			icon?: string,
			thumbnail?: string,
			parent?: {
				title: string,
				url: string,
				queryParams?: { [key: string]: any },
				direction?: string,
				onClick?: (info: any, sidebar: any) => void
			},
			items: Array<{
				title: string,
				url: string,
				queryParams?: { [key: string]: any },
				icon?: string,
				thumbnail?: string,
				direction?: string,
				detail: boolean,
				onClick?: (info: any, sidebar: any) => void
			}>
		}>(),
		header: {
			image: undefined as string,
			title: undefined as string,
			routerLink: undefined as string,
			routerParams: undefined as { [key: string]: any },
			routerDirection: "forward",
			onClick: () => {}
		},
		footer: new Array<{
			name: string,
			icon: string,
			title?: string,
			onClick?: (name: string, sidebar: any) => void
		}>(),
		home: {
			title: "common.sidebar.home",
			url: this.configSvc.appConfig.url.home,
			queryParams: undefined as { [key: string]: any },
			direction: "root",
			icon: "home",
			thumbnail: undefined as string,
			detail: false,
			onClick: () => {}
		}
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

	get appShell() {
		return this.configSvc.appConfig.app.shell;
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
			await this.updateSidebarAsync();

			const isActivate = this.configSvc.isWebApp && AppUtility.isEquals("activate", this.configSvc.queryParams["prego"]);
			await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync(`common.messages.${isActivate ? "activating" : "loading"}`));
			await (isActivate ? this.activateAsync() : this.initializeAsync());
		});
	}

	trackSidebarItem(index: number, item: any) {
		return `${item.title || item.icon}@${index}`;
	}

	toogleSidebar() {
		this.sidebar.visible = !this.sidebar.visible;
	}

	private async getSidebarItemsAsync() {
		return {
			home: {
				title: await this.configSvc.getResourceAsync(this.sidebar.home.title),
				url: this.sidebar.home.url,
				queryParams: this.sidebar.home.queryParams,
				direction: this.sidebar.home.direction,
				icon: this.sidebar.home.icon,
				thumbnail: this.sidebar.home.thumbnail,
				detail: this.sidebar.home.detail,
				onClick: this.sidebar.home.onClick !== undefined && typeof this.sidebar.home.onClick === "function" ? this.sidebar.home.onClick : () => {}
			},
			login: {
				title: await this.configSvc.getResourceAsync("common.sidebar.login"),
				url: this.configSvc.appConfig.url.users.login,
				queryParams: undefined as { [key: string]: any },
				direction: "forward",
				icon: "log-in",
				thumbnail: undefined as string,
				detail: false,
				onClick: () => {}
			},
			register: {
				title: await this.configSvc.getResourceAsync("common.sidebar.register"),
				url: this.configSvc.appConfig.url.users.register,
				queryParams: undefined as { [key: string]: any },
				direction: "forward",
				icon: "person-add",
				thumbnail: undefined as string,
				detail: false,
				onClick: () => {}
			},
			profile: {
				title: await this.configSvc.getResourceAsync("common.sidebar.profile"),
				url: `${this.configSvc.appConfig.url.users.profile}/my`,
				queryParams: undefined as { [key: string]: any },
				direction: "forward",
				icon: "person",
				thumbnail: undefined as string,
				detail: false,
				onClick: () => {}
			}
		};
	}

	private updateSidebar(args: any = {}) {
		this.updateSidebarItem(args.MenuIndex !== undefined ? args.MenuIndex : -1, -1, args.ItemInfo);
	}

	private updateSidebarItem(menuIndex: number = -1, itemIndex: number = -1, itemInfo: any = {}) {
		if (menuIndex < 0) {
			menuIndex = 0;
		}
		else if (menuIndex >= this.sidebar.menu.length) {
			menuIndex = this.sidebar.menu.length;
			this.sidebar.menu.push({ items: []});
		}
		const oldItem = itemIndex > -1 && itemIndex < this.sidebar.menu[menuIndex].items.length
			? this.sidebar.menu[menuIndex].items[itemIndex]
			: {
					title: undefined as string,
					url: undefined as string,
					queryParams: undefined as { [key: string]: any },
					icon: undefined as string,
					thumbnail: undefined as string,
					direction: undefined as string
				};
		const updatedItem = {
			title: itemInfo.title || oldItem.title,
			url: itemInfo.url || oldItem.url,
			queryParams: itemInfo.queryParams as { [key: string]: any } || oldItem.queryParams,
			direction: itemInfo.direction || oldItem.direction || "forward",
			icon: itemInfo.icon || oldItem.icon,
			thumbnail: itemInfo.thumbnail || oldItem.thumbnail,
			detail: !!itemInfo.detail,
			onClick: itemInfo.onClick !== undefined && typeof itemInfo.onClick === "function" ? itemInfo.onClick : () => {}
		};
		if (itemIndex > -1 && itemIndex < this.sidebar.menu[menuIndex].items.length) {
			this.sidebar.menu[menuIndex].items[itemIndex] = updatedItem;
		}
		else {
			AppUtility.insertAt(this.sidebar.menu[menuIndex].items, updatedItem, itemIndex);
		}
	}

	private async updateSidebarAsync(info: any = {}) {
		const index = info.index !== undefined ? info.index as number : 0;
		while (this.sidebar.menu.length < index + 1) {
			this.sidebar.menu.push({
				title: undefined,
				icon: undefined,
				thumbnail: undefined,
				parent: undefined,
				items: []
			});
		}

		if (info.reset !== undefined ? info.reset as boolean : true) {
			this.sidebar.menu[index].items = [];
		}

		if (index === 0) {
			const sidebarItems = await this.getSidebarItemsAsync();
			this.updateSidebarItem(index, -1, sidebarItems.home);

			if (this.configSvc.isAuthenticated) {
				this.updateSidebarItem(index, -1, sidebarItems.profile);
			}
			else {
				this.updateSidebarItem(index, -1, sidebarItems.login);
			}

			if (this.authSvc.canRegisterNewAccounts) {
				this.updateSidebarItem(index, -1, sidebarItems.register);
			}
		}
		else {
			this.sidebar.menu[index].title = info.title;
			this.sidebar.menu[index].icon = info.icon;
			this.sidebar.menu[index].thumbnail = info.thumbnail;
		}

		(info.items as Array<any> || []).map(item => {
			return {
				title: item.title,
				url: item.url,
				queryParams: item.queryParams,
				direction: item.direction,
				icon: item.icon,
				thumbnail: item.thumbnail,
				detail: item.detail,
				onClick: item.onClick
			};
		})
		.filter(item => AppUtility.isNotEmpty(item.title) && AppUtility.isNotEmpty(item.url))
		.forEach(item => this.updateSidebarItem(index, -1, item));

		this.sidebar.footer = await this.portalsCoreSvc.getSidebarButtonsAsync();

		if (this.sidebar.footer.length > 0) {
			this.sidebar.footer.push({
				name: "preferences",
				icon: "settings",
				title: await this.configSvc.getResourceAsync("common.preferences.label"),
				onClick: (name, sidebar) => sidebar.active = name
			});
		}
	}

	private async normalizeSidebarMenuAsync() {
		const sidebarItems = await this.getSidebarItemsAsync();
		const items = this.sidebar.menu[0].items;
		if (this.configSvc.isAuthenticated) {
			AppUtility.removeAt(items, items.findIndex(item => item.url.startsWith(sidebarItems.register.url)));
			const index = items.findIndex(item => item.url.startsWith(sidebarItems.login.url));
			if (index > -1) {
				items[index] = sidebarItems.profile;
			}
			else if (items.findIndex(item => item.url.startsWith(sidebarItems.profile.url)) < 0) {
				AppUtility.insertAt(items, sidebarItems.profile);
			}
		}
		else {
			if (items.findIndex(item => item.url.startsWith(sidebarItems.login.url)) < 0) {
				const index = items.findIndex(item => item.url.startsWith(sidebarItems.profile.url));
				if (index > -1) {
					items[index] = sidebarItems.login;
				}
				else {
					AppUtility.insertAt(items, sidebarItems.login);
				}
			}
			if (this.authSvc.canRegisterNewAccounts && items.findIndex(item => item.url.startsWith(sidebarItems.register.url)) < 0) {
				const index = items.findIndex(item => item.url.startsWith(sidebarItems.login.url));
				AppUtility.insertAt(items, sidebarItems.register, index > -1 ? index + 1 : -1);
			}
		}
	}

	private setupEventHandlers() {
		AppEvents.on("OpenSidebar", _ => this.sidebar.visible = true);
		AppEvents.on("CloseSidebar", _ => this.sidebar.visible = false);
		AppEvents.on("ToggleSidebar", _ => this.toogleSidebar());

		AppEvents.on("UpdateSidebar", async info => await this.updateSidebarAsync(info.args));
		AppEvents.on("UpdateSidebarTitle", info => this.sidebar.header.title = AppUtility.isNotEmpty(info.args.Title) ? info.args.Title : this.sidebar.header.title);
		AppEvents.on("UpdateSidebarHome", info => this.sidebar.home = info.args);

		AppEvents.on("AddSidebarItem", info => this.updateSidebar(info.args));
		AppEvents.on("UpdateSidebarItem", info => this.updateSidebar(info.args));

		AppEvents.on("Navigate", async info => {
			const url = "LogIn" === info.args.Type
				? this.configSvc.appConfig.url.users.login
				: "Profile" === info.args.Type
					? this.configSvc.appConfig.url.users.profile + "/my"
					: "Accounts" === info.args.Type
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
			if ("Updated" === info.args.Type) {
				const profile = this.configSvc.getAccount().profile;
				if (profile !== undefined) {
					this.sidebar.header.title = profile.Name;
					this.sidebar.header.image = profile.avatarURI;
					this.sidebar.header.routerLink = `${this.configSvc.appConfig.url.users.profile}/my`;
					this.sidebar.header.routerParams = undefined;
					this.sidebar.header.routerDirection = "forward";
				}
				else {
					this.sidebar.header.title = this.configSvc.appConfig.app.name;
					this.sidebar.header.image = this.sidebar.header.routerLink = undefined;
				}
				await this.normalizeSidebarMenuAsync();
			}
		});

		AppEvents.on("App", async info => {
			if ("LanguageChanged" === info.args.Type) {
				await this.updateSidebarAsync();
				await this.normalizeSidebarMenuAsync();
				AppEvents.sendToElectron("App", { Type: "LanguageChanged", Language: this.configSvc.appConfig.language });
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
				await this.portalsCoreSvc.initializeAysnc();
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
