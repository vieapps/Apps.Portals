declare var FB: any;
import { Injectable } from "@angular/core";
import { PlatformLocation } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Title as BrowserTitle } from "@angular/platform-browser";
import { Platform, NavController } from "@ionic/angular";
import { Storage } from "@ionic/storage";
import { Device } from "@ionic-native/device/ngx";
import { Keyboard } from "@ionic-native/keyboard/ngx";
import { AppVersion } from "@ionic-native/app-version/ngx";
import { GoogleAnalytics } from "@ionic-native/google-analytics/ngx";
import { InAppBrowser } from "@ionic-native/in-app-browser/ngx";
import { Clipboard } from "@ionic-native/clipboard/ngx";
import { TranslateService } from "@ngx-translate/core";
import { ElectronService } from "ngx-electron";
import { AppConfig } from "@app/app.config";
import { AppStorage } from "@app/components/app.storage";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppAPIs } from "@app/components/app.apis";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { Account } from "@app/models/account";
import { Privilege } from "@app/models/privileges";
import { Base as BaseService, ServiceLog } from "@app/services/base.service";

@Injectable()
export class ConfigurationService extends BaseService {

	constructor(
		private platformLocation: PlatformLocation,
		private platform: Platform,
		private navController: NavController,
		private device: Device,
		private keyboard: Keyboard,
		private inappBrowser: InAppBrowser,
		private clipboard: Clipboard,
		private appVersion: AppVersion,
		private googleAnalytics: GoogleAnalytics,
		private storage: Storage,
		private browserTitle: BrowserTitle,
		private translateSvc: TranslateService,
		private electronSvc: ElectronService,
		http: HttpClient
	) {
		super("Configuration");
		AppEvents.initialize();
		AppAPIs.initialize(http);
		AppAPIs.registerAsServiceScopeProcessor("Refresher", () => this.reloadGeoMetaAsync());
		AppStorage.initializeAsync(this.storage, () => this.showLog(`Storage is ready. Driver: ${this.storage.driver}`));
	}

	private _definitions: { [key: string]: any } = {};

	serviceLogs = new Array<ServiceLog>();

	/** Gets the configuration of the app */
	get appConfig() {
		return AppConfig;
	}

	/** Gets the state that determines the app is ready to go */
	get isReady() {
		return AppConfig.isReady;
	}

	/** Gets the state that determines the current account is authenticated or not */
	get isAuthenticated() {
		return AppConfig.isAuthenticated;
	}

	/** Gets the state that determines the app is running in debug mode or not */
	get isDebug() {
		return AppConfig.isDebug;
	}

	/** Gets the state that determines is native app */
	get isNativeApp() {
		return AppConfig.isNativeApp;
	}

	/** Gets the state that determines is web progressive app */
	get isWebApp() {
		return AppConfig.isWebApp;
	}

	/** Gets the state that determines the app is running on iOS (native or web browser) */
	get isRunningOnIOS() {
		return AppConfig.isRunningOnIOS;
	}

	/** Gets the available languages for working with the app */
	get languages() {
		return AppConfig.languages;
	}

	/** Gets the current locale code for working with i18n globalization */
	get locale() {
		return AppConfig.locale;
	}

	/** Gets the available locales for working with the app */
	get locales() {
		return AppConfig.locales;
	}

	/** Gets the color of the theme (dark or light) */
	get color() {
		return "dark" === AppConfig.options.theme ? "dark" : undefined;
	}

	/** Gets the locale data for working with i18n globalization */
	getLocaleData(locale: string) {
		return AppConfig.getLocaleData(locale);
	}

	/** Gets the current working URL */
	getCurrentURL() {
		return AppConfig.URLs.stack.last();
	}

	/** Gets the previous URL */
	getPreviousURL() {
		return AppConfig.URLs.stack.previousLast();
	}

	/** Pushs/Adds an URL into stack of routes */
	pushURL(url: string, params: { [key: string]: any }) {
		url = url.indexOf("?") > 0 ? url.substr(0, url.indexOf("?")) : url;
		if (url === AppConfig.URLs.home) {
			AppConfig.URLs.stack.removeAll();
		}
		const previousURL = this.getPreviousURL();
		const currentURL = this.getCurrentURL();
		if (previousURL !== undefined && previousURL.url.startsWith(url)) {
			AppConfig.URLs.stack.pop();
		}
		else if (currentURL === undefined || !currentURL.url.startsWith(url)) {
			AppConfig.URLs.stack.push({ url: url, params: params });
		}
		if (AppConfig.URLs.stack.length > 30) {
			AppConfig.URLs.stack.clear(0, AppConfig.URLs.stack.length - 30);
		}
	}

	/** Removes the current working URL from the stack, also pop the current view */
	popURL() {
		this.navController.pop().then(() => AppConfig.URLs.stack.pop());
	}

	/** Gets the URL for opening the app on web-browser */
	getAppURL(path?: string) {
		return (AppConfig.isWebApp ? AppUtility.parseURI().HostURI + AppConfig.URLs.base : AppConfig.URIs.apps) + (AppUtility.isEmpty(path) ? "" : path[0] === "/" ? AppUtility.right(path, path.length - 1) : path);
	}

	/** Gets the current working URL */
	get currentURL() {
		return AppUtility.getURI(this.getCurrentURL());
	}

	/** Gets the previous URL */
	get previousURL() {
		return AppUtility.getURI(this.getPreviousURL());
	}

	/** Gets the URL for activating new account/password */
	get activateURL() {
		return AppCrypto.base64urlEncode(this.getAppURL("home?prego=activate&mode={{mode}}&code={{code}}"));
	}

	/** Sets the app title (means title of the browser) */
	set appTitle(value: string) {
		this.browserTitle.setTitle(`${value} :: ${AppConfig.app.name}`);
	}

	/** Gets the query with related service, language and host */
	get relatedQuery() {
		return AppConfig.getRelatedQuery();
	}

	/** Gets the router params of the current page/view */
	get routerParams() {
		return AppConfig.URLs.routerParams;
	}

	/** Gets the query params of the current page/view */
	get queryParams() {
		const info = this.getCurrentURL() || { params : {} as { [key: string]: any } };
		return info.params;
	}

	/** Gets the request params of the current page/view (means decoded JSON of 'x-request' query parameter) */
	get requestParams() {
		const params = this.queryParams["x-request"];
		return AppUtility.isNotEmpty(params) ? AppCrypto.jsonDecode(params) : {};
	}

	/** Gets the width (pixels) of the screen */
	get screenWidth(): number {
		return this.platform.width();
	}

	/** Gets the width (pixels) of the screen */
	get screenHeight(): number {
		return this.platform.height();
	}

	/** Gets the file-size limits */
	get fileLimits() {
		let limits = AppConfig.options.extras.fileLimits as { avatar: number; thumbnail: number; file: number };
		if (!AppUtility.isObject(limits, true)) {
			limits = {
				avatar: 1024000,
				thumbnail: 524288,
				file: 819200000
			};
			AppConfig.options.extras.fileLimits = limits;
			this.saveOptionsAsync(() => console.log("[Configuration]: file limits were updated"));
		}
		return limits;
	}

	/** Prepare the configuration of the app */
	prepare() {
		const isCordova = this.platform.is("cordova");
		const isNativeApp = isCordova && (this.device.platform === "iOS" || this.device.platform === "Android");
		const isElectronApp = this.electronSvc !== undefined && this.electronSvc.isElectronApp;
		const userAgent = navigator ? navigator.userAgent : "";
		const platform = isNativeApp
			? this.device.platform
			: /iPhone|iPad|iPod|Windows Phone|Android|BlackBerry|BB10|IEMobile|webOS|Opera Mini/i.test(userAgent)
				? /iPhone|iPad|iPod/i.test(userAgent)
					? "iOS"
					: /Android/i.test(userAgent)
						? "Android"
						: /Windows Phone/i.test(userAgent)
							? "Windows Phone"
							: /BlackBerry|BB10/i.test(userAgent)
								? "BlackBerry"
								: "Mobile"
				: "Desktop";

		AppConfig.app.mode = isNativeApp ? "NTA" : "PWA";
		AppConfig.app.os = platform !== "Desktop"
			? platform
			: /Windows/i.test(userAgent)
				? "Windows"
				: /Linux/i.test(userAgent)
					? "Linux"
					: /Macintosh/i.test(userAgent)
						? "macOS"
						: "Generic OS";

		const uri = AppUtility.parseURI();
		if (uri.Host.indexOf(".") < 0) {
			AppConfig.URLs.host = uri.Host;
		}
		else {
			let host = uri.HostNames[uri.HostNames.length - 2] + "." + uri.HostNames[uri.HostNames.length - 1];
			if (uri.HostNames.length > 2 && uri.HostNames[uri.HostNames.length - 3] !== "www") {
				host = uri.HostNames[uri.HostNames.length - 3] + "." + host;
			}
			if (uri.HostNames.length > 3 && uri.HostNames[uri.HostNames.length - 4] !== "www") {
				host = uri.HostNames[uri.HostNames.length - 4] + "." + host;
			}
			AppConfig.URLs.host = host;
		}

		if (isNativeApp) {
			AppConfig.URLs.base = "";
			AppConfig.app.platform = this.device.platform;
			AppConfig.session.device = `${this.device.uuid}@${AppConfig.app.id}-${this.device.platform.toLocaleLowerCase()}`;
		}

		else {
			AppConfig.URLs.base = this.platformLocation.getBaseHrefFromDOM();
			AppConfig.app.platform = `${platform} ${AppConfig.app.mode}`;
			if (AppUtility.isEmpty(AppConfig.session.device)) {
				AppConfig.session.device = `${AppCrypto.md5(`${userAgent}${Math.random()}`)}@${AppConfig.app.id}-${isElectronApp ? "electron" : "pwa"}`;
			}
		}

		if (isElectronApp) {
			AppEvents.initializeElectronService(this.electronSvc);
			PlatformUtility.setElectronService(this.electronSvc);
			AppConfig.app.shell = "Electron";
			AppConfig.app.mode = "Desktop";
			AppConfig.URLs.base = "";
			AppConfig.app.platform = `${AppConfig.app.os} Desktop`;
			if (this.electronSvc.ipcRenderer) {
				this.electronSvc.ipcRenderer.on("electron.ipc2app", ($event: any, $info: any) => AppUtility.invoke(() => {
					$info = $info || {};
					if (AppUtility.isNotEmpty($info.event)) {
						AppEvents.broadcast($info.event, $info.args);
						if (this.isDebug) {
							console.log("[Electron]: Got an IPC message", $event, $info);
						}
					}
				}));
			}
		}
		else {
			AppConfig.app.shell = isNativeApp ? "Cordova" : "Browser";
			if (isCordova && isNativeApp) {
				this.appVersion.getVersionCode()
					.then(version => AppConfig.app.version = isNativeApp && !this.isRunningOnIOS ? (version + "").replace(/0/g, ".") : version + "")
					.catch(error => this.showError("Error occurred while preparing the app version", error));
				PlatformUtility.setInAppBrowser(this.inappBrowser);
				PlatformUtility.setClipboard(this.clipboard);
				if (!this.isRunningOnIOS) {
					PlatformUtility.setKeyboard(this.keyboard);
				}
			}
		}

		if (isCordova) {
			TrackingUtility.initializeAsync(this.googleAnalytics);
			if (this.isDebug) {
				console.log(`Device Information\n- UUID: ${this.device.uuid}\n- Manufacturer: ${this.device.manufacturer}\n- Model: ${this.device.model}\n- Serial: ${this.device.serial}\n- Platform: ${this.device.platform} ${this.device.platform !== "browser" ? this.device.version : "[" + this.device.model + " v" + this.device.version + "]"}`);
			}
		}
	}

	/** Initializes the configuration settings of the app */
	initializeAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontInitializeSession: boolean = false) {
		return this.loadSessionAsync()
			.then(() => dontInitializeSession ? AppUtility.invoke(onSuccess) : this.initializeSessionAsync(onSuccess, onError))
			.then(() => AppUtility.invoke(() => this.loadGeoMetaAsync(), 1234));
	}

	/** Initializes the session with remote APIs */
	initializeSessionAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.fetchAsync(
			"users/session",
			data => {
				if (this.isDebug) {
					this.showLog("The session was initialized by APIs");
				}
				this.updateSessionAsync(data, _ => {
					AppConfig.session.account = this.getAccount(!this.isAuthenticated);
					if (this.isAuthenticated) {
						AppConfig.session.account.id = AppConfig.session.token.uid;
					}
					AppEvents.broadcast("Session", { Type: this.isAuthenticated ? "Registered" : "Initialized" });
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				});
			},
			error => this.showError("Error occurred while initializing the session", error, onError)
		);
	}

	/** Registers the initialized session (anonymous) with remote APIs */
	registerSessionAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.fetchAsync(
			`users/session?register=${AppConfig.session.id}`,
			() => {
				AppConfig.session.account = this.getAccount(true);
				if (this.isDebug) {
					this.showLog("The session was registered by APIs");
				}
				AppEvents.broadcast("Session", { Type: "Registered" });
				this.storeSessionAsync(onSuccess);
			},
			error => this.showError("Error occurred while registering the session", error, onError)
		);
	}

	/** Updates the session and stores into storage */
	updateSessionAsync(session: any, onNext?: (data?: any) => void, dontStore: boolean = false, fetch: boolean = true) {
		if (AppUtility.isNotEmpty(session.ID)) {
			AppConfig.session.id = session.ID;
		}

		if (AppUtility.isNotEmpty(session.DeviceID)) {
			AppConfig.session.device = session.DeviceID;
		}

		if (AppUtility.isObject(session.Keys, true)) {
			AppConfig.session.keys = {
				jwt: session.Keys.JWT,
				aes: {
					key: session.Keys.AES.Key,
					iv: session.Keys.AES.IV
				},
				rsa: {
					encryptionExponent: session.Keys.RSA.EncryptionExponent,
					decryptionExponent: session.Keys.RSA.DecryptionExponent,
					exponent: session.Keys.RSA.Exponent,
					modulus: session.Keys.RSA.Modulus
				}
			};
			AppCrypto.init(AppConfig.session.keys);
		}

		if (AppUtility.isNotEmpty(session.Token)) {
			try {
				AppConfig.session.token = AppCrypto.jwtDecode(session.Token);
				AppAPIs.authenticateWebSocket();
			}
			catch (error) {
				AppConfig.session.token = undefined;
				this.showError("Error occurred while decoding token =>" + session.Token, error);
			}
		}

		AppConfig.session.account = this.getAccount(!this.isAuthenticated);
		if (this.isAuthenticated) {
			AppConfig.session.account.id = AppConfig.session.token.uid;
			if (fetch) {
				AppAPIs.sendWebSocketRequest({
					ServiceName: "Users",
					ObjectName: "Account",
					Query: AppConfig.getRelatedJson({ "x-status": "true" })
				});
				AppAPIs.sendWebSocketRequest({
					ServiceName: "Users",
					ObjectName: "Profile",
					Query: AppConfig.getRelatedJson({ "object-identity": AppConfig.session.account.id })
				});
			}
		}

		return dontStore
			? AppUtility.invoke(onNext !== undefined ? () => onNext(AppConfig.session) : undefined)
			: this.storeSessionAsync(onNext);
	}

	/** Loads the session from storage */
	async loadSessionAsync(onNext?: (data?: any) => void) {
		try {
			const session = await AppStorage.getAsync("Session");
			if (AppUtility.isObject(session, true)) {
				AppConfig.session = AppUtility.parse(AppUtility.stringify(session));
				AppEvents.broadcast("Session", { Type: "Loaded", Mode: "Storage" });
				AppConfig.session.account = Account.deserialize(AppConfig.session.account);
				if (AppConfig.session.account.id !== undefined) {
					Account.set(AppConfig.session.account);
					AppEvents.broadcast("Account", { Type: "Loaded", Mode: "Storage" });
				}
			}
		}
		catch (error) {
			this.showError("Error occurred while loading the session from storage", error);
		}
		if (onNext !== undefined) {
			onNext(AppConfig.session);
		}
	}

	/** Saves the session into storage */
	async saveSessionAsync(onNext?: (data?: any) => void) {
		if (AppConfig.app.persistence) {
			try {
				await AppStorage.setAsync("Session", AppUtility.clone(AppConfig.session, ["jwt", "captcha"]));
			}
			catch (error) {
				this.showError("Error occurred while storing the session into storage", error);
			}
		}
		if (onNext !== undefined) {
			onNext(AppConfig.session);
		}
	}

	/** Stores the session into storage */
	storeSessionAsync(onNext?: (data?: any) => void) {
		return this.saveSessionAsync(data => {
			AppEvents.broadcast("Session", { Type: "Updated" });
			if (onNext !== undefined) {
				onNext(data);
			}
		});
	}

	/** Deletes the session from storage */
	async deleteSessionAsync(onNext?: (data?: any) => void) {
		try {
			await AppStorage.removeAsync("Session");
		}
		catch (error) {
			this.showError("Error occurred while deleting the session from storage", error);
		}
		if (onNext !== undefined) {
			onNext(AppConfig.session);
		}
	}

	/** Resets session information and re-store into storage */
	resetSessionAsync(onNext?: (data?: any) => void, doStore: boolean = true) {
		AppConfig.session.id = undefined;
		AppConfig.session.token = undefined;
		AppConfig.session.keys = undefined;
		AppConfig.session.account = this.getAccount(true);
		return this.deleteSessionAsync(doStore ? async () => await this.storeSessionAsync(onNext) : onNext);
	}

	/** Gets the information of the current/default account */
	getAccount(getDefault: boolean = false) {
		return (getDefault ? undefined : AppConfig.session.account) || new Account();
	}

	/** Updates information of the account */
	updateAccount(data: any, onNext?: (data?: any) => void, updateInstances: boolean = false) {
		const id = data.ID || "";
		const account = Account.get(id) || new Account();

		if (account.id === undefined) {
			account.id = data.ID;
		}

		if (data.Type !== undefined) {
			account.type = data.Type;
		}

		if (AppUtility.isArray(data.Roles, true)) {
			account.roles = (data.Roles as Array<string>).distinct();
		}

		if (AppUtility.isArray(data.Privileges, true)) {
			account.privileges = (data.Privileges as Array<any>).map(privilege => Privilege.deserialize(privilege));
		}

		if (data.Status !== undefined) {
			account.status = data.Status as string;
		}

		if (AppUtility.isObject(data.TwoFactorsAuthentication, true)) {
			account.twoFactors = {
				required: AppUtility.isTrue(data.TwoFactorsAuthentication.Required),
				providers: AppUtility.isArray(data.TwoFactorsAuthentication.Providers, true)
					? (data.TwoFactorsAuthentication.Providers as Array<any>).map(provider => ({
							Label: provider.Label,
							Type: provider.Type,
							Time: new Date(provider.Time),
							Info: provider.Info
						}))
					: []
			};
		}

		if (this.isAuthenticated && this.getAccount().id === account.id) {
			AppConfig.session.account = account;
			Account.set(account);
			if (AppConfig.app.persistence) {
				this.storeSessionAsync(onNext);
			}
			else if (onNext !== undefined) {
				onNext(data);
			}
		}
		else {
			if (account.id !== undefined && (updateInstances || Account.contains(account.id))) {
				Account.set(account);
			}
			if (onNext !== undefined) {
				onNext(data);
			}
		}
	}

	/** Watch the connection of Facebook */
	watchFacebookConnect() {
		FB.Event.subscribe(
			"auth.authResponseChange",
			(response: any) => {
				if (response.status === "connected") {
					AppConfig.facebook.token = response.authResponse.accessToken;
					AppConfig.facebook.id = response.authResponse.userID;
					this.showLog("Facebook is connected", AppConfig.isDebug ? AppConfig.facebook : "");
					if (AppConfig.session.account.facebook !== undefined) {
						this.getFacebookProfile();
					}
				}
				else {
					AppConfig.facebook.token = undefined;
				}
			}
		);
	}

	/** Get the information of Facebook profile */
	getFacebookProfile() {
		FB.api(
			`/${AppConfig.facebook.version}/me?fields=id,name,picture&access_token=${AppConfig.facebook.token}`,
			(response: any) => {
				AppConfig.session.account.facebook = {
					id: response.id,
					name: response.name,
					profileUrl: `https://www.facebook.com/app_scoped_user_id/${response.id}`,
					pictureUrl: undefined
				};
				this.storeSessionAsync(() => this.showLog("Account is updated with information of Facebook profile", AppConfig.isDebug ? AppConfig.session.account : ""));
				this.getFacebookAvatar();
			}
		);
	}

	/** Get the avatar picture (large picture) of Facebook profile */
	getFacebookAvatar() {
		if (AppConfig.session.account.facebook && AppConfig.session.account.facebook.id && AppConfig.session.token && AppConfig.session.token.oauths
			&& AppConfig.session.token.oauths["facebook"] && AppConfig.session.token.oauths["facebook"] === AppConfig.session.account.facebook.id) {
			FB.api(
				`/${AppConfig.facebook.version}/${AppConfig.session.account.facebook.id}/picture?type=large&redirect=false&access_token=${AppConfig.facebook.token}`,
				(response: any) => {
					AppConfig.session.account.facebook.pictureUrl = response.data.url;
					this.storeSessionAsync(() => this.showLog("Account is updated with information of Facebook profile (large profile picture)", AppConfig.isDebug ? response : ""));
				}
			);
		}
	}

	/** Sends a request to navigates as root */
	async navigateRootAsync(url?: string, params?: { [key: string]: any }) {
		url = !!url ? AppUtility.getURI({ url: url, params: params }) : AppConfig.URLs.home;
		await this.navController.navigateRoot(url);
	}

	/** Sends a request to navigates back one step */
	async navigateBackAsync(url?: string, params?: { [key: string]: any }) {
		if (!!url) {
			await this.navController.navigateBack(AppUtility.getURI({ url: url, params: params }));
		}
		else {
			this.popURL();
		}
	}

	/** Sends a request to navigates forward one step */
	async navigateForwardAsync(url: string, params?: { [key: string]: any }) {
		url = !!url ? AppUtility.getURI({ url: url, params: params }) : AppConfig.URLs.home;
		await this.navController.navigateForward(url);
	}

	/** Sends a request to navigates */
	navigateAsync(direction?: string, url?: string, params?: { [key: string]: any }) {
		switch ((direction || "forward").toLocaleLowerCase()) {
			case "forward":
				return this.navigateForwardAsync(url, params);
			case "back":
				return this.navigateBackAsync(url, params);
			case "home":
			case "root":
				return this.navigateRootAsync(url, params);
			default:
				return this.navigateForwardAsync(url, params);
		}
	}

	private async loadGeoMetaAsync() {
		AppConfig.geoMeta.country = await AppStorage.getAsync("GeoMeta-Country") || "VN";
		AppConfig.geoMeta.countries = await AppStorage.getAsync("GeoMeta-Countries") || [];
		AppConfig.geoMeta.provinces = await AppStorage.getAsync("GeoMeta-Provinces") || {};

		if (AppConfig.geoMeta.provinces[AppConfig.geoMeta.country] !== undefined) {
			AppEvents.broadcast("App", { Type: "GeoMeta", Mode: "Updated", Data: AppConfig.geoMeta });
		}

		await this.fetchAsync(
			`statics/geo/provinces/${AppConfig.geoMeta.country || "VN"}.json`,
			provinces => AppUtility.invoke(() => this.saveGeoMetaAsync(provinces, () => this.fetchAsync(
				"statics/geo/countries.json",
				countries => this.saveGeoMetaAsync(countries),
				error => this.showError("Error occurred while fetching the meta countries", error)
			)), 1234),
			error => this.showError("Error occurred while fetching the meta provinces", error)
		);
	}

	private saveGeoMetaAsync(data: any, onNext?: (data?: any) => void) {
		if (AppUtility.isObject(data, true) && AppUtility.isNotEmpty(data.code) && AppUtility.isArray(data.provinces, true)) {
			AppConfig.geoMeta.provinces[data.code] = data;
		}
		else if (AppUtility.isObject(data, true) && AppUtility.isArray(data.countries, true)) {
			AppConfig.geoMeta.countries = data.countries;
		}
		return Promise.all([
			AppStorage.setAsync("GeoMeta-Country", AppConfig.geoMeta.country),
			AppStorage.setAsync("GeoMeta-Countries", AppConfig.geoMeta.countries),
			AppStorage.setAsync("GeoMeta-Provinces", AppConfig.geoMeta.provinces)
		]).then(() => {
			AppEvents.broadcast("App", { Type: "GeoMeta", Mode: "Updated", Data: AppConfig.geoMeta });
			if (onNext !== undefined) {
				onNext(data);
			}
		});
	}

	private reloadGeoMetaAsync() {
		AppConfig.geoMeta.countries = [];
		AppConfig.geoMeta.provinces = {};
		return Promise.all([
			AppStorage.removeAsync("GeoMeta-Countries"),
			AppStorage.removeAsync("GeoMeta-Provinces")
		]).then(() => this.loadGeoMetaAsync());
	}

	/** Loads the URI settings of the app */
	async loadURIsAsync(onNext?: (data?: any) => void) {
		const uris = await AppStorage.getAsync("URIs") || {};
		if (uris.apis !== undefined && uris.updates !== undefined && uris.files !== undefined) {
			AppConfig.URIs = uris;
			await this.storeURIsAsync(onNext);
		}
		else if (onNext !== undefined) {
			onNext(uris);
		}
	}

	/** Stores the URI settings of the app */
	storeURIsAsync(onNext?: (data?: any) => void) {
		return AppStorage.setAsync("URIs", AppConfig.URIs).then(() => {
			AppEvents.broadcast("App", { Type: "URIsUpdated" });
			if (this.isDebug) {
				this.showLog("URIs are updated", AppConfig.URIs);
			}
			if (onNext !== undefined) {
				onNext(AppConfig.URIs);
			}
		});
	}

	/** Loads the options of the app */
	async loadOptionsAsync(onNext?: (data?: any) => void) {
		const options = await AppStorage.getAsync("Options") || {};
		if (options.i18n !== undefined && options.timezone !== undefined && options.extras !== undefined) {
			AppConfig.options = options;
			AppConfig.options.theme = AppConfig.options.theme || "light";
			AppEvents.broadcast("App", { Type: "Options", Mode: "Loaded" });
			await this.saveOptionsAsync(onNext);
		}
		else if (onNext !== undefined) {
			onNext(options);
		}
	}

	/** Updates the options of the app */
	updateOptionsAsync(options: any, onNext?: (data?: any) => void) {
		AppUtility.toKeyValuePair(options).forEach(kvp => AppConfig.options[kvp.key] = kvp.value);
		return this.saveOptionsAsync(onNext);
	}

	/** Stores the options of the app */
	storeOptionsAsync(onNext?: (data?: any) => void) {
		return this.saveOptionsAsync(() => {
			AppEvents.broadcast("App", { Type: "Options", Mode: "Updated" });
			if (onNext !== undefined) {
				onNext(AppConfig.options);
			}
		});
	}

	/** Saves the options of the app into storage */
	saveOptionsAsync(onNext?: (data?: any) => void) {
		return AppStorage.setAsync("Options", AppConfig.options).then(() => {
			if (onNext !== undefined) {
				onNext(AppConfig.options);
			}
		});
	}

	/** Prepares the UI languages */
	prepareLanguagesAsync() {
		this.translateSvc.addLangs(this.languages.map(language => language.Value));
		this.translateSvc.setDefaultLang(AppConfig.language);
		return this.setResourceLanguageAsync(AppConfig.language);
	}

	/** Changes the language & locale of resources to use in the app */
	changeLanguageAsync(language: string, saveOptions: boolean = true) {
		AppConfig.options.i18n = language;
		return this.setResourceLanguageAsync(language).then(() => {
			AppEvents.broadcast("App", { Type: "Language", Mode: "Changed", Language: language });
			AppEvents.sendToElectron("App", { Type: "Language", Mode: "Changed", Language: language });
			AppUtility.invoke(saveOptions ? () => this.saveOptionsAsync() : undefined);
		});
	}

	/** Sets the language & locale of resources to use in the app */
	setResourceLanguageAsync(language: string) {
		return AppUtility.toAsync<void>(this.translateSvc.use(language));
	}

	/** Gets the resource (of the current language) by a key */
	async getResourceAsync(key: string, interpolateParams?: object) {
		return await AppUtility.toAsync<string>(this.translateSvc.get(key, interpolateParams));
	}

	/** Gets the resources (of the current language) by a key */
	async getResourcesAsync(key: string) {
		return await AppUtility.toAsync<{ [key: string]: string }>(this.translateSvc.get(key));
	}

	/** Definitions (forms, views, resources, ...) */
	addDefinition(path: string, definition: any) {
		this._definitions[AppCrypto.md5(path.toLowerCase())] = definition;
	}

	getDefinition(path: string) {
		return this._definitions[AppCrypto.md5(path.toLowerCase())];
	}

	async fetchDefinitionAsync(path: string, doClone: boolean = true) {
		let definition = this.getDefinition(path);
		if (definition === undefined) {
			await this.fetchAsync(
				path,
				data => this.addDefinition(path, data),
				error => this.showError("Error occurred while working with definitions", error)
			);
			definition = this.getDefinition(path);
		}
		return doClone ? AppUtility.clone(definition) : definition;
	}

	getDefinitionPath(serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		let path = "discovery/definitions?";
		if (AppUtility.isNotEmpty(serviceName)) {
			path += `x-service-name=${serviceName.toLowerCase()}&`;
		}
		if (AppUtility.isNotEmpty(objectName)) {
			path += `x-object-name=${objectName.toLowerCase()}&`;
		}
		if (AppUtility.isNotEmpty(definitionName)) {
			path += `x-object-identity=${definitionName.toLowerCase()}&`;
		}
		if (AppUtility.isObject(query, true)) {
			path += `${AppUtility.toQuery(query)}&`;
		}
		return path + AppConfig.getRelatedQuery(serviceName, undefined, json => {
			if (AppUtility.isNotEmpty(serviceName) && AppUtility.isEquals(serviceName, json["related-service"])) {
				delete json["related-service"];
				delete json["active-id"];
			}
		});
	}

	setDefinition(definition: any, serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		this.addDefinition(this.getDefinitionPath(serviceName, objectName, definitionName, query), definition);
	}

	async getDefinitionAsync(serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		return await this.fetchDefinitionAsync(this.getDefinitionPath(serviceName, objectName, definitionName, query));
	}

	removeDefinition(serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		const path = this.getDefinitionPath(serviceName, objectName, definitionName, query);
		delete this._definitions[AppCrypto.md5(path.toLowerCase())];
	}

	getInstructionsAsync(service: string, language?: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.fetchAsync(`statics/instructions/${service.toLowerCase()}/${language || AppConfig.language}.json`, onSuccess, onError);
	}

	/** Gets service logs */
	getServiceLogsAsync(request: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = true) {
		return this.searchAsync(this.getSearchingPath(undefined, undefined, "logs"), request, onSuccess, onError, true, undefined, useXHR);
	}

	flushCachingStoragesAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		return this.sendRequestAsync(
			{
				ServiceName: "cache",
				ObjectName: "flush",
				Verb: "GET"
			},
			onSuccess,
			error => this.processError("Error occurred while flushing caching storages", error, onError),
			useXHR
		);
	}

}
