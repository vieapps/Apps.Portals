import "@angular/compiler";
import assert from "node:assert/strict";
import test, { beforeEach, after } from "node:test";
import { readFileSync } from "node:fs";
import { createCipheriv, createHmac, generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { createEnvironmentInjector, Injector } from "@angular/core";
import { HttpClient, HttpResponse, HttpErrorResponse } from "@angular/common/http";
import { TranslateLoader, TranslateService } from "@ngx-translate/core";
import { Observable, of, Subject, throwError } from "rxjs";
import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";
import { AppCrypto } from "@app/components/app.crypto";
import { AppStorage } from "@app/components/app.storage";
import { AppEvents } from "@app/components/app.events";
import { AppAPIs } from "@app/components/app.apis";
import { APP_ELECTRON_SERVICE, createElectronService, PlatformUtility } from "@app/components/app.utility.platform";
import { provideAppTranslations, translationResources } from "@app/components/app.i18n";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { Account } from "@app/models/account";
import { AppComponent } from "@app/app.component";
import { UsersService } from "@app/services/users.service";
import { AppFormsService } from "@app/components/forms.service";
import { UsersLogInPage } from "@app/pages/users/login/login.page";
import { UserProfile, UserToken } from "@app/models/user";

Object.defineProperty(globalThis, "location", { configurable: true, value: { href: "http://127.0.0.1:4311/home" } });
const aesKey = Buffer.from("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", "hex");
const aesIV = Buffer.from("101112131415161718191a1b1c1d1e1f", "hex");
const signingKey = "non-secret-session-fixture-key";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = privateKey.export({ format: "jwk" });
const hex = value => Buffer.from(value, "base64url").toString("hex");
const jwt = (uid = "") => {
	const head = Buffer.from(JSON.stringify({ typ: "JWT", alg: "HS256" })).toString("base64url");
	const body = Buffer.from(JSON.stringify({ uid, iat: 1700000000 })).toString("base64url");
	return head + "." + body + "." + createHmac("sha256", signingKey).update(head + "." + body).digest("base64url");
};
const envelope = (uid = "") => {
	const cipher = createCipheriv("aes-256-cbc", aesKey, aesIV);
	return {
		ID: "fixture-session", DeviceID: "fixture-device",
		Keys: {
			JWT: Buffer.concat([cipher.update(signingKey, "utf8"), cipher.final()]).toString("base64"),
			AES: { Key: aesKey.toString("hex"), IV: aesIV.toString("hex") },
			RSA: { EncryptionExponent: hex(jwk.e), DecryptionExponent: hex(jwk.d), Modulus: hex(jwk.n) }
		},
		Token: jwt(uid)
	};
};
const decrypt = value => {
	const bytes = Buffer.from(value, "base64");
	const block = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.concat([Buffer.alloc(256 - bytes.length), bytes]));
	assert.equal(block[1], 2);
	return block.subarray(block.indexOf(0, 2) + 1).toString("utf8");
};
const values = new Map();
let failWrites = false;
const storage = {
	driver: "fixture-memory",
	create: async () => storage,
	get: async key => structuredClone(values.get(key)),
	set: async (key, value) => {
		if (failWrites) throw new Error("fixture storage failure");
		values.set(key, structuredClone(value));
	},
	remove: async key => { values.delete(key); }
};
const requests = [];
let apiResponse = request => ({});
let failedResource;
const http = new HttpClient({ handle: request => {
	requests.push(request);
	if (request.url.startsWith("./assets/i18n/")) {
		if (request.url === failedResource) return throwError(() => new HttpErrorResponse({ status: 404 }));
		const path = request.url.slice(2);
		assert.match(path, /^assets\/i18n\/(common|users|portals|portals\.cms|books)\/(vi-VN|en-US)\.json$/);
		return of(new HttpResponse({ body: JSON.parse(readFileSync("src/" + path, "utf8")) }));
	}
	assert.equal(new URL(request.url).origin, "https://fixture.invalid");
	const body = apiResponse(request);
	if (body instanceof Observable) return body;
	return body instanceof HttpErrorResponse ? throwError(() => body) : of(new HttpResponse({ body }));
} } as any);
const makeTranslations = () => createEnvironmentInjector([
	...provideAppTranslations(), { provide: HttpClient, useValue: http }
], Injector.NULL as any);
const injector = makeTranslations();
const translate = injector.get(TranslateService);
const config = new ConfigurationService(
	{ getBaseHrefFromDOM: () => "/" } as any,
	{ width: () => 1024, height: () => 768 } as any,
	{ navigateRoot: async () => {}, navigateForward: async () => {}, navigateBack: async () => {} } as any,
	storage as any, { setTitle: () => {} } as any, translate, http, null
);
const auth = new AuthenticationService(config);
const defaultServices = structuredClone(AppConfig.services.all);
beforeEach(async () => {
	values.clear(); requests.length = 0; failWrites = false; failedResource = undefined;
	AppConfig.app.mode = ""; AppConfig.app.shell = "Browser"; AppConfig.app.debug = false;
	AppConfig.app.persistence = true; AppConfig.app.query.preferXHR = true;
	AppConfig.options = AppConfig.defaultOptions;
	AppConfig.URIs.apis = "https://fixture.invalid/"; AppConfig.URIs.ws = "https://fixture.invalid/";
	AppConfig.session = {
		status: "initializing", id: undefined, token: undefined, account: undefined,
		device: "fixture-device",
		keys: { aes: { key: undefined, iv: undefined }, rsa: { encryptionExponent: undefined, decryptionExponent: undefined, exponent: undefined, modulus: undefined }, jwt: undefined },
		captcha: { code: "", uri: "" }
	};
	AppConfig.services.all = structuredClone(defaultServices);
	for (const event of ["App", "Session", "Account", "Profile", "Token", "Fixture"]) AppEvents.off(event, "fixtures");
	AppEvents.initialize();
	apiResponse = request => {
		const url = new URL(request.url);
		if (url.pathname === "/users/session") return request.method === "GET" && url.searchParams.has("register") ? {} : envelope();
		if (url.pathname === "/users/account") return { ID: "fixture-user", Roles: ["All"], IP: "fixture", Location: "fixture" };
		if (url.pathname === "/users/profile") return { ID: "fixture-user", Name: "Fixture" };
		throw new Error("Unexpected fixture API request: " + request.url);
	};
	await AppStorage.initializeAsync(storage as any);
});
after(() => injector.destroy());
const complete = (invoke: (resolve: (value?: any) => void, reject: (error?: any) => void) => void) =>
	new Promise<any>((resolve, reject) => invoke(resolve, reject));
const initialize = () => complete((resolve, reject) => { config.initializeSessionAsync(resolve, reject); });
const mergeReference = (target, source) => {
	const output = structuredClone(target);
	for (const [key, value] of Object.entries(source)) {
		assert.equal(Array.isArray(value), false);
		output[key] = value && typeof value === "object" ? mergeReference(output[key] ?? {}, value) : value;
	}
	return output;
};

test("official multi-resource loader preserves both complete language dictionaries", async () => {
	for (const language of ["vi-VN", "en-US"]) {
		let expected = {};
		for (const resource of translationResources) {
			const json = JSON.parse(readFileSync("src/" + resource.prefix.slice(2) + language + resource.suffix, "utf8"));
			expected = mergeReference(expected, json);
		}
		const result = await AppUtility.toAsync(injector.get(TranslateLoader).getTranslation(language));
		assert.deepEqual(result, expected);
	}
});

test("a missing translation resource keeps the remaining dictionaries", async context => {
	context.mock.method(console, "error", () => {});
	failedResource = "./assets/i18n/books/en-US.json";
	const result = await AppUtility.toAsync(injector.get(TranslateLoader).getTranslation("en-US"));
	assert.ok(result.common);
	assert.ok(result.users);
	assert.ok(result.portals);
	assert.equal(result.books, undefined);
});

test("language changes use real TranslateService and preserve App event then persistence scheduling", async () => {
	await config.prepareLanguagesAsync();
	assert.equal(translate.getCurrentLang(), "vi-VN");
	const events = [];
	AppEvents.on("App", info => events.push(info.args), "fixtures");
	await config.changeLanguageAsync("en-US", false);
	assert.equal(translate.getCurrentLang(), "en-US");
	assert.equal(AppConfig.options.i18n, "en-US");
	assert.deepEqual(events.at(-1), { Type: "Language", Mode: "Changed", Language: "en-US" });
	assert.equal(await AppStorage.getAsync("Options"), undefined);
	assert.equal(await config.getResourceAsync("common.sidebar.home"), "Home");
});

test("AppEvents dispatch stays synchronous, isolates handlers and removes matching identities", context => {
	context.mock.method(console, "error", () => {});
	const seen = [];
	AppEvents.on("Fixture", () => { throw new Error("fixture handler"); }, "fixtures");
	AppEvents.on("Fixture", info => seen.push(info.args.value), "fixtures");
	AppEvents.broadcast("Fixture", { value: 1 });
	assert.deepEqual(seen, [1]);
	AppEvents.off("Fixture", "fixtures");
	AppEvents.broadcast("Fixture", { value: 2 });
	assert.deepEqual(seen, [1]);
});

test("stored options merge defaults and URIs require both API and file endpoints", async () => {
	values.set("Options", { i18n: "en-US", extras: { marker: true } });
	await config.loadOptionsAsync();
	assert.equal(AppConfig.options.i18n, "en-US");
	assert.equal(AppConfig.options.fileLimits.avatar, AppConfig.defaultOptions.fileLimits.avatar);
	assert.equal(values.get("Options").fileLimits, undefined);
	assert.equal(values.get("Options").extras.marker, true);
	const original = AppConfig.URIs.apis;
	await config.loadURIsAsync(AppCrypto.jsonEncode({ apis: "https://ignored.invalid/" }));
	assert.equal(AppConfig.URIs.apis, original);
	await config.loadURIsAsync(AppCrypto.jsonEncode({ apis: "https://fixture.invalid/", files: "https://fixture-files.invalid/" }));
	assert.equal(AppConfig.URIs.ws, AppConfig.URIs.apis);
	assert.equal(values.get("URIs").files, "https://fixture-files.invalid/");
});

test("stored session restores Account and keeps Session/Account events before continuation", async () => {
	const seen = [];
	for (const event of ["Session", "Account"]) AppEvents.on(event, info => seen.push(event + ":" + info.args.Type), "fixtures");
	values.set("Session", { ...AppConfig.session, id: "stored-session", account: { id: "stored-account", roles: ["All"] } });
	await config.loadSessionAsync(() => seen.push("callback"));
	assert.equal(AppConfig.session.account instanceof Account, true);
	assert.equal(Account.get("stored-account"), AppConfig.session.account);
	assert.deepEqual(seen, ["Session:Loaded", "Account:Loaded", "callback"]);
	assert.equal(requests.length, 0);
});

test("anonymous initialization and registration preserve response mapping, events and persisted shape", async () => {
	const seen = [];
	AppEvents.on("Session", info => seen.push(info.args.Type), "fixtures");
	await initialize();
	assert.equal(config.isReady, true);
	assert.equal(config.isAuthenticated, false);
	assert.equal(AppConfig.session.id, "fixture-session");
	assert.ok(seen.includes("Initialized"));
	await complete((resolve, reject) => { config.registerSessionAsync(() => { seen.push("callback"); resolve(); }, reject); });
	assert.equal(AppConfig.session.account instanceof Account, true);
	assert.ok(requests.some(request => new URL(request.url).searchParams.get("register") === "fixture-session"));
	assert.deepEqual(seen.slice(-3), ["Registered", "callback", "Updated"]);
	assert.equal(values.get("Session").status, undefined);
	assert.equal(values.get("Session").captcha, undefined);
});

test("authenticated initialization fetches account/profile and forwards their messages", async () => {
	const messages = [];
	AppAPIs.registerAsServiceScopeProcessor("Users", message => messages.push(message), "session-fixtures");
	apiResponse = request => new URL(request.url).pathname === "/users/session" ? envelope("fixture-user") : { ID: "fixture-user", Roles: ["All"] };
	try {
		await initialize();
		assert.equal(config.isAuthenticated, true);
		assert.equal(AppConfig.session.account.id, "fixture-user");
		assert.deepEqual(messages.map(message => message.Type.Object).sort(), ["Account", "Profile"]);
		assert.ok(messages.every(message => message.Type.Event === "Update"));
	} finally {
		AppAPIs.unregisterProcessor("session-fixtures", "Users");
	}
});

test("invalid token signature does not become authenticated and still follows the existing callback", async () => {
	const response = envelope();
	response.Token = jwt("fixture-user").slice(0, -3) + "bad";
	await complete(resolve => { config.updateSessionAsync(response, resolve, false, false); });
	assert.equal(config.isReady, false);
	assert.equal(config.isAuthenticated, false);
	assert.equal(AppConfig.session.status, "ready");
});

test("storage write failure still runs the session continuation and Updated event", async context => {
	context.mock.method(console, "error", () => {});
	failWrites = true;
	const seen = [];
	AppEvents.on("Session", info => seen.push(info.args.Type), "fixtures");
	await config.storeSessionAsync(() => seen.push("callback"));
	assert.deepEqual(seen, ["callback", "Updated"]);
});

test("password login encrypts credentials and Require2FA does not commit an authenticated session", async () => {
	await initialize();
	const seen = [];
	AppEvents.on("Session", info => seen.push(info.args.Type), "fixtures");
	apiResponse = () => ({ Require2FA: true, ID: "fixture-challenge", Info: "fixture-info" });
	const result = await complete((resolve, reject) => { auth.logInAsync("fixture@example.invalid", "fixture-password", resolve, reject); });
	const sent = requests.at(-1);
	assert.equal(sent.method, "POST");
	assert.equal(decrypt(sent.body.Account), "fixture@example.invalid");
	assert.equal(decrypt(sent.body.Password), "fixture-password");
	assert.equal(result.Require2FA, true);
	assert.equal(config.isAuthenticated, false);
	assert.equal(seen.includes("LogIn"), false);
});

test("OTP login updates the session and logout resets options while keeping extras", async () => {
	await initialize();
	const base = apiResponse;
	apiResponse = request => request.method === "PUT" ? envelope("fixture-user") : base(request);
	await complete((resolve, reject) => { auth.logInOTPAsync("fixture-id", "fixture-info", "123456", resolve, reject); });
	const otpRequest = requests.find(request => request.method === "PUT");
	assert.equal(decrypt(otpRequest.body.ID), "fixture-id");
	assert.equal(decrypt(otpRequest.body.Info), "fixture-info");
	assert.equal(decrypt(otpRequest.body.OTP), "123456");
	assert.equal(config.isAuthenticated, true);
	AppConfig.options.extras = { keep: true };
	AppConfig.options.showStatistics = true;
	const registered = complete(resolve => AppEvents.on("Session", info => {
		if (info.args.Type === "Registered") resolve();
	}, "fixtures"));
	await complete((resolve, reject) => { auth.logOutAsync(resolve, reject); });
	await registered;
	assert.equal(config.isAuthenticated, false);
	assert.equal(AppConfig.options.showStatistics, false);
	assert.deepEqual(AppConfig.options.extras, { keep: true });
});

test("security recovery reinitializes and registers; Unauthorized errors do not trigger recovery", async () => {
	const error = { Type: "SessionExpiredException", Message: "fixture expired" };
	const captured = await complete(resolve => (auth as any).processError("fixture", error, resolve));
	assert.equal(captured, error);
	assert.ok(requests.some(request => new URL(request.url).searchParams.has("register")));
	requests.length = 0;
	const denied = { Type: "UnauthorizedException", Message: "fixture denied" };
	const result = await complete(resolve => (auth as any).processError("fixture", denied, resolve));
	assert.equal(result, denied);
	assert.equal(requests.length, 0);
});

test("browser platform preparation keeps a restored device identity", async () => {
	AppConfig.session.device = "stored-device-id";
	await config.prepareAsync();
	assert.equal(AppConfig.app.mode, "PWA");
	assert.equal(AppConfig.app.shell, "Browser");
	assert.equal(AppConfig.session.device, "stored-device-id");
	assert.equal(AppConfig.URLs.base, "/");
});

test("app startup prepares services and continues into session initialization after loading", { timeout: 5000 }, async context => {
	const order = [];
	const started = Promise.withResolvers<void>();
	AppConfig.services.all = [
		{ name: "Portals", objects: [], sidebar: "cms" },
		{ name: "Books", objects: [], availableHosts: ["books.example.invalid"] }
	];
	const previousActiveService = AppConfig.services.active.service;
	AppConfig.services.active.service = "Portals";
	values.set("Session", { device: "stored-local-device" });
	const configuration = {
		appConfig: AppConfig,
		loadURIsAsync: async () => { order.push("uris"); },
		loadOptionsAsync: async () => { order.push("options"); },
		prepareLanguagesAsync: async () => { order.push("language"); },
		prepareAsync: async () => {
			await Promise.resolve();
			assert.equal(AppConfig.session.device, "stored-local-device");
			order.push("prepare");
		},
		initialize: () => { order.push("configuration"); },
		isWebApp: true,
		getResourceAsync: async key => key
	};
	const service = name => ({ name, initialize: () => order.push(name), deinitialize: () => {} });
	const component = new AppComponent(
		{ ready: async () => { order.push("platform"); } } as any,
		{ showLoadingAsync: async () => { order.push("loading"); }, hideLoadingAsync: async () => { started.reject(new Error("App startup failed")); } } as any,
		configuration as any, service("Authentication") as any, service("Users") as any, service("Files") as any,
		service("Notifications") as any, service("Portals") as any, service("Portals") as any, service("Books") as any,
		{ events: new Subject() } as any
	);
	const app = component as any;
	app.prepareSidebar = () => order.push("sidebar");
	app.prepareEventProcessors = () => order.push("events");
	app.updateSidebarAsync = async () => { order.push("menu"); };
	app.initialize = () => {
		order.push("session");
		started.resolve();
	};
	context.mock.method(PlatformUtility, "preparePWAEnvironment", () => {});
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
	try {
		component.ngOnInit();
		await started.promise;
		assert.deepEqual(order, ["platform", "uris", "options", "language", "prepare", "sidebar", "events", "configuration", "Authentication", "Users", "Files", "Notifications", "Portals", "Portals", "menu", "loading", "session"]);
		assert.deepEqual(AppConfig.services.all.map(service => service.name), ["Portals"]);
		assert.equal(component.sidebar.State.Active, "cms");
		assert.ok((globalThis as any).window.__vieapps);
	}
	finally {
		AppConfig.services.active.service = previousActiveService;
		AppEvents.off("App", "AssignAppDebugInfo");
		if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
		else delete (globalThis as any).window;
	}
});

test("initializeAsync completion does not mean the session HTTP callback has completed", async context => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const pending = new Subject();
	apiResponse = () => pending;
	let completed = false;
	let initialization;
	const sessionComplete = complete((resolve, reject) => {
		initialization = config.initializeAsync(() => { completed = true; resolve(); }, reject);
	});
	await initialization;
	assert.equal(completed, false);
	assert.equal(requests.length, 1);
	pending.next(new HttpResponse({ body: envelope() }));
	pending.complete();
	await sessionComplete;
	assert.equal(completed, true);
});

test("normal password login commits the session before LogIn and its success callback", async () => {
	await initialize();
	const base = apiResponse;
	apiResponse = request => request.method === "POST" ? envelope("fixture-user") : base(request);
	const seen = [];
	AppEvents.on("Session", info => seen.push(info.args.Type), "fixtures");
	await complete((resolve, reject) => { auth.logInAsync("fixture@example.invalid", "fixture-password", data => {
		assert.equal(config.isAuthenticated, true);
		seen.push("callback");
		resolve(data);
	}, reject); });
	assert.deepEqual(seen.slice(-3), ["LogIn", "callback", "Updated"]);
});

test("optional Electron adapter retains the existing outbound IPC shape and clones args", () => {
	const sent = [];
	const adapter = {
		isElectronApp: true,
		ipcRenderer: { on: () => {}, send: (event, args) => sent.push({ event, args }) },
		shell: { openExternal: () => {} }
	};
	AppEvents.initializeElectronService(adapter);
	const args = { nested: { value: 1 } };
	AppEvents.sendToElectron("App", args);
	assert.deepEqual(sent, [{ event: "App", args }]);
	assert.notEqual(sent[0].args, args);
	assert.notEqual(sent[0].args.nested, args.nested);
});

test("Electron provider returns null on browser or when no preload bridge is usable", () => {
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	try {
		Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
		assert.equal(createElectronService(), null);
		Object.defineProperty(globalThis, "window", { configurable: true, value: { vieappsDesktop: {} } });
		assert.equal(createElectronService(), null);
	}
	finally {
		if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
		else delete (globalThis as any).window;
	}
});

test("preload without isElectronApp connects both IPC directions and normalizes Electron config", async () => {
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const previousEventsAdapter = (AppEvents as any)._electronService;
	const previousPlatformAdapter = (PlatformUtility as any)._electronService;
	const sent: any[] = [], opened: string[] = [];
	let listener: (event: any, message: any) => void;
	let subscriptionChannel: string;
	const unsubscribe = () => {};
	const desktop = {
		ipcRenderer: {
			send(channel, payload) { assert.equal(this, desktop.ipcRenderer); sent.push({ channel, payload }); },
			on(channel, callback) { assert.equal(this, desktop.ipcRenderer); subscriptionChannel = channel; listener = callback; return unsubscribe; }
		},
		shell: { openExternal(url) { assert.equal(this, desktop.shell); opened.push(url); return Promise.resolve(true); } }
	};
	let providerInjector;
	try {
		Object.defineProperty(globalThis, "window", { configurable: true, value: { vieappsDesktop: desktop } });
		providerInjector = createEnvironmentInjector([{ provide: APP_ELECTRON_SERVICE, useFactory: createElectronService }], Injector.NULL as any);
		const adapter = providerInjector.get(APP_ELECTRON_SERVICE);
		assert.equal(adapter.isElectronApp, true);
		assert.equal("isElectronApp" in desktop, false);
		(AppEvents as any)._electronService = undefined;
		const configuration = new ConfigurationService(
			{ getBaseHrefFromDOM: () => "/" } as any,
			{ width: () => 1024, height: () => 768 } as any,
			{} as any, storage as any, { setTitle: () => {} } as any, translate, http, adapter
		);
		AppConfig.session.device = "";
		await configuration.prepareAsync();
		assert.equal(configuration.isElectronApp, true);
		assert.equal(AppConfig.isElectronApp, true);
		assert.equal(AppConfig.isWebApp, false);
		assert.equal(AppConfig.app.shell, "Electron");
		assert.equal(AppConfig.app.mode, "Desktop");
		assert.equal(AppConfig.URLs.base, "");
		assert.match(AppConfig.session.device, /-electron$/);
		assert.equal(subscriptionChannel, "electron.ipc2app");
		const received = complete(resolve => {
			AppEvents.on("Navigate", info => resolve(info.args), "electron-bridge-fixture");
			listener({}, { event: "Navigate", args: { Type: "LogIn" } });
		});
		assert.deepEqual(await received, { Type: "LogIn" });
		const payload = { Type: "Initialized", Data: { app: { name: "Fixture" }, URIs: {} } };
		AppEvents.sendToElectron("App", payload);
		AppEvents.sendToElectron("Users", { Type: "LogOut" });
		assert.deepEqual(sent, [{ channel: "App", payload }, { channel: "Users", payload: { Type: "LogOut" } }]);
		assert.notEqual(sent[0].payload, payload);
		assert.equal(adapter.ipcRenderer.on("electron.ipc2app", listener), unsubscribe);
		assert.equal(await adapter.shell.openExternal("https://example.invalid/"), true);
		assert.deepEqual(opened, ["https://example.invalid/"]);
	}
	finally {
		AppEvents.off("Navigate", "electron-bridge-fixture");
		(AppEvents as any)._electronService = previousEventsAdapter;
		(PlatformUtility as any)._electronService = previousPlatformAdapter;
		providerInjector?.destroy();
		if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
		else delete (globalThis as any).window;
	}
});

test("platform clipboard adapter preserves its success callback", async () => {
	const copied = [];
	const oldMode = AppConfig.app.mode;
	try {
		AppConfig.app.mode = "NTA";
		PlatformUtility.setClipboard({ copy: async value => { copied.push(value); } });
		let callback = false;
		await PlatformUtility.copyToClipboardAsync("fixture text", () => { callback = true; });
		assert.deepEqual(copied, ["fixture text"]);
		assert.equal(callback, true);
	} finally {
		AppConfig.app.mode = oldMode;
	}
});

// Exercise real Users processors without retaining their unlabelled subscriptions between cases.
const withUsers = async (action: (users: UsersService) => Promise<void>) => {
	const api = AppAPIs as any, events = AppEvents as any;
	const handlers = { Users: api._serviceScopeHandlers.Users, Refresher: api._serviceScopeHandlers.Refresher, App: events._handlers.App };
	api._serviceScopeHandlers.Users = [...(handlers.Users || [])];
	api._serviceScopeHandlers.Refresher = [...(handlers.Refresher || [])];
	events._handlers.App = [...(handlers.App || [])];
	const originalResponse = apiResponse;
	apiResponse = request => {
		const body = originalResponse(request);
		return new URL(request.url).pathname === "/users/profile"
			? { ...body, Language: "vi-VN", Options: { ...AppConfig.options, extras: {} } }
			: body;
	};
	const users = new UsersService(config, auth, {} as any, {} as any, { transform: () => "fixture-date" } as any);
	users.initialize();
	try { await action(users); }
	finally {
		apiResponse = originalResponse;
		api._serviceScopeHandlers.Users = handlers.Users || [];
		api._serviceScopeHandlers.Refresher = handlers.Refresher || [];
		events._handlers.App = handlers.App || [];
	}
};
const pageFixture = (users: UsersService) => {
	const controller = { create: async () => ({ present: async () => {}, dismiss: async () => {} }) } as any;
	const forms = new AppFormsService(translate, config, controller, controller, controller, controller, controller);
	return { forms, page: new UsersLogInPage(config, forms, auth, users) };
};
const buildLogin = async (page: UsersLogInPage, forms: AppFormsService) => {
	await page.openLoginAsync();
	page.login.controls = forms.getControls(page.login.config);
	forms.buildForm(page.login.form, page.login.controls);
	page.login.form["_controls"] = page.login.controls;
	page.onLoginFormInitialized();
	page.login.controls.forEach(item => item.formControlRef = page.login.form.controls[item.Name]);
};

test("Users processor handles session statistics and token deletion through AppAPIs dispatch", async () => withUsers(async () => {
	await initialize();
	AppAPIs.broadcast({ Type: { Service: "Users", Object: "Session", Event: "Statistics" }, Data: { Visits: { Total: 321 } } });
	assert.equal(config.statistics.Visits.Total, 321);
	UserToken.update({ ID: "fixture-token" });
	AppAPIs.broadcast({ Type: { Service: "Users", Object: "Token", Event: "Delete" }, Data: { ID: "fixture-token" } });
	assert.equal(UserToken.contains("fixture-token"), false);
}));

test("Users processor completes security revoke via reset, initialize and anonymous register", async () => withUsers(async () => {
	await initialize(); requests.length = 0;
	await complete(resolve => {
		AppEvents.on("Profile", () => resolve(), "fixtures");
		AppAPIs.broadcast({ Type: { Service: "Users", Object: "Session", Event: "Revoke" }, Data: { Type: "InvalidTokenException", Message: "fixture" } });
	});
	assert.equal(AppConfig.isAuthenticated, false);
	const calls = requests.filter(request => new URL(request.url).pathname === "/users/session");
	assert.equal(calls.length, 2); assert.equal(new URL(calls[1].url).searchParams.has("register"), true);
}));

test("Login page commits real password session/profile then redirects to decoded next URL", async context => withUsers(async users => {
	await initialize();
	const fallback = apiResponse;
	apiResponse = request => request.method === "POST" && new URL(request.url).pathname === "/users/session" ? envelope("fixture-user") : fallback(request);
	const { forms, page } = pageFixture(users); await buildLogin(page, forms);
	page.login.form.patchValue({ Account: "fixture@example.test", Password: "fixture-password", Persistence: true });
	AppConfig.URLs.stack = [{ url: "/users/login", params: { next: AppCrypto.base64urlEncode("/home?fixture=next") } }];
	const destination = complete(resolve => { context.mock.method(config, "navigateRootAsync", async url => { resolve(url); }); });
	page.logIn(); assert.equal(await destination, "/home?fixture=next");
	assert.equal(AppConfig.isAuthenticated, true); assert.equal(UserProfile.get("fixture-user").Name, "Fixture");
	const sent = requests.find(request => request.method === "POST");
	assert.equal(decrypt(sent.body.Account), "fixture@example.test"); assert.equal(decrypt(sent.body.Password), "fixture-password");
	page.ngOnDestroy();
}));

test("Login page Require2FA retains hidden ID/provider and tolerates form construction emissions", async context => withUsers(async users => {
	await initialize();
	const fallback = apiResponse;
	const challenge = { Require2FA: true, ID: "fixture-challenge", Providers: [{ Info: "fixture-app", Label: "Fixture app", Type: "App" }] };
	apiResponse = request => request.method === "POST" ? challenge : fallback(request);
	const { forms, page } = pageFixture(users); await buildLogin(page, forms);
	page.login.form.patchValue({ Account: "fixture@example.test", Password: "fixture-password", Persistence: true });
	const open = page.openLoginOTPAsync.bind(page);
	const opened = complete(resolve => { context.mock.method(page, "openLoginOTPAsync", async data => { await open(data); resolve(); }); });
	page.logIn(); await opened;
	assert.equal(page.mode, "otp"); assert.equal(AppConfig.isAuthenticated, false);
	page.otp.controls = forms.getControls(page.otp.config); forms.buildForm(page.otp.form, page.otp.controls, page.otp.value);
	assert.equal(page.otp.controls.find(item => item.Name === "Provider").Hidden, true);
	assert.equal(page.otp.form.value.ID, "fixture-challenge"); assert.equal(page.otp.form.value.Provider, "fixture-app");
	page.ngOnDestroy(); assert.equal(page.otp.subscription.closed, true);
}));

test("Login OTP page sends encrypted ID/provider/code and commits session before redirect", async context => withUsers(async users => {
	await initialize(); const fallback = apiResponse;
	apiResponse = request => request.method === "PUT" && new URL(request.url).pathname === "/users/session" ? envelope("fixture-user") : fallback(request);
	const { forms, page } = pageFixture(users);
	await page.openLoginOTPAsync({ ID: "fixture-challenge", Providers: [{ Info: "fixture-app", Label: "Fixture app", Type: "App" }] });
	page.otp.controls = forms.getControls(page.otp.config); forms.buildForm(page.otp.form, page.otp.controls, page.otp.value); page.otp.form.patchValue({ OTP: "123456" });
	AppConfig.URLs.stack = [{ url: "/users/login", params: { next: AppCrypto.base64urlEncode("/home?fixture=otp") } }];
	const destination = complete(resolve => { context.mock.method(config, "navigateRootAsync", async url => { resolve(url); }); });
	page.logInOTP(); assert.equal(await destination, "/home?fixture=otp");
	const sent = requests.find(request => request.method === "PUT");
	assert.deepEqual([decrypt(sent.body.ID), decrypt(sent.body.Info), decrypt(sent.body.OTP)], ["fixture-challenge", "fixture-app", "123456"]);
	assert.equal(AppConfig.isAuthenticated, true); page.ngOnDestroy();
}));

test("Login SMS request uses real UsersService query and encrypted SMS payload", async () => withUsers(async users => {
	await initialize(); const { forms, page } = pageFixture(users);
	await page.openLoginOTPAsync({ ID: "fixture-challenge", Providers: [{ Info: "fixture-app", Label: "Fixture app", Type: "App" }, { Info: "+84900000000", Label: "Fixture SMS", Type: "SMS" }] });
	page.otp.controls = forms.getControls(page.otp.config); forms.buildForm(page.otp.form, page.otp.controls, page.otp.value); page.otp.form.patchValue({ Provider: "+84900000000" });
	const request = await complete(resolve => {
		const fallback = apiResponse;
		apiResponse = candidate => { if (new URL(candidate.url).pathname === "/users/otp") { resolve(candidate); return {}; } return fallback(candidate); };
		page.requestOTP();
	});
	const query = new URL(request.url).searchParams;
	assert.equal(query.get("x-sms-otp"), "fixture-challenge");
	const payload = AppCrypto.jsonDecode(query.get("x-body"));
	assert.equal(decrypt(payload.OtpType), "SMS"); assert.equal(decrypt(payload.OtpPhone), "+84900000000");
	page.ngOnDestroy();
}));

test("Login page validation stops empty credentials before any authentication request", async () => withUsers(async users => {
	await initialize(); const { forms, page } = pageFixture(users); await buildLogin(page, forms); requests.length = 0;
	page.logIn(); assert.equal(requests.length, 0); assert.equal(page.login.form.invalid, true); page.ngOnDestroy();
}));
