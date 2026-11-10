import "@angular/compiler";
import assert from "node:assert/strict";
import test from "node:test";
import { createCipheriv, createHmac, generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { HttpClient, HttpResponse } from "@angular/common/http";
import { EMPTY, Observable, of, throwError } from "rxjs";
import { AppUtility } from "@app/components/app.utility";
import { AppCrypto } from "@app/components/app.crypto";
import { RSA } from "@app/components/app.crypto.rsa";
import { Dictionary, HashSet } from "@app/components/app.collections";
import { AppPagination } from "@app/components/app.pagination";
import { AppStorage } from "@app/components/app.storage";
import { AppAPIs } from "@app/components/app.apis";
import { AppConfig } from "@app/app.config";
import { Account } from "@app/models/account";
import { AppReadyGuardService, AuthenticatedGuardService, NotAuthenticatedGuardService, RegisterGuardService } from "@app/services/base.service";

test("Observable adapter resolves the last value only after completion", async () => {
	let subscriber;
	const source = new Observable<number>(observer => { subscriber = observer; });
	let settled = false;
	const result = AppUtility.toAsync(source).then(value => { settled = true; return value; });
	subscriber.next(1);
	subscriber.next(2);
	await Promise.resolve();
	assert.equal(settled, false);
	subscriber.complete();
	assert.equal(await result, 2);
});

test("Observable adapter preserves EMPTY and error semantics", async () => {
	assert.equal(await AppUtility.toAsync(EMPTY), undefined);
	const error = new Error("fixture observable failure");
	await assert.rejects(AppUtility.toAsync(throwError(() => error)), candidate => candidate === error);
});

test("invoke resolves before its scheduled callback and does not wait for callback work", async () => {
	let called = false;
	let completeCallback;
	const callbackCompleted = new Promise<void>(resolve => { completeCallback = resolve; });
	await AppUtility.invoke(() => { called = true; completeCallback(); });
	assert.equal(called, false);
	await callbackCompleted;
	assert.equal(called, true);
});

test("collections keep mutation, identity and LINQ behavior", () => {
	const values = [{ id: "b", rank: 2 }, { id: "a", rank: 1 }];
	assert.equal(values.sortBy("rank"), values);
	assert.deepEqual(values.map(value => value.id), ["a", "b"]);
	const items = new Dictionary(values, value => value.id);
	assert.equal(items.get("a"), values[0]);
	assert.equal(items.contains("b"), true);
	assert.equal(items.toList().Count(), 2);
	assert.deepEqual(new HashSet(["a", "a", "b"]).toArray(), ["a", "b"]);
	assert.equal(values.removeAt(-1), values);
	assert.equal(values.length, 2);
});

test("LINQ preserves the Books filtering, multi-key sorting, paging and original objects", () => {
	const books = [
		{ id: "a", title: "Beta", chapters: 10, updated: 1, active: true },
		{ id: "b", title: "Alpha", chapters: 10, updated: 2, active: true },
		{ id: "c", title: "Alpha", chapters: 5, updated: 3, active: true },
		{ id: "d", title: "Hidden", chapters: 99, updated: 9, active: false }
	];
	const source = new Dictionary(books, book => book.id);
	const byChapters = source.toList(book => book.active).OrderByDescending(book => book.chapters).ThenBy(book => book.updated).Take(2);
	assert.deepEqual(byChapters.ToArray().map(book => book.id), ["a", "b"]);
	const ratings: any[] = []; byChapters.ForEach(book => ratings.push(book));
	assert.equal(ratings[0], books[0]); assert.equal(ratings[1], books[1]);
	const byTitle = books.toList().Where(book => book.active).OrderBy(book => book.title).ThenByDescending(book => book.updated).ToArray();
	assert.deepEqual(byTitle.map(book => book.id), ["c", "b", "a"]);
	const byUpdated = new HashSet(books).toList(book => book.active).OrderByDescending(book => book.updated);
	assert.deepEqual(byUpdated.ToArray().map(book => book.id), ["c", "b", "a"]);
	assert.equal(byUpdated.Count(), 3);
	assert.equal(source.get("a"), books[0]);
	assert.deepEqual(books.map(book => book.id), ["a", "b", "c", "d"]);
});

test("JSON/base64url and JWT agree with UTF-8 and Node HMAC fixtures", () => {
	const payload = { uid: "fixture-user", text: "Địa chỉ / CMS", iat: 1700000000 };
	const encoded = AppCrypto.jsonEncode(payload);
	assert.equal(encoded, Buffer.from(JSON.stringify(payload)).toString("base64url"));
	assert.deepEqual(AppCrypto.jsonDecode(encoded), payload);
	const token = AppCrypto.jwtEncode(payload, "fixture-signing-key", false);
	const [header, body, signature] = token.split(".");
	assert.equal(signature, createHmac("sha256", "fixture-signing-key").update(header + "." + body).digest("base64url"));
	assert.deepEqual(AppCrypto.jwtDecode(token, "fixture-signing-key"), payload);
	assert.equal(AppCrypto.jwtDecode(token, "another-fixture-key"), undefined);
	assert.equal(payload.iat, 1700000000);
});

test("AES CBC/PKCS7 output agrees with independent Node crypto and base64 key input", () => {
	const key = Buffer.from("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", "hex");
	const iv = Buffer.from("101112131415161718191a1b1c1d1e1f", "hex");
	const text = "VIEApps – dữ liệu fixture";
	const cipher = createCipheriv("aes-256-cbc", key, iv);
	const expected = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("base64");
	AppCrypto.init({ aes: { key: key.toString("hex"), iv: iv.toString("hex") }, rsa: undefined, jwt: undefined });
	assert.equal(AppCrypto.aesEncrypt(text), expected);
	assert.equal(AppCrypto.aesDecrypt(expected), text);
	assert.equal(AppCrypto.aesEncrypt(text, true), Buffer.from(expected, "base64").toString("hex"));
	AppCrypto.init({ aes: { key: key.toString("base64"), iv: iv.toString("base64"), isBase64: true }, rsa: undefined, jwt: undefined });
	assert.equal(AppCrypto.aesEncrypt(text), expected);
});

test("legacy RSA ciphertext decrypts to a PKCS1 v1.5 block using an ephemeral Node key", () => {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
	const jwk = publicKey.export({ format: "jwk" });
	const rsa = new RSA();
	rsa.init(Buffer.from(jwk.e, "base64url").toString("hex"), "01", Buffer.from(jwk.n, "base64url").toString("hex"));
	const text = "fixture-session-value";
	const ciphertext = Buffer.from(rsa.encrypt(text), "base64");
	const paddedCiphertext = Buffer.concat([Buffer.alloc(256 - ciphertext.length), ciphertext]);
	const block = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, paddedCiphertext);
	assert.equal(block[0], 0);
	assert.equal(block[1], 2);
	const separator = block.indexOf(0, 2);
	assert.ok(separator >= 10);
	assert.equal(block.subarray(separator + 1).toString("ascii"), text);
});

test("account deserialization preserves cache identity, roles and privilege objects", () => {
	const account = Account.update({ id: "fixture-account", roles: ["All", "All", "Authorized"], privileges: [{ ServiceName: "Portals", ObjectName: "Content", Role: "Editor" }] });
	assert.equal(Account.get("fixture-account"), account);
	assert.deepEqual(account.roles, ["All", "Authorized"]);
	assert.equal(account.privileges[0].Role, "Editor");
	assert.equal(Account.update({ id: "fixture-account", status: "Activated" }), account);
	assert.equal(account.status, "Activated");
});

test("pagination clones request filters and does not cache full-text query results", () => {
	const source = { And: [null, { Status: { Equals: "Published" } }] };
	const request = AppPagination.buildRequest(source);
	assert.equal(source.And.length, 2);
	assert.equal(request.FilterBy.And.length, 1);
	AppPagination.set({ ...request, Pagination: { TotalRecords: 21, TotalPages: 2, PageSize: 20, PageNumber: 1 } }, "fixture");
	const pagination = AppPagination.get(request, "fixture");
	assert.equal(pagination.TotalRecords, 21);
	pagination.PageNumber = 99;
	assert.equal(AppPagination.get(request, "fixture").PageNumber, 1);
	const query = { FilterBy: { Query: "search" }, Pagination: { TotalRecords: 5 } };
	AppPagination.set(query, "fixture-query");
	assert.equal(AppPagination.get(query, "fixture-query"), undefined);
});

test("storage operations queue until create resolves, without losing callback or data", async () => {
	let resolveCreate;
	let createCount = 0;
	let callbackCount = 0;
	const calls: string[] = [];
	const data = new Map<string, unknown>();
	const storage = {
		create: () => { createCount++; return new Promise<any>(resolve => { resolveCreate = resolve; }); },
		set: async (key, value) => { calls.push("set"); data.set(key, value); },
		get: async key => { calls.push("get"); return data.get(key); },
		remove: async key => { calls.push("remove"); data.delete(key); }
	};
	const initialized = AppStorage.initializeAsync(storage as any, () => { callbackCount++; });
	const write = AppStorage.setAsync("fixture-key", { id: "fixture" });
	await Promise.resolve();
	assert.deepEqual(calls, []);
	resolveCreate(storage);
	await Promise.all([initialized, write]);
	assert.equal(callbackCount, 1);
	assert.deepEqual(await AppStorage.getAsync("fixture-key"), { id: "fixture" });
	await AppStorage.initializeAsync(storage as any, () => { callbackCount++; });
	assert.equal(createCount, 1);
	assert.equal(callbackCount, 2);
	await AppStorage.removeAsync("fixture-key");
	assert.equal(await AppStorage.getAsync("fixture-key"), undefined);
	assert.deepEqual(calls, ["set", "get", "remove", "get"]);
});

const requests = [];
let response = of(new HttpResponse({ body: { ok: true } }));
const http = new HttpClient({ handle: request => { requests.push(request); return response; } } as any);
AppAPIs.initialize(http);
AppConfig.URIs.apis = "https://example.invalid/";
AppConfig.session.device = "fixture-device";
AppConfig.session.keys.jwt = "fixture-signing-key";
AppConfig.session.token = { uid: "fixture-user", iat: 1700000000 };
AppConfig.app.platform = "Desktop PWA";
AppConfig.app.query.includeToken = false;

test("HTTP request keeps headers, body, x-request and encoded extras without a network backend", async () => {
	const request = { FilterBy: { And: [] }, Pagination: { PageSize: 20, PageNumber: 1 } };
	const body = { Title: "Fixture" };
	const extra = { trace: "fixture-trace" };
	await AppUtility.toAsync(AppAPIs.sendRequest({
		Path: "portals/content/id?x-request=" + AppCrypto.jsonEncode(request),
		Verb: "POST", Body: body, Extra: extra,
		Header: { "x-fixture": "present", "x-ignored": undefined }
	}));
	const sent = requests.at(-1);
	assert.equal(sent.method, "POST");
	assert.equal(sent.body, body);
	assert.equal(sent.headers.get("x-device-id"), "fixture-device");
	assert.equal(sent.headers.get("x-app-platform"), "Desktop PWA");
	assert.equal(sent.headers.get("x-fixture"), "present");
	assert.equal(sent.headers.has("x-ignored"), false);
	assert.equal(AppCrypto.jwtDecode(sent.headers.get("x-app-token"), "fixture-signing-key").uid, "fixture-user");
	const url = new URL(sent.url);
	assert.equal(url.origin, "https://example.invalid");
	assert.equal(url.pathname, "/portals/content/id");
	assert.deepEqual(AppCrypto.jsonDecode(url.searchParams.get("x-request")), request);
	assert.deepEqual(AppCrypto.jsonDecode(url.searchParams.get("x-request-extra")), extra);
});

test("async HTTP success preserves callback scheduling and error path preserves callback", async () => {
	let callbackComplete;
	const completed = new Promise<void>(resolve => { callbackComplete = resolve; });
	const order: string[] = [];
	response = of(new HttpResponse({ body: { fixture: true } }));
	await AppAPIs.sendRequestAsync({ Path: "users/session" }, async data => {
		assert.equal(data.fixture, true);
		order.push("callback-start");
		await completed;
		order.push("callback-end");
	}, undefined, true);
	order.push("request-resolved");
	assert.deepEqual(order, ["callback-start", "request-resolved"]);
	callbackComplete();
	await Promise.resolve();
	assert.deepEqual(order, ["callback-start", "request-resolved", "callback-end"]);
	const failure = new Error("fixture-http-error");
	response = throwError(() => failure);
	let captured;
	await AppAPIs.sendRequestAsync({ Path: "users/session" }, undefined, error => { captured = error; }, true);
	assert.equal(captured, failure);
});

test("readiness and auth guards retain the full encoded redirect URL", () => {
	const navigations: string[] = [];
	const router = { navigateByUrl: url => { navigations.push(url); } };
	const path = "/portals/cms/contents?x-request=fixture";
	const location = { path: () => path };
	AppConfig.session.token = undefined;
	const ready = new AppReadyGuardService(router as any, location as any);
	assert.equal(ready.canActivate(), false);
	assert.equal(AppCrypto.base64urlDecode(AppConfig.URLs.redirectToWhenReady), path);
	assert.equal(navigations.at(-1), AppConfig.URLs.home);
	const auth = new AuthenticatedGuardService(router as any, location as any);
	assert.equal(auth.canActivate(), false);
	const [login, next] = navigations.at(-1).split("?next=");
	assert.equal(login, AppConfig.URLs.users.login);
	assert.equal(AppCrypto.base64urlDecode(next), path);
	AppConfig.session.token = { uid: "fixture-user" };
	const count = navigations.length;
	assert.equal(ready.canActivate(), true);
	assert.equal(auth.canActivate(), true);
	assert.equal(navigations.length, count);
});

test("anonymous-only and registration guards preserve their existing conditions", () => {
	const navigations: string[] = [];
	const router = { navigateByUrl: url => { navigations.push(url); } };
	const anonymous = new NotAuthenticatedGuardService(router as any);
	assert.equal(anonymous.canActivate(), false);
	assert.equal(navigations.at(-1), AppConfig.URLs.home);
	AppConfig.session.token = undefined;
	assert.equal(anonymous.canActivate(), true);
	const register = new RegisterGuardService(router as any);
	const allowed = AppConfig.accounts.registrable;
	try {
		AppConfig.accounts.registrable = false;
		assert.equal(register.canActivate(), false);
		assert.equal(navigations.at(-1), AppConfig.URLs.home);
		AppConfig.accounts.registrable = true;
		assert.equal(register.canActivate(), true);
	} finally {
		AppConfig.accounts.registrable = allowed;
	}
});
