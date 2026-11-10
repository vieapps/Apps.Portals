import "@angular/compiler";
import assert from "node:assert/strict";
import test, { beforeEach, afterEach, after } from "node:test";
import { HttpClient, HttpResponse } from "@angular/common/http";
import { of } from "rxjs";
import { AppAPIs } from "@app/components/app.apis";
import { AppConfig } from "@app/app.config";
import { AppCrypto } from "@app/components/app.crypto";

// No sockets or remote HTTP: the production transport talks only to these in-memory peers.
class FixturePeer {
	static sockets: FixturePeer[] = [];
	static streams: FixturePeer[] = [];
	onopen?: (event: any) => void;
	onclose?: (event: any) => void;
	onerror?: (event: any) => void;
	onmessage?: (event: any) => void;
	sent: any[] = [];
	closed = false;
	constructor(public url: string) {
		assert.equal(new URL(url).hostname, "fixture.invalid");
	}
	send(message: string) { this.sent.push(JSON.parse(message)); }
	// Deliberately asynchronous close event: callers explicitly deliver it, like a browser task.
	close() { this.closed = true; }
	opened() { this.onopen?.({ type: "open" }); }
	ended(code = 1006) { this.closed = true; this.onclose?.({ code, reason: "fixture close" }); }
	message(value: any) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
class FixtureSocket extends FixturePeer {
	constructor(url: string) { super(url); FixturePeer.sockets.push(this); }
}
class FixtureStream extends FixturePeer {
	constructor(url: string) { super(url); FixturePeer.streams.push(this); }
}
const originalGlobals = new Map(["WebSocket", "EventSource", "location", "fetch"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const setGlobal = (name: string, value: any) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
const api = AppAPIs as any; // Reset static queues between cases, never replace production transport methods.
const requests: any[] = [];
AppAPIs.initialize(new HttpClient({ handle: request => {
	assert.equal(new URL(request.url).hostname, "fixture.invalid");
	requests.push(request);
	return of(new HttpResponse({ body: { fixture: "http" } }));
} } as any));
const latestSocket = () => FixturePeer.sockets[FixturePeer.sockets.length - 1];
const connect = () => { AppAPIs.open(() => {}); latestSocket().opened(); return latestSocket(); };
const request = (identity: string) => ({ ServiceName: "Fixture", ObjectName: "Object", Query: { "object-identity": identity } });
beforeEach(context => {
	context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1700000000000 });
	context.mock.method(console, "log", () => {});
	setGlobal("WebSocket", FixtureSocket); setGlobal("EventSource", FixtureStream);
	setGlobal("location", { href: "http://127.0.0.1/home" });
	setGlobal("fetch", () => { throw new Error("Network is forbidden in transport fixtures"); });
	FixturePeer.sockets = []; FixturePeer.streams = []; requests.length = 0;
	Object.assign(api, {
		_webSocket: undefined, _eventStream: undefined, _status: undefined,
		_onOpened: undefined, _onClosed: undefined, _onError: undefined, _onMessage: undefined,
		_onTunnelOpened: undefined, _nocallbackMessages: {}, _callbackableMessages: {},
		_successCallbacks: {}, _errorCallbacks: {}, _resend: {},
		_serviceScopeHandlers: {}, _objectScopeHandlers: {}, _counter: 0,
		_isReopen: false, _attempt: 0, _totalOfReconnects: 0
	});
	AppConfig.app.websocketAsTunnel = true; AppConfig.app.debug = false;
	AppConfig.app.query.preferXHR = false; AppConfig.app.query.includeToken = false;
	AppConfig.app.query.defer = 20; AppConfig.app.query.outdated = 7;
	AppConfig.URIs.apis = "https://fixture.invalid/"; AppConfig.URIs.ws = "https://fixture.invalid/";
	AppConfig.session.id = "fixture-session"; AppConfig.session.device = "fixture-device";
	AppConfig.session.account = undefined; AppConfig.session.token = { uid: "" };
	AppConfig.session.keys.jwt = "fixture-signing-key";
	AppCrypto.init({ aes: { key: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", iv: "101112131415161718191a1b1c1d1e1f" }, rsa: undefined, jwt: undefined });
});
afterEach(context => { context.mock.timers.reset(); });
after(() => {
	for (const [name, descriptor] of originalGlobals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete globalThis[name];
	}
});

test("open continuation can precede native open; ready and AUTH wait for the event", context => {
	let continued = 0;
	AppAPIs.open(() => continued++);
	const peer = latestSocket();
	assert.equal(AppAPIs.isReady, false); assert.equal(continued, 0);
	context.mock.timers.tick(10);
	assert.equal(continued, 1); assert.equal(AppAPIs.isReady, false); assert.equal(peer.sent.length, 0);
	peer.opened();
	assert.equal(AppAPIs.isReady, true); assert.equal(peer.sent[0].Verb, "AUTH");
	assert.equal(AppCrypto.aesDecrypt(peer.sent[0].Header["x-session-id"]), "fixture-session");
	assert.equal(AppCrypto.aesDecrypt(peer.sent[0].Header["x-device-id"]), "fixture-device");
	const url = new URL(peer.url);
	assert.equal(url.protocol, "wss:"); assert.equal(url.pathname, "/~tunnel");
	assert.equal(AppCrypto.base64urlDecode(url.searchParams.get("x-session-id")), "fixture-session");
});

test("offline queues flush AUTH then fire-and-forget then callback request", () => {
	AppAPIs.open();
	AppAPIs.sendWebSocketRequest(request("no-callback"));
	let result;
	AppAPIs.sendWebSocketRequest(request("callback"), value => result = value);
	const peer = latestSocket(); peer.opened();
	assert.equal(peer.sent[0].Verb, "AUTH");
	assert.equal(peer.sent[1].Query["object-identity"], "no-callback");
	const pending = peer.sent[2];
	assert.equal(pending.Query["object-identity"], "callback");
	peer.message({ ID: pending.ID, Data: { ok: true } });
	assert.deepEqual(result, { ok: true });
	assert.deepEqual(Object.keys(api._callbackableMessages), []);
});

test("reconnect authenticates and replays pending requests sequentially by response", context => {
	const first = connect(); const results: string[] = [];
	AppAPIs.sendWebSocketRequest(request("a"), () => results.push("a"));
	AppAPIs.sendWebSocketRequest(request("b"), () => results.push("b"));
	const ids = first.sent.slice(1).map(value => value.ID);
	AppAPIs.reopen("fixture reconnect");
	assert.equal(first.closed, true);
	context.mock.timers.tick(136);
	const second = latestSocket(); assert.notEqual(second, first); second.opened();
	assert.equal(new URL(second.url).searchParams.has("x-restart"), true);
	assert.deepEqual(second.sent.map(value => value.Verb === "AUTH" ? "AUTH" : value.ID), ["AUTH", ids[0]]);
	second.message({ ID: ids[0], Data: {} }); context.mock.timers.tick(200);
	assert.equal(second.sent[2].ID, ids[1]);
	second.message({ ID: ids[1], Data: {} });
	assert.deepEqual(results, ["a", "b"]);
	assert.equal(AppAPIs.isReopen, true); assert.equal(api._attempt, 0);
});

test("same request signature replaces the earlier pending callback", () => {
	const peer = connect(); let old = 0, current = 0;
	AppAPIs.sendWebSocketRequest(request("same"), () => old++);
	AppAPIs.sendWebSocketRequest(request("same"), () => current++);
	peer.message({ ID: peer.sent[1].ID, Data: {} });
	peer.message({ ID: peer.sent[2].ID, Data: {} });
	assert.equal(old, 0); assert.equal(current, 1);
});

test("expired pending messages are removed before a later request", context => {
	const peer = connect(); let stale = 0;
	AppAPIs.sendWebSocketRequest(request("stale"), () => stale++);
	const oldID = peer.sent[1].ID;
	context.mock.timers.setTime(1700000000000 + 8 * 60000);
	AppAPIs.sendWebSocketRequest(request("new"), () => {});
	peer.message({ ID: oldID, Data: {} });
	assert.equal(stale, 0); assert.equal(api._callbackableMessages[oldID], undefined);
});

test("WS async wrapper resolves before its response callback", async () => {
	const peer = connect(); let response = false;
	await AppAPIs.sendRequestAsync(request("async"), () => response = true);
	assert.equal(response, false);
	peer.message({ ID: peer.sent[1].ID, Data: {} });
	assert.equal(response, true);
});

test("nonsecurity errors use the error callback and remove pending state", () => {
	const peer = connect(); let error;
	AppAPIs.sendWebSocketRequest(request("error"), undefined, value => error = value);
	const data = { Type: "ValidationException", Message: "fixture" };
	peer.message({ ID: peer.sent[1].ID, Type: "Error", Data: data });
	assert.deepEqual(error, data); assert.deepEqual(Object.keys(api._callbackableMessages), []);
});

test("expired token reconnects rather than invoking a request error callback", context => {
	context.mock.method(console, "error", () => {});
	const peer = connect(); let errors = 0;
	AppAPIs.sendWebSocketRequest(request("expired-token"), undefined, () => errors++);
	peer.message({ ID: peer.sent[1].ID, Type: "Error", Data: { Type: "TokenExpiredException", Message: "fixture" } });
	assert.equal(errors, 0); assert.equal(peer.closed, true);
	context.mock.timers.tick(136); assert.equal(FixturePeer.sockets.length, 2);
});

test("security failures broadcast Users Session Revoke; Unauthorized stays a request error", context => {
	context.mock.method(console, "error", () => {});
	const peer = connect(); const messages: any[] = [];
	AppAPIs.registerAsObjectScopeProcessor("Users", "Session", value => messages.push(value));
	peer.message({ Type: "Error", Data: { Type: "InvalidTokenException", Message: "fixture" } });
	assert.equal(messages.length, 1); assert.equal(messages[0].Type.Event, "Revoke");
	let error;
	AppAPIs.sendWebSocketRequest(request("unauthorized"), undefined, value => error = value);
	peer.message({ ID: peer.sent[1].ID, Type: "Error", Data: { Type: "UnauthorizedException" } });
	assert.equal(error.Type, "UnauthorizedException"); assert.equal(messages.length, 1);
});

test("incoming update dispatches service then object processors despite a failing handler", context => {
	context.mock.method(console, "error", () => {});
	const peer = connect(); const order: string[] = [];
	AppAPIs.onMessage = () => order.push("raw");
	AppAPIs.registerAsServiceScopeProcessor("Fixture", () => { order.push("service"); throw new Error("fixture handler"); });
	AppAPIs.registerAsServiceScopeProcessor("Fixture", () => order.push("next"), "removable");
	AppAPIs.registerAsObjectScopeProcessor("Fixture", "Object", message => { assert.equal(message.Type.Event, "Update"); order.push("object"); });
	peer.message({ Type: "Fixture#Object#Update", Data: { ID: "fixture-id" } });
	assert.deepEqual(order, ["raw", "service", "next", "object"]);
	AppAPIs.unregisterProcessor("removable", "Fixture"); order.length = 0;
	peer.message({ Type: "Fixture#Object#Update", Data: {} });
	assert.deepEqual(order, ["raw", "service", "object"]);
});

test("malformed response retains and resends the pending request", context => {
	const peer = connect(); let success = 0;
	AppAPIs.sendWebSocketRequest(request("malformed"), () => success++);
	const id = peer.sent[1].ID;
	peer.onmessage({ data: "{invalid-json" }); context.mock.timers.tick(200);
	assert.equal(peer.sent[2].ID, id); assert.equal(success, 0);
	peer.message({ ID: id, Data: {} }); assert.equal(success, 1);
});

test("Ping updates liveness and sends PONG; stale ping routes the next request to HTTP", async context => {
	const peer = connect(); peer.message({ Type: "Ping", Data: {} });
	assert.equal(peer.sent[1].Verb, "PONG");
	context.mock.timers.setTime(1700000000000 + 360001);
	await AppAPIs.sendRequestAsync(request("stale-ping"));
	assert.equal(requests.length, 1); assert.equal(peer.closed, true);
});

test("unopened WebSocket falls back to SSE after 13 seconds", context => {
	AppAPIs.open(); const peer = latestSocket();
	context.mock.timers.tick(13000); assert.equal(peer.closed, true);
	context.mock.timers.tick(123);
	assert.equal(AppConfig.app.websocketAsTunnel, false); assert.equal(FixturePeer.streams.length, 1);
	const stream = FixturePeer.streams[0]; stream.opened();
	assert.equal(AppAPIs.isReady, true); assert.equal(stream.sent.length, 0);
});

test("abnormal WS close schedules reconnect; close code 1007 does not", context => {
	let closes = 0; AppAPIs.onClosed = () => closes++;
	const peer = connect(); peer.ended(1007); context.mock.timers.tick(200);
	assert.equal(FixturePeer.sockets.length, 1); assert.equal(AppAPIs.isReady, false);
	peer.ended(1006); context.mock.timers.tick(136);
	assert.equal(FixturePeer.sockets.length, 2); assert.equal(closes, 2);
});

test("exhausted reconnect counter switches to SSE", context => {
	const peer = connect(); api._totalOfReconnects = 14;
	peer.ended(); context.mock.timers.tick(123);
	assert.equal(AppConfig.app.websocketAsTunnel, false); assert.equal(FixturePeer.streams.length, 1);
});

test("SSE delivers updates but sends requests by HTTP, and close releases it", async () => {
	AppConfig.app.websocketAsTunnel = false;
	AppAPIs.open(); const stream = FixturePeer.streams[0]; stream.opened();
	let update, response;
	AppAPIs.registerAsObjectScopeProcessor("Fixture", "Object", value => update = value.Data);
	stream.message({ Type: "Fixture#Object#Update", Data: { ID: "stream-update" } });
	await AppAPIs.sendRequestAsync(request("sse-request"), value => response = value);
	assert.deepEqual(update, { ID: "stream-update" }); assert.deepEqual(response, { fixture: "http" });
	assert.equal(requests.length, 1); assert.equal(stream.sent.length, 0);
	let closed = false; AppAPIs.close(() => closed = true);
	assert.equal(closed, true); assert.equal(stream.closed, true); assert.equal(AppAPIs.isReady, false);
});

test("SSE error marks unready and a later native open restores ready", () => {
	AppConfig.app.websocketAsTunnel = false;
	AppAPIs.open(); const stream = FixturePeer.streams[0]; stream.opened();
	let errors = 0; AppAPIs.onError = () => errors++;
	stream.onerror({ type: "error" }); assert.equal(errors, 1); assert.equal(AppAPIs.isReady, false);
	stream.opened(); assert.equal(AppAPIs.isReady, true); assert.equal(FixturePeer.streams.length, 1);
});

test("without either browser transport open still calls its continuation", () => {
	setGlobal("WebSocket", undefined); setGlobal("EventSource", undefined);
	let called = false; AppAPIs.open(() => called = true);
	assert.equal(called, true); assert.equal(AppAPIs.isReady, false);
});

test("legacy edge: first open without continuation can recurse after reconnect", context => {
	AppAPIs.open(); latestSocket().opened();
	AppAPIs.reopen("fixture missing initial continuation"); context.mock.timers.tick(136);
	latestSocket().opened();
	assert.throws(() => context.mock.timers.tick(10), RangeError);
});
