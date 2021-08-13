declare var FB: any;
import { Injectable } from "@angular/core";
import { PlatformLocation } from "@angular/common";
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
import { UserProfile } from "@app/models/user";
import { Base as BaseService } from "@app/services/base.service";

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
		private electronSvc: ElectronService
	) {
		super("Configuration");
		AppStorage.initializeAsync(this.storage, () => this.showLog(`Storage is ready. Driver: ${this.storage.driver}`));
		AppAPIs.registerAsServiceScopeProcessor("Refresher", async () => await this.reloadGeoMetaAsync());
		AppEvents.on("App", async info => await ("PlatformIsReady" === info.args.Type ? this.loadGeoMetaAsync() : new Promise<void>(() => {})));
	}

	private _definitions: { [key: string]: any } = {};

	public logs = new Array<ServiceLog>();

	/** Gets the configuration of the app */
	public get appConfig() {
		return AppConfig;
	}

	/** Gets the state that determines the app is ready to go */
	public get isReady() {
		return this.appConfig.isReady;
	}

	/** Gets the state that determines the current account is authenticated or not */
	public get isAuthenticated() {
		return this.appConfig.isAuthenticated;
	}

	/** Gets the state that determines the app is running in debug mode or not */
	public get isDebug() {
		return this.appConfig.isDebug;
	}

	/** Gets the state that determines is native app */
	public get isNativeApp() {
		return this.appConfig.isNativeApp;
	}

	/** Gets the state that determines is web progressive app */
	public get isWebApp() {
		return this.appConfig.isWebApp;
	}

	/** Gets the state that determines the app is running on iOS (native or web browser) */
	public get isRunningOnIOS() {
		return this.appConfig.isRunningOnIOS;
	}

	/** Gets the available languages for working with the app */
	public get languages() {
		return this.appConfig.languages;
	}

	/** Gets the current locale code for working with i18n globalization */
	public get locale() {
		return this.appConfig.locale;
	}

	/** Gets the available locales for working with the app */
	public get locales() {
		return this.appConfig.locales;
	}

	/** Gets the color of the theme (dark or light) */
	public get color() {
		return "dark" === this.appConfig.options.theme ? "dark" : undefined;
	}

	/** Gets the locale data for working with i18n globalization */
	public getLocaleData(locale: string) {
		return this.appConfig.getLocaleData(locale);
	}

	/** Gets the current working URL */
	public getCurrentURL() {
		return this.appConfig.URLs.stack.length > 0 ? this.appConfig.URLs.stack[this.appConfig.URLs.stack.length - 1] : undefined;
	}

	/** Gets the previous URL */
	public getPreviousURL() {
		return this.appConfig.URLs.stack.length > 1 ? this.appConfig.URLs.stack[this.appConfig.URLs.stack.length - 2] : undefined;
	}

	/** Pushs/Adds an URL into stack of routes */
	public pushURL(url: string, params: { [key: string]: any }) {
		url = url.indexOf("?") > 0 ? url.substr(0, url.indexOf("?")) : url;
		this.appConfig.URLs.stack = url !== this.appConfig.URLs.home ? this.appConfig.URLs.stack : [];
		const previous = this.getPreviousURL();
		const current = this.getCurrentURL();
		if (previous !== undefined && previous.url.startsWith(url)) {
			this.appConfig.URLs.stack.pop();
		}
		else if (current === undefined || !current.url.startsWith(url)) {
			this.appConfig.URLs.stack.push({
				url: url,
				params: params
			});
		}
		if (this.appConfig.URLs.stack.length > 30) {
			this.appConfig.URLs.stack.splice(0, this.appConfig.URLs.stack.length - 30);
		}
	}

	/** Removes the current working URL from the stack, also pop the current view */
	public popURL() {
		this.navController.pop().then(() => this.appConfig.URLs.stack.pop());
	}

	private getURL(info: { url: string, params: { [key: string]: any } }, alternativeUrl?: string) {
		if (info === undefined) {
			return alternativeUrl || this.appConfig.URLs.home;
		}
		else {
			const query = AppUtility.toQuery(info.params);
			return info.url + (query !== "" ? (info.url.indexOf("?") > 0 ? "&" : "?") + query : "");
		}
	}

	/** Gets the URL for opening the app on web-browser */
	public getAppURL(path?: string) {
		return (this.appConfig.isWebApp ? AppUtility.parseURI().HostURI + this.appConfig.URLs.base : this.appConfig.URIs.apps) + (AppUtility.isEmpty(path) ? "" : path[0] === "/" ? AppUtility.right(path, path.length - 1) : path);
	}

	/** Gets the current working URL */
	public get currentURL() {
		return this.getURL(this.getCurrentURL());
	}

	/** Gets the previous URL */
	public get previousURL() {
		return this.getURL(this.getPreviousURL());
	}

	/** Gets the URL for activating new account/password */
	public get activateURL() {
		return AppCrypto.base64urlEncode(this.getAppURL("home?prego=activate&mode={{mode}}&code={{code}}"));
	}

	/** Sets the app title (means title of the browser) */
	public set appTitle(value: string) {
		this.browserTitle.setTitle(`${value} :: ${this.appConfig.app.name}`);
	}

	/** Gets the query with related service, language and host */
	public get relatedQuery() {
		return this.appConfig.getRelatedQuery();
	}

	/** Gets the router params of the current page/view */
	public get routerParams() {
		return this.appConfig.URLs.routerParams;
	}

	/** Gets the query params of the current page/view */
	public get queryParams() {
		const current = this.getCurrentURL();
		return current !== undefined ? current.params : {} as { [key: string]: any };
	}

	/** Gets the request params of the current page/view (means decoded JSON of 'x-request' query parameter) */
	public get requestParams() {
		const params = this.queryParams["x-request"];
		return AppUtility.isNotEmpty(params) ? AppCrypto.jsonDecode(params) : {};
	}

	/** Gets the width (pixels) of the screen */
	public get screenWidth(): number {
		return this.platform.width();
	}

	/** Gets the width (pixels) of the screen */
	public get screenHeight(): number {
		return this.platform.height();
	}

	/** Gets the file-size limits */
	public get fileLimits() {
		let limits = this.appConfig.options.extras.fileLimits as { avatar: number; thumbnail: number; file: number };
		if (!AppUtility.isObject(limits, true)) {
			limits = {
				avatar: 1024000,
				thumbnail: 524288,
				file: 819200000
			};
			this.appConfig.options.extras.fileLimits = limits;
			this.saveOptionsAsync(() => console.log("[Configuration]: file limits were updated"));
		}
		return limits;
	}

	/** Prepare the configuration of the app */
	public prepare() {
		const isCordova = this.platform.is("cordova");
		const isNativeApp = isCordova && (this.device.platform === "iOS" || this.device.platform === "Android");
		this.appConfig.app.mode = isNativeApp ? "NTA" : "PWA";

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

		this.appConfig.app.os = platform !== "Desktop"
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
			this.appConfig.URLs.host = uri.Host;
		}
		else {
			let host = uri.HostNames[uri.HostNames.length - 2] + "." + uri.HostNames[uri.HostNames.length - 1];
			if (uri.HostNames.length > 2 && uri.HostNames[uri.HostNames.length - 3] !== "www") {
				host = uri.HostNames[uri.HostNames.length - 3] + "." + host;
			}
			if (uri.HostNames.length > 3 && uri.HostNames[uri.HostNames.length - 4] !== "www") {
				host = uri.HostNames[uri.HostNames.length - 4] + "." + host;
			}
			this.appConfig.URLs.host = host;
		}

		if (isNativeApp) {
			this.appConfig.URLs.base = "";
			this.appConfig.app.platform = this.device.platform;
			this.appConfig.session.device = this.device.uuid + "@" + this.appConfig.app.id;
		}

		else {
			this.appConfig.URLs.base = this.platformLocation.getBaseHrefFromDOM();
			this.appConfig.app.platform = `${platform} ${this.appConfig.app.mode}`;
		}

		if (isCordova) {
			if (isNativeApp) {
				this.appVersion.getVersionCode()
					.then(version => this.appConfig.app.version = isNativeApp && !this.isRunningOnIOS ? (version + "").replace(/0/g, ".") : version + "")
					.catch(error => this.showError("Error occurred while preparing the app version", error));
				PlatformUtility.setInAppBrowser(this.inappBrowser);
				PlatformUtility.setClipboard(this.clipboard);
				if (!this.isRunningOnIOS) {
					PlatformUtility.setKeyboard(this.keyboard);
				}
			}

			TrackingUtility.initializeAsync(this.googleAnalytics);
			if (this.isDebug) {
				this.showLog(`Device Info\n- UUID: ${this.device.uuid}\n- Manufacturer: ${this.device.manufacturer}\n- Model: ${this.device.model}\n- Serial: ${this.device.serial}\n- Platform: ${this.device.platform} ${this.device.platform !== "browser" ? this.device.version : "[" + this.device.model + " v" + this.device.version + "]"}`);
			}
		}

		if (this.electronSvc !== undefined && this.electronSvc.isElectronApp) {
			AppEvents.initializeElectronService(this.electronSvc);
			PlatformUtility.setElectronService(this.electronSvc);
			this.appConfig.app.shell = "Electron";
			this.appConfig.app.mode = "Desktop";
			this.appConfig.URLs.base = "";
			this.appConfig.app.platform = `${this.appConfig.app.os} Desktop`;
			if (this.electronSvc.ipcRenderer) {
				this.electronSvc.ipcRenderer.on("electron.ipc2app", ($event: any, $info: any) => {
					$info = $info || {};
					if (AppUtility.isNotEmpty($info.event)) {
						AppEvents.broadcast($info.event, $info.args);
					}
					if (this.isDebug) {
						console.log("[Electron]: Got an IPC message", $event, $info);
					}
				});
			}
		}
		else {
			this.appConfig.app.shell = isNativeApp ? "Cordova" : "Browser";
		}
	}

	/** Initializes the configuration settings of the app */
	public async initializeAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontInitializeSession: boolean = false) {
		// prepare environment
		if (this.appConfig.app.mode === "") {
			this.prepare();
		}

		// load saved session
		if (this.appConfig.session.token === undefined || this.appConfig.session.keys === undefined) {
			await this.loadSessionAsync();
		}

		// initialize session
		if (!dontInitializeSession) {
			await this.initializeSessionAsync(onSuccess, onError);
		}
		else if (onSuccess !== undefined) {
			onSuccess();
		}
	}

	/** Initializes the session with remote APIs */
	public async initializeSessionAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.fetchAsync(
			"users/session",
			async data => {
				if (this.isDebug) {
					this.showLog("The session was initialized by APIs");
				}
				await this.updateSessionAsync(data, _ => {
					this.appConfig.session.account = this.getAccount(!this.isAuthenticated);
					if (this.isAuthenticated) {
						this.appConfig.session.account.id = this.appConfig.session.token.uid;
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
	public async registerSessionAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.fetchAsync(
			`users/session?register=${this.appConfig.session.id}`,
			async _ => {
				this.appConfig.session.account = this.getAccount(true);
				if (this.isDebug) {
					this.showLog("The session was registered by APIs");
				}
				AppEvents.broadcast("Session", { Type: "Registered" });
				await this.storeSessionAsync(onSuccess);
			},
			error => this.showError("Error occurred while registering the session", error, onError)
		);
	}

	/** Updates the session and stores into storage */
	public async updateSessionAsync(session: any, onNext?: (data?: any) => void, dontStore: boolean = false, broadcast: boolean = true, fetch: boolean = true) {
		if (AppUtility.isNotEmpty(session.ID)) {
			this.appConfig.session.id = session.ID;
		}

		if (AppUtility.isNotEmpty(session.DeviceID)) {
			this.appConfig.session.device = session.DeviceID;
		}

		if (AppUtility.isObject(session.Keys, true)) {
			this.appConfig.session.keys = {
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
			AppCrypto.init(this.appConfig.session.keys);
		}

		if (AppUtility.isNotEmpty(session.Token)) {
			try {
				this.appConfig.session.token = AppCrypto.jwtDecode(session.Token);
				AppAPIs.authenticateWebSocket();
			}
			catch (error) {
				this.appConfig.session.token = undefined;
				this.showError("Error occurred while decoding token =>" + session.Token, error);
			}
		}

		this.appConfig.session.account = this.getAccount(!this.isAuthenticated);
		if (this.isAuthenticated) {
			this.appConfig.session.account.id = this.appConfig.session.token.uid;
			if (broadcast && this.appConfig.session.account.profile !== undefined) {
				AppEvents.broadcast("Profile", { Type: "Updated", Mode: "Storage" });
			}
			if (fetch) {
				AppAPIs.sendWebSocketRequest({
					ServiceName: "Users",
					ObjectName: "Account",
					Query: this.appConfig.getRelatedJson({ "x-status": "true" })
				});
				AppAPIs.sendWebSocketRequest({
					ServiceName: "Users",
					ObjectName: "Profile",
					Query: this.appConfig.getRelatedJson({ "object-identity": this.appConfig.session.account.id })
				});
			}
		}

		if (dontStore) {
			if (onNext !== undefined) {
				onNext(this.appConfig.session);
			}
		}
		else {
			await this.storeSessionAsync(onNext);
		}
	}

	/** Loads the session from storage */
	public async loadSessionAsync(onNext?: (data?: any) => void) {
		try {
			const session = await AppStorage.getAsync("Session");
			if (AppUtility.isObject(session, true)) {
				this.appConfig.session = AppUtility.parse(AppUtility.stringify(session));
				AppEvents.broadcast("Session", { Type: "Loaded", Mode: "Storage" });
				this.appConfig.session.account = Account.deserialize(this.appConfig.session.account);
				if (this.appConfig.session.account.id !== undefined) {
					Account.set(this.appConfig.session.account);
					if (this.appConfig.session.account.profile !== undefined) {
						AppEvents.broadcast("Profile", { Type: "Updated", Mode: "Storage" });
					}
				}
			}
		}
		catch (error) {
			this.showError("Error occurred while loading the session from storage", error);
		}
		if (onNext !== undefined) {
			onNext(this.appConfig.session);
		}
	}

	/** Stores the session into storage */
	public async storeSessionAsync(onNext?: (data?: any) => void) {
		if (this.appConfig.app.persistence) {
			try {
				await AppStorage.setAsync("Session", AppUtility.clone(this.appConfig.session, ["jwt", "captcha"]));
			}
			catch (error) {
				this.showError("Error occurred while storing the session into storage", error);
			}
		}
		AppEvents.broadcast("Session", { Type: "Updated" });
		if (onNext !== undefined) {
			onNext(this.appConfig.session);
		}
	}

	/** Deletes the session from storage */
	public async deleteSessionAsync(onNext?: (data?: any) => void) {
		try {
			await AppStorage.removeAsync("Session");
		}
		catch (error) {
			this.showError("Error occurred while deleting the session from storage", error);
		}
		if (onNext !== undefined) {
			onNext(this.appConfig.session);
		}
	}

	/** Resets session information and re-store into storage */
	public async resetSessionAsync(onNext?: (data?: any) => void, doStore: boolean = true) {
		this.appConfig.session.id = undefined;
		this.appConfig.session.token = undefined;
		this.appConfig.session.keys = undefined;
		this.appConfig.session.account = this.getAccount(true);
		await this.deleteSessionAsync(doStore ? async () => await this.storeSessionAsync(onNext) : onNext);
	}

	/** Gets the information of the current/default account */
	public getAccount(getDefault: boolean = false) {
		return (getDefault ? undefined : this.appConfig.session.account) || new Account();
	}

	/** Updates information of the account */
	public updateAccount(data: any, onNext?: (data?: any) => void, updateInstances: boolean = false) {
		const id = data.ID || "";
		const account = Account.get(id) || new Account();

		if (account.id === undefined) {
			account.id = data.ID;
		}

		if (AppUtility.isArray(data.Roles, true)) {
			account.roles = (data.Roles as Array<string>).distinct();
		}

		if (AppUtility.isArray(data.Privileges, true)) {
			account.privileges = (data.Privileges as Array<any>).map(privilege => Privilege.deserialize(privilege));
		}

		if (AppUtility.isNotEmpty(data.Status)) {
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
			this.appConfig.session.account = account;
			Account.set(account);
			if (this.appConfig.app.persistence) {
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
	public watchFacebookConnect() {
		FB.Event.subscribe(
			"auth.authResponseChange",
			(response: any) => {
				if (response.status === "connected") {
					this.appConfig.facebook.token = response.authResponse.accessToken;
					this.appConfig.facebook.id = response.authResponse.userID;
					this.showLog("Facebook is connected", this.appConfig.isDebug ? this.appConfig.facebook : "");
					if (this.appConfig.session.account.facebook !== undefined) {
						this.getFacebookProfile();
					}
				}
				else {
					this.appConfig.facebook.token = undefined;
				}
			}
		);
	}

	/** Get the information of Facebook profile */
	public getFacebookProfile() {
		FB.api(
			`/${this.appConfig.facebook.version}/me?fields=id,name,picture&access_token=${this.appConfig.facebook.token}`,
			(response: any) => {
				this.appConfig.session.account.facebook = {
					id: response.id,
					name: response.name,
					profileUrl: `https://www.facebook.com/app_scoped_user_id/${response.id}`,
					pictureUrl: undefined
				};
				this.storeSessionAsync(() => this.showLog("Account is updated with information of Facebook profile", this.appConfig.isDebug ? this.appConfig.session.account : ""));
				this.getFacebookAvatar();
			}
		);
	}

	/** Get the avatar picture (large picture) of Facebook profile */
	public getFacebookAvatar() {
		if (this.appConfig.session.account.facebook && this.appConfig.session.account.facebook.id && this.appConfig.session.token && this.appConfig.session.token.oauths
			&& this.appConfig.session.token.oauths["facebook"] && this.appConfig.session.token.oauths["facebook"] === this.appConfig.session.account.facebook.id) {
			FB.api(
				`/${this.appConfig.facebook.version}/${this.appConfig.session.account.facebook.id}/picture?type=large&redirect=false&access_token=${this.appConfig.facebook.token}`,
				(response: any) => {
					this.appConfig.session.account.facebook.pictureUrl = response.data.url;
					this.storeSessionAsync(() => this.showLog("Account is updated with information of Facebook profile (large profile picture)", this.appConfig.isDebug ? response : ""));
				}
			);
		}
	}

	/** Gets the navigating URL */
	public getNavigatingURL(url?: string, params?: { [key: string]: any }) {
		url = url || this.appConfig.URLs.home;
		return url + (AppUtility.isGotData(params) ? `${url.indexOf("?") > 0 ? "&" : "?"}${AppUtility.toQuery(params)}` : "");
	}

	/** Sends a request to navigates to home screen */
	public async navigateHomeAsync(url?: string, params?: { [key: string]: any }) {
		await this.navController.navigateRoot(this.getNavigatingURL(url || this.appConfig.URLs.home, params));
	}

	/** Sends a request to navigates back one step */
	public async navigateBackAsync(url?: string, params?: { [key: string]: any }) {
		await this.navController.navigateBack(this.getNavigatingURL(url || this.previousURL, params));
	}

	/** Sends a request to navigates forward one step */
	public async navigateForwardAsync(url: string, params?: { [key: string]: any }) {
		await this.navController.navigateForward(this.getNavigatingURL(url || this.appConfig.URLs.home, params));
	}

	/** Sends a request to navigates */
	public async navigateAsync(direction?: string, url?: string, params?: { [key: string]: any }) {
		switch ((direction || "forward").toLocaleLowerCase()) {
			case "home":
			case "root":
					await this.navigateHomeAsync(url, params);
				break;
			case "back":
				await this.navigateBackAsync(url, params);
				break;
			default:
				await this.navigateForwardAsync(url, params);
				break;
		}
	}

	private async loadGeoMetaAsync() {
		this.appConfig.geoMeta.country = await AppStorage.getAsync("GeoMeta-Country") || "VN";
		this.appConfig.geoMeta.countries = await AppStorage.getAsync("GeoMeta-Countries") || [];
		this.appConfig.geoMeta.provinces = await AppStorage.getAsync("GeoMeta-Provinces") || {};

		if (this.appConfig.geoMeta.provinces[this.appConfig.geoMeta.country] !== undefined) {
			AppEvents.broadcast("App", { Type: "GeoMetaUpdated", Data: this.appConfig.geoMeta });
		}

		await this.readAsync(
			`statics/geo/provinces/${this.appConfig.geoMeta.country}.json`,
			async provinces => await this.saveGeoMetaAsync(provinces, async () => {
				if (this.appConfig.geoMeta.countries.length < 1) {
					await this.readAsync(
						"statics/geo/countries.json",
						async countries => await this.saveGeoMetaAsync(countries),
						error => this.showError("Error occurred while fetching the meta countries", error)
					);
				}
			}),
			error => this.showError("Error occurred while fetching the meta provinces", error)
		);
	}

	private async saveGeoMetaAsync(data: any, onNext?: (data?: any) => void) {
		if (AppUtility.isObject(data, true) && AppUtility.isNotEmpty(data.code) && AppUtility.isArray(data.provinces, true)) {
			this.appConfig.geoMeta.provinces[data.code] = data;
		}
		else if (AppUtility.isObject(data, true) && AppUtility.isArray(data.countries, true)) {
			this.appConfig.geoMeta.countries = data.countries;
		}
		await Promise.all([
			AppStorage.setAsync("GeoMeta-Country", this.appConfig.geoMeta.country),
			AppStorage.setAsync("GeoMeta-Countries", this.appConfig.geoMeta.countries),
			AppStorage.setAsync("GeoMeta-Provinces", this.appConfig.geoMeta.provinces)
		]).then(() => {
			AppEvents.broadcast("App", { Type: "GeoMetaUpdated", Data: this.appConfig.geoMeta });
			if (onNext !== undefined) {
				onNext(data);
			}
		});
	}

	private async reloadGeoMetaAsync() {
		this.appConfig.geoMeta.countries = [];
		this.appConfig.geoMeta.provinces = {};
		await AppStorage.removeAsync("GeoMeta-Countries");
		await AppStorage.removeAsync("GeoMeta-Provinces");
		await this.loadGeoMetaAsync();
	}

	/** Loads the URI settings of the app */
	public async loadURIsAsync(onNext?: (data?: any) => void) {
		const uris = await AppStorage.getAsync("URIs") || {};
		if (uris.apis !== undefined && uris.updates !== undefined && uris.files !== undefined) {
			this.appConfig.URIs = uris;
			await this.storeURIsAsync(onNext);
		}
		else if (onNext !== undefined) {
			onNext(uris);
		}
	}

	/** Stores the URI settings of the app */
	public async storeURIsAsync(onNext?: (data?: any) => void) {
		await AppStorage.setAsync("URIs", this.appConfig.URIs).then(() => {
			AppEvents.broadcast("App", { Type: "URIsUpdated" });
			if (this.isDebug) {
				this.showLog("URIs are updated", this.appConfig.URIs);
			}
			if (onNext !== undefined) {
				onNext(this.appConfig.URIs);
			}
		});
	}

	/** Loads the options of the app */
	public async loadOptionsAsync(onNext?: (data?: any) => void) {
		const options = await AppStorage.getAsync("Options") || {};
		if (options.i18n !== undefined && options.timezone !== undefined && options.extras !== undefined) {
			this.appConfig.options = options;
			this.appConfig.options.theme = this.appConfig.options.theme || "light";
			await this.saveOptionsAsync(onNext);
		}
		else if (onNext !== undefined) {
			onNext(options);
		}
	}

	/** Updates the options of the app */
	public async updateOptionsAsync(options: any, onNext?: (data?: any) => void) {
		AppUtility.toKeyValuePair(options).forEach(kvp => this.appConfig.options[kvp.key] = kvp.value);
		await this.saveOptionsAsync(onNext);
	}

	/** Stores the options of the app */
	public async storeOptionsAsync(onNext?: (data?: any) => void) {
		await this.saveOptionsAsync(() => {
			AppEvents.broadcast("App", { Type: "OptionsUpdated" });
			if (onNext !== undefined) {
				onNext(this.appConfig.options);
			}
		});
	}

	/** Saves the options of the app into storage */
	public async saveOptionsAsync(onNext?: (data?: any) => void) {
		await AppStorage.setAsync("Options", this.appConfig.options).then(() => {
			if (onNext !== undefined) {
				onNext(this.appConfig.options);
			}
		});
	}

	/** Prepares the UI languages */
	public async prepareLanguagesAsync() {
		this.translateSvc.addLangs(this.languages.map(language => language.Value));
		this.translateSvc.setDefaultLang(this.appConfig.language);
		await this.setResourceLanguageAsync(this.appConfig.language);
	}

	/** Changes the language & locale of resources to use in the app */
	public async changeLanguageAsync(language: string, saveOptions: boolean = true) {
		this.appConfig.options.i18n = language;
		await Promise.all([
			saveOptions ? this.saveOptionsAsync() : new Promise<void>(() => {}),
			this.setResourceLanguageAsync(language)
		]).then(() => AppEvents.broadcast("App", { Type: "LanguageChanged" }));
	}

	/** Sets the language & locale of resources to use in the app */
	public async setResourceLanguageAsync(language: string) {
		await AppUtility.toAsync(this.translateSvc.use(language));
	}

	/** Gets the resource (of the current language) by a key */
	public async getResourceAsync(key: string, interpolateParams?: object) {
		return await AppUtility.toAsync<string>(this.translateSvc.get(key, interpolateParams));
	}

	/** Gets the resources (of the current language) by a key */
	public async getResourcesAsync(key: string) {
		return await AppUtility.toAsync<{ [key: string]: string }>(this.translateSvc.get(key));
	}

	/** Definitions (forms, views, resources, ...) */
	public addDefinition(path: string, definition: any) {
		this._definitions[AppCrypto.md5(path.toLowerCase())] = definition;
	}

	public getDefinition(path: string) {
		return this._definitions[AppCrypto.md5(path.toLowerCase())];
	}

	public async fetchDefinitionAsync(path: string, doClone: boolean = true) {
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

	public getDefinitionPath(serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
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
		return path + this.appConfig.getRelatedQuery(serviceName, undefined, json => {
			if (AppUtility.isNotEmpty(serviceName) && AppUtility.isEquals(serviceName, json["related-service"])) {
				delete json["related-service"];
				delete json["active-id"];
			}
		});
	}

	public setDefinition(definition: any, serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		this.addDefinition(this.getDefinitionPath(serviceName, objectName, definitionName, query), definition);
	}

	public async getDefinitionAsync(serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		return await this.fetchDefinitionAsync(this.getDefinitionPath(serviceName, objectName, definitionName, query));
	}

	public removeDefinition(serviceName?: string, objectName?: string, definitionName?: string, query?: { [key: string]: string }) {
		const path = this.getDefinitionPath(serviceName, objectName, definitionName, query);
		delete this._definitions[AppCrypto.md5(path.toLowerCase())];
	}

	public async getInstructionsAsync(service: string, language?: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.fetchAsync(`statics/instructions/${service.toLowerCase()}/${language || this.appConfig.language}.json`, onSuccess, onError);
	}

	/** Gets top items for displaying at sidebar */
	public async getSidebarTopItemsAsync() {
		return {
			home: {
				title: await this.getResourceAsync("common.sidebar.home"),
				link: this.appConfig.URLs.home,
				params: undefined as { [key: string]: string },
				direction: "root",
				icon: "home",
				thumbnail: undefined as string,
				onClick: () => {}
			},
			login: {
				title: await this.getResourceAsync("common.sidebar.login"),
				link: this.appConfig.URLs.users.login,
				params: undefined as { [key: string]: string },
				direction: "forward",
				icon: "log-in",
				thumbnail: undefined as string,
				onClick: () => {}
			},
			register: {
				title: await this.getResourceAsync("common.sidebar.register"),
				link: this.appConfig.URLs.users.register,
				params: undefined as { [key: string]: string },
				direction: "forward",
				icon: "person-add",
				thumbnail: undefined as string,
				onClick: () => {}
			},
			profile: {
				title: await this.getResourceAsync("common.sidebar.profile"),
				link: `${this.appConfig.URLs.users.profile}/my`,
				params: undefined as { [key: string]: string },
				direction: "forward",
				icon: "person",
				thumbnail: undefined as string,
				onClick: () => {}
			},
			search: {
				title: await this.getResourceAsync("common.sidebar.search"),
				link: undefined,
				params: undefined as { [key: string]: string },
				direction: "forward",
				icon: "search",
				thumbnail: undefined as string,
				onClick: async () => await this.navigateForwardAsync(this.appConfig.URLs.search)
			}
		};
	}

	/** Gets service logs */
	public async getServiceLogsAsync(request: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = true) {
		await this.searchAsync(this.getSearchingPath(undefined, undefined, "logs"), request, onSuccess, onError, true, useXHR);
	}

}

export interface ServiceLog {
	ID: string;
	Time: Date;
	CorrelationID: string;
	DeveloperID?: string;
	AppID?: string;
	ServiceName: string;
	ObjectName: string;
	Logs: string;
	Stack: string;
}
