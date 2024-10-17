import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { Account } from "@app/models/account";
import vi_VN from "@angular/common/locales/vi";
import en_US from "@angular/common/locales/en";

/** Configuration of the app */
export class AppConfig {

	/** App URIs (remote APIs and related resources) */
	static URIs = {
		/** APIs */
		apis: "https://apis.vieapps.net/",
		ws: "https://apis.vieapps.com/",

		/** Files HTTP service */
		files: "https://fs.vieapps.net/",

		/** Portals HTTP service */
		portals: "https://portals.vieapps.net/",

		/** Apps on the web to perform activation or other business process */
		apps: "https://cms.vieapps.net/",

		/** Collection of all allowed embed medias (hosts/domains) */
		medias: ["fs.vieportal.net"]
	};

	/** App information */
	static app = {
		name: "NGX Portals",
		description: "Manage information and related services of CMS Portals",
		copyright: "© VIEApps.net",
		license: "Apache-2.0",
		homepage: "https://cms.vieapps.net",
		id: "vieapps-ngx",
		version: "9.2411.1",
		frameworks: "ionic 5 - angular 11 - cordova 11",
		mode: "",
		platform: "",
		os: "",
		shell: "",
		persistence: true,
		debug: false,
		offline: false
	};

	/** App session */
	static session = {
		id: undefined as string,
		token: undefined as { [key: string]: any },
		account: undefined as Account,
		keys: {
			aes: {
				key: undefined as string,
				iv: undefined as string
			},
			rsa: {
				encryptionExponent: undefined as string,
				decryptionExponent: undefined as string,
				exponent: undefined as string,
				modulus: undefined as string
			},
			jwt: undefined as string
		},
		device: "",
		captcha: {
			code: "",
			uri: ""
		}
	};

	/** App services */
	static services = {
		all: [
			{
				name: "Portals",
				objects: ["Organization", "Module", "ContentType", "Expression", "Role", "Site", "Desktop", "Portlet", "SchedulingTask", "Category", "Content", "Item", "Link", "Form", "Crawler"],
				specials: [],
				sidebar: "cms",
				availableHosts: [/**"cms.vieapps.net"/**/]
			},
			{
				name: "Books",
				objects: ["Book", "Category", "Statistic"],
				menuIndex: 3,
				canSetPrivilegs: true,
				appName: "NGX Books",
				appDescription: "Free online books & EPUB/MOBI e-books"
			}
		] as Array<{ name: string; objects: Array<string>; specials?: Array<string>; menuIndex?: number; sidebar?: string; availableHosts?: Array<string>; canSetPrivilegs?: boolean; appName?: string; appDescription?: string; }>,
		active: {
			service: undefined as string,
			system: undefined as string
		}
	};

	/** App accounts */
	static accounts = {
		registrable: true,
		registration: {
			required: [],
			hidden: ["Gender", "BirthDay", "Address", "Addresses", "Mobile"],
			excluded: ["Language", "DarkTheme"]
		},
		sendInvitationRole: "Authenticated",
		setServicePrivilegs: false,
		setServicePrivilegsRole: "ServiceAdministrator",
		setObjectPrivilegs: true,
		phoneIsAllowed: false
	};

	/** Geographic meta */
	static geoMeta = {
		country: "VN",
		countries: new Array<{ name: string, code: string, code3: string, telcode: string }>(),
		provinces: {} as {
			[key: string]: {
				name: string,
				title: string,
				code: string,
				telcode: string,
				provinces: Array<{
					name: string,
					title: string,
					code: string,
					counties: Array<{
						name: string,
						type: string,
						code: string,
						title: string
					}>
				}>
			}
		}
	};

	/** App options */
	static options = {
		i18n: "vi-VN",
		theme: "light",
		timezone: +7.00,
		extras: {} as { [key: string]: any }
	};

	/** App URLs (stack, host, ...) */
	static URLs = {
		stack: [] as Array<{ url: string, params: { [key: string]: any } }>,
		home: "/home",
		search: "/search",
		base: undefined as string,
		host: undefined as string,
		routerParams: undefined as { [key: string]: any },
		redirectToWhenReady: undefined as string,
		users: {
			root: "/users",
			login: "/users/login",
			register: "/users/register",
			profile: "/users/profile",
			update: "/users/update",
			otp: "/users/otp",
			list: "/users/list",
			search: "/users/search"
		},
		tabs: {
			previous: undefined as string,
			current: undefined as string
		}
	};

	/** URLs for downloading desktop apps */
	static get downloadURLs() {
		const baseURL = `${this.URIs.apps}releases/${this.app.name.replace(/\s/g, "%20")}`;
		return {
			Windows: `${baseURL}%20Setup%20${this.app.version}.exe`,
			Linux: `${baseURL}-${this.app.version}.AppImage`,
			macOS: `${baseURL}-${this.app.version}.dmg`
		};
	}

	/** Tracking information */
	static tracking = {
		google: [] as Array<string>,
		facebook: [] as Array<string>,
		domains: [] as Array<string>,
	};

	/** Facebook integration */
	static facebook = {
		id: undefined as string,
		token: undefined as string,
		url: undefined as string,
		version: "v21.0",
	};

	/** Refer informaion */
	static refer = {
		id: undefined as string,
		section: undefined as string
	};

	/** Extra configuration */
	static extras: { [key: string]: any } = {};

	/** Gets the state that determines the app is ready to go */
	static get isReady() {
		return AppUtility.isObject(this.session.keys, true) && AppUtility.isObject(this.session.token, true);
	}

	/** Gets the state that determines the current account is authenticated or not */
	static get isAuthenticated() {
		return this.isReady && AppUtility.isNotEmpty(this.session.token.uid);
	}

	/** Gets the state that determines is native app */
	static get isNativeApp() {
		return this.app.mode === "NTA";
	}

	/** Gets the state that determines is web progressive app */
	static get isWebApp() {
		return !this.isNativeApp && this.app.shell !== "Electron";
	}

	/** Gets the state that determines the app is running on iOS (native or web browser) */
	static get isRunningOnIOS() {
		return this.app.platform.startsWith("iOS");
	}

	/** Gets the state that determines the app is running in debug mode */
	static get isDebug() {
		return this.app.debug;
	}

	/** Gets the state that determines the app is running in offline mode */
	static get isOffline() {
		return this.app.offline;
	}

	/** Gets the token of the app (JSON Web Token that encoded by base64url) */
	static get jwt() {
		return AppUtility.isObject(this.session.token, true) && AppUtility.isObject(this.session.keys, true) && AppUtility.isNotEmpty(this.session.keys.jwt)
			? AppCrypto.jwtEncode(this.session.token, this.session.keys.jwt)
			: undefined;
	}

	/** Gets the language for working with the app */
	static get language() {
		const profile = this.session.account !== undefined ? this.session.account.profile : undefined;
		return profile !== undefined
			? profile.Language || this.options.i18n
			: this.options.i18n;
	}

	/** Gets the available languages for working with the app */
	static get languages() {
		return [
			{
				Value: "en-US",
				Label: "English"
			},
			{
				Value: "vi-VN",
				Label: "Tiếng Việt"
			}
		];
	}

	/** Gets the locale code for working with i18n globalization */
	static get locale() {
		return this.language.replace("-", "_");
	}

	/** Gets the available locales for working with the app */
	static get locales() {
		return this.languages.map(language => language.Value.replace("-", "_"));
	}

	/** Gets the locale data for working with i18n globalization */
	static getLocaleData(locale: string) {
		switch (locale || this.locale) {
			case "vi_VN":
				return vi_VN;
			default:
				return en_US;
		}
	}

	/** Gets the related JSON with active/related service, culture language and host */
	static getRelatedJson(additional?: { [key: string]: string }, service?: string, activeID?: string, onCompleted?: (json: { [key: string]: string }) => void) {
		const json: { [key: string]: string } = {
			"language": this.language,
			"related-service": (AppUtility.isNotEmpty(service) ? service : this.services.active.service || "").trim().toLowerCase(),
			"active-id": (AppUtility.isNotEmpty(activeID) ? activeID : this.services.active.system || "").trim().toLowerCase()
		};
		AppUtility.toKeyValuePair(additional, kvp => AppUtility.isNotNull(kvp.value)).forEach(kvp => json[kvp.key.toString()] = kvp.value.toString());
		if (onCompleted !== undefined) {
			onCompleted(json);
		}
		return json;
	}

	/** Gets the related query with active/related service, culture language and host */
	static getRelatedQuery(service?: string, activeID?: string, onCompleted?: (json: any) => void) {
		return AppUtility.toQuery(this.getRelatedJson(undefined, service, activeID, onCompleted));
	}

	/** Gets the authenticated information for making requests to APIs */
	static getAuthenticatedInfo(addToken: boolean = true, addAppInfo: boolean = true, addDeviceID: boolean = true) {
		const info: { [key: string]: string } = {};
		if (addToken && AppUtility.isObject(this.session.token, true) && AppUtility.isObject(this.session.keys, true) && AppUtility.isNotEmpty(this.session.keys.jwt)) {
			info["x-app-token"] = this.jwt;
		}
		if (addAppInfo) {
			info["x-app-name"] = this.app.name;
			info["x-app-platform"] = this.app.platform;
		}
		if (addDeviceID && AppUtility.isNotEmpty(this.session.device)) {
			info["x-device-id"] = this.session.device;
		}
		return info;
	}

	/** Gets the captcha information for making requests to APIs */
	static getCaptchaInfo(captcha: string) {
		return {
			"x-captcha": "true",
			"x-captcha-registered": AppCrypto.aesEncrypt(this.session.captcha.code),
			"x-captcha-input": AppCrypto.aesEncrypt(captcha)
		} as { [key: string]: string };
	}

}
