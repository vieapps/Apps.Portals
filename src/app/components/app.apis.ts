import { Subject, EMPTY as EmptyObservable } from "rxjs";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { AppConfig } from "@app/app.config";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";

/** Presents the struct of a message type */
export interface AppMessageType {
	Service: string;
	Object?: string;
	Event?: string;
}

/** Presents the struct of a message */
export interface AppMessage {
	Type: AppMessageType;
	Data: any;
}

/** Presents the struct of a requesting information */
export interface AppRequestInfo {
	ServiceName?: string;
	ObjectName?: string;
	Verb?: string;
	Header?: { [key: string]: string };
	Query?: { [key: string]: string };
	Extra?: { [key: string]: string };
	Body?: any;
	Path?: string;
}

/** Servicing component for working with APIs */
export class AppAPIs {

	private static _status = "initializing";
	private static _uri: string;
	private static _websocket: WebSocket;
	private static _types: { [key: string]: AppMessageType } = {};
	private static _serviceScopeHandlers: { [key: string]: Array<{ func: (message: AppMessage) => void, identity: string }> } = {};
	private static _objectScopeHandlers: { [key: string]: Array<{ func: (message: AppMessage) => void, identity: string }> } = {};
	private static _serviceScopeSubject: Subject<{ service: string, message: AppMessage }>;
	private static _objectScopeSubject: Subject<{ service: string, object: string, message: AppMessage }>;
	private static _requests = {
		counter: 0,
		nocallbackRequests: {} as { [id: string]: string },
		callbackableRequests: {} as { [id: string]: string },
		successCallbacks: {} as { [id: string]: (data?: any) => void },
		errorCallbacks: {} as { [id: string]: (error?: any) => void }
	};
	private static _pingTime = new Date().getTime();
	private static _attempt = 0;
	private static _http: HttpClient;
	private static _onWebSocketOpened: (event: Event) => void;
	private static _onWebSocketClosed: (event: CloseEvent) => void;
	private static _onWebSocketGotError: (event: Event) => void;
	private static _onWebSocketGotMessage: (event: MessageEvent) => void;

	/** Gets the last time when got PING */
	public static get pingTime() {
		return this._pingTime;
	}

	/** Gets the HttpClient instance for working with XMLHttpRequest (XHR) */
	public static get http() {
		return this._http;
	}

	/** Sets the action to fire when the WebSocket connection is opened */
	public static set onWebSocketOpened(func: (event: Event) => void) {
		this._onWebSocketOpened = func;
	}

	/** Sets the action to fire when the WebSocket connection is closed */
	public static set onWebSocketClosed(func: (event: CloseEvent) => void) {
		this._onWebSocketClosed = func;
	}

	/** Sets the action to fire when the WebSocket connection got any error */
	public static set onWebSocketGotError(func: (event: Event) => void) {
		this._onWebSocketGotError = func;
	}

	/** Sets the action to fire when the WebSocket connection got any message */
	public static set onWebSocketGotMessage(func: (event: MessageEvent) => void) {
		this._onWebSocketGotMessage = func;
	}

	private static get isWebSocketReady() {
		return this._websocket !== undefined && this._status === "ready";
	}

	/** Initializes the instance of the Angular HttpClient service for working with XMLHttpRequest (XHR) */
	public static initializeHttpClient(http: HttpClient) {
		if (this._http === undefined && AppUtility.isNotNull(http)) {
			this._http = http;
		}
	}

	/** Gets the absolute URL to send a request to APIs */
	public static getURL(url: string, endpoint?: string) {
		return (url.startsWith("http://") || url.startsWith("https://") ? "" : endpoint || AppConfig.URIs.apis) + url;
	}

	/**
		* Gets the headers that include the authenticated headers
		* @param data The initialize data, could be an object or an array of <name, value> key-value-pair
	*/
	public static getHeaders(data?: any) {
		const headers = AppConfig.getAuthenticatedHeaders();
		if (AppUtility.isArray(data, true)) {
			(data as Array<any>).forEach(header => {
				if (AppUtility.isObject(header, true) && AppUtility.isNotEmpty(header.name) && AppUtility.isNotEmpty(header.value)) {
					headers[header.name as string] = header.value as string;
				}
			});
		}
		else if (AppUtility.isObject(data, true)) {
			Object.keys(data).forEach(name => {
				const value = data[name];
				if (AppUtility.isNotNull(value)) {
					headers[name] = value.toString();
				}
			});
		}
		return headers;
	}

	/** Parses the requesting information */
	public static parseRequestInfo(path: string) {
		const uri = PlatformUtility.parseURI(path);
		const requestedInfo = {
			ServiceName: uri.Paths[0],
			ObjectName: uri.Paths.length > 1 ? uri.Paths[1] : "",
			ObjectIdentity: undefined as string,
			Query: uri.QueryParams
		};
		if (uri.Paths.length > 2) {
			requestedInfo.ObjectIdentity = requestedInfo.Query["object-identity"] = uri.Paths[2];
		}
		return requestedInfo;
	}

	private static parseMessageType(identity: string) {
		let type = this._types[identity];
		if (type === undefined) {
			let pos = AppUtility.indexOf(identity, "#"), object = "", event = "";
			const service = pos > 0 ? identity.substring(0, pos) : identity;
			if (pos > 0) {
				object = identity.substring(pos + 1);
				pos = AppUtility.indexOf(object, "#");
				if (pos > 0) {
					event = object.substring(pos + 1);
					object = object.substring(0, pos);
				}
			}
			type = {
				Service: service,
				Object: object,
				Event: event
			};
			this._types[identity] = type;
		}
		return type;
	}

	private static getServiceHandlers(service: string) {
		this._serviceScopeHandlers[service] = this._serviceScopeHandlers[service] || [];
		return this._serviceScopeHandlers[service];
	}

	private static getObjectHandlers(service: string, object: string) {
		const type = `${service}#${object || ""}`;
		this._objectScopeHandlers[type] = this._objectScopeHandlers[type] || [];
		return this._objectScopeHandlers[type];
	}

	/**
	  * Registers a handler for processing updating messages at scope of a service
	  * @param service The string that presents name of a service
	  * @param handler The function for processing when got a message from APIs
	  * @param identity The string that presents identity of the handler for unregistering later
	*/
	public static registerAsServiceScopeProcessor(service: string, handler: (message: AppMessage) => void, identity?: string) {
		if (AppUtility.isNotEmpty(service) && handler !== undefined) {
			this.getServiceHandlers(service).push({
				func: handler,
				identity: AppUtility.isNotEmpty(identity) ? identity : ""
			});
		}
	}

	/**
	  * Registers a handler for processing updating messages at scope of a service
	  * @param service The string that presents name of a service
	  * @param object The string that presents name of an object in the service
	  * @param handler The function for processing when got a message from APIs
	  * @param identity The string that presents identity of the handler for unregistering later
	*/
	public static registerAsObjectScopeProcessor(service: string, object: string, handler: (message: AppMessage) => void, identity?: string) {
		if (AppUtility.isNotEmpty(service) && handler !== undefined) {
			this.getObjectHandlers(service, object).push({
				func: handler,
				identity: AppUtility.isNotEmpty(identity) ? identity : ""
			});
		}
	}

	/**
	  * Unregisters a handler that use to process the updating messages
	  * @param identity The string that presents identity of the handler for unregistering
	  * @param service The string that presents type of a message
	  * @param object The string that presents name of an object in the service
	*/
	public static unregisterProcessor(identity: string, service: string, object?: string) {
		if (AppUtility.isNotEmpty(identity) && AppUtility.isNotEmpty(service)) {
			let handlers = this.getServiceHandlers(service);
			let index = handlers.findIndex(handler => AppUtility.isEquals(identity, handler.identity));
			while (index > -1) {
				index = handlers.removeAt(index).findIndex(handler => AppUtility.isEquals(identity, handler.identity));
			}
			handlers = this.getObjectHandlers(service, object);
			index = handlers.findIndex(handler => AppUtility.isEquals(identity, handler.identity));
			while (index > -1) {
				index = handlers.removeAt(index).findIndex(handler => AppUtility.isEquals(identity, handler.identity));
			}
		}
	}

	/** Opens the WebSocket connection */
	public static openWebSocket(onOpened?: () => void, isRestart: boolean = false) {
		// check
		if (typeof WebSocket === "undefined") {
			console.warn("[AppAPIs]: Its requires a modern component that supports WebSocket");
			if (onOpened !== undefined) {
				onOpened();
			}
			return;
		}

		if (this._websocket !== undefined) {
			if (onOpened !== undefined) {
				onOpened();
			}
			return;
		}

		// initialize object for registering handlers
		if (this._serviceScopeSubject === undefined) {
			this._serviceScopeSubject = new Subject<{ service: string, message: AppMessage }>();
			this._serviceScopeSubject.subscribe(
				({ service, message }) => {
					this.getServiceHandlers(service).forEach(handler => {
						try {
							handler.func(message);
						}
						catch (error) {
							console.error("[AppAPIs]: Error occurred while running a handler", error);
						}
					});
				},
				error => console.warn("[AppAPIs]: Got an error", AppConfig.isNativeApp ? JSON.stringify(error) : error)
			);
		}

		if (this._objectScopeSubject === undefined) {
			this._objectScopeSubject = new Subject<{ service: string, object: string, message: AppMessage }>();
			this._objectScopeSubject.subscribe(
				({ service, object, message }) => {
					this.getObjectHandlers(service, object).forEach(handler => {
						try {
							handler.func(message);
						}
						catch (error) {
							console.error("[AppAPIs]: Error occurred while running a handler", error);
						}
					});
				},
				error => console.error(`[AppAPIs]: Got an error => ${AppUtility.getErrorMessage(error)}`, error)
			);
		}

		// create new instance of WebSocket
		this._status = "initializing";
		this._uri = (AppUtility.isNotEmpty(AppConfig.URIs.updates) ? AppConfig.URIs.updates : AppConfig.URIs.apis).replace("http://", "ws://").replace("https://", "wss://");
		this._websocket = new WebSocket(`${this._uri}v?x-session-id=${AppCrypto.base64urlEncode(AppConfig.session.id)}&x-device-id=${AppCrypto.base64urlEncode(AppConfig.session.device)}` + (isRestart ? "&x-restart=" : ""));
		this._pingTime = +new Date();

		// assign 'on-open' event handler
		this._websocket.onopen = event => {
			this._status = "ready";
			this.sendWebSocketMessage(AppConfig.authenticatingMessage);
			console.log(`[AppAPIs]: Opened... (${PlatformUtility.parseURI(this._uri).HostURI})`, AppUtility.toIsoDateTime(new Date(), true));
			if (this._onWebSocketOpened !== undefined) {
				try {
					this._onWebSocketOpened(event);
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the 'on-open' handler", error);
				}
			}
			this.sendWebSocketMessages(true);
		};

		// assign 'on-close' event handler
		this._websocket.onclose = event => {
			this._status = "close";
			console.log(`[AppAPIs]: Closed [${event.reason}]`, AppUtility.toIsoDateTime(new Date(), true));
			if (this._onWebSocketClosed !== undefined) {
				try {
					this._onWebSocketClosed(event);
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the 'on-close' handler", error);
				}
			}
			if (AppUtility.isNotEmpty(this._uri) && 1007 !== event.code) {
				this.reopenWebSocket();
			}
		};

		// assign 'on-error' event handler
		this._websocket.onerror = event => {
			this._status = "error";
			console.warn("[AppAPIs]: Got an error...", AppConfig.isDebug ? event : "");
			if (this._onWebSocketGotError !== undefined) {
				try {
					this._onWebSocketGotError(event);
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the 'on-error' handler", error);
				}
			}
		};

		// assign 'on-message' event handler
		this._websocket.onmessage = event => {
			// run the dedicated handler first
			if (this._onWebSocketGotMessage !== undefined) {
				try {
					this._onWebSocketGotMessage(event);
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the 'on-message' handler", error);
				}
			}

			// prepare
			let json: any;
			try {
				json = JSON.parse(event.data || "{}");
			}
			catch (error) {
				json = {};
				console.error("[AppAPIs]: Error occurred while parsing JSON", error);
			}

			// prepare handlers
			const successCallback = AppUtility.isNotEmpty(json.ID) ? this._requests.successCallbacks[json.ID] : undefined;
			const errorCallback = AppUtility.isNotEmpty(json.ID) ? this._requests.errorCallbacks[json.ID] : undefined;

			// got a callback
			if (successCallback !== undefined || errorCallback !== undefined) {
				try {
					if ("Error" === json.Type) {
						if (AppUtility.isGotSecurityException(json.Data)) {
							console.warn(`[AppAPIs]: Got a security issue: ${json.Data.Message} (${json.Data.Code})`, AppConfig.isDebug ? json.Data : "");
							this.reopenWebSocketWhenGotSecurityError(json.Data);
						}
						if (errorCallback !== undefined) {
							errorCallback(json);
						}
						else {
							console.error("[AppAPIs]: Got an error while processing", json);
						}
					}
					else if (successCallback !== undefined) {
						successCallback(json.Data);
					}
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the callback handler", error, json);
				}
			}

			// got an error
			else if ("Error" === json.Type) {
				if (AppUtility.isGotSecurityException(json.Data)) {
					console.warn(`[AppAPIs]: Got a security issue: ${json.Data.Message} (${json.Data.Code})`, AppConfig.isDebug ? json.Data : "");
					this.reopenWebSocketWhenGotSecurityError(json.Data);
				}
				else {
					console.warn(`[AppAPIs]: ${("InvalidRequestException" === json.Data.Type ? "Got an invalid requesting data" : "Got an error")}: ${json.Data.Message} (${json.Data.Code})`, AppConfig.isDebug ? json.Data : "");
				}
			}

			// got a special/broadcasting message
			else {
				// prepare
				const message: AppMessage = {
					Type: this.parseMessageType(json.Type),
					Data: json.Data || {}
				};

				if (AppConfig.isDebug) {
					console.log("[AppAPIs]: Got a message", AppConfig.isNativeApp ? JSON.stringify(message) : message);
				}

				// send PONG
				if (message.Type.Service === "Ping") {
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Got a heartbeat signal => response with PONG", AppUtility.toIsoDateTime(new Date(), true));
					}
					this._pingTime = new Date().getTime();
					this.sendWebSocketMessage({
						ServiceName: "Session",
						Verb: "PONG"
					});
				}

				// run schedulers
				else if (message.Type.Service === "Scheduler") {
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Got a signal to run scheduler", AppUtility.toIsoDateTime(new Date(), true));
					}
					this.broadcast({ Type: { Service: "Scheduler" }, Data: message.Data });
				}

				// response to knocking message when re-start
				else if (message.Type.Service === "Knock") {
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Knock, Knock, Knock ... => Yes, I'm right here", AppUtility.toIsoDateTime(new Date(), true));
					}
				}

				// broadcast the messags to all subscribers
				else {
					this.broadcast(message);
				}
			}

			if (AppUtility.isNotEmpty(json.ID)) {
				delete this._requests.callbackableRequests[json.ID];
				delete this._requests.successCallbacks[json.ID];
				delete this._requests.errorCallbacks[json.ID];
			}
		};

		// callback when done
		PlatformUtility.invoke(onOpened, this.isWebSocketReady ? 13 : 567);
	}

	private static destroyWebSocket() {
		if (this._websocket !== undefined) {
			this._websocket.close();
			this._websocket = undefined;
		}
	}

	/** Closes the WebSocket connection */
	public static closeWebSocket(onClosed?: () => void) {
		this._uri = undefined;
		this._status = "close";
		this.destroyWebSocket();
		if (onClosed !== undefined) {
			onClosed();
		}
	}

	/** Reopens the WebSocket connection */
	public static reopenWebSocket(reason?: string, defer?: number) {
		if (this._status !== "restarting") {
			this.destroyWebSocket();
			this._status = "restarting";
			this._attempt++;
			console.warn(`[AppAPIs]: ${reason || "Re-open because the WebSocket connection is broken"}`);
			PlatformUtility.invoke(() => {
				console.log(`[AppAPIs]: The WebSocket connection is re-opening... #${this._attempt}`);
				this.openWebSocket(() => {
					if (this.isWebSocketReady) {
						console.log(`[AppAPIs]: The WebSocket connection was re-opened... #${this._attempt}`);
						PlatformUtility.invoke(() => this._attempt = 0, 123);
					}
				}, true);
			}, defer || 123 + (this._attempt * 13));
		}
	}

	/** Reopens the WebSocket connection when got an error */
	public static reopenWebSocketWhenGotSecurityError(error?: any) {
		if ("TokenExpiredException" === error.Type) {
			this.reopenWebSocket("[AppAPIs]: Re-open WebSocket connection because the JWT was expired");
		}
		else {
			this.broadcast({
				Type: {
					Service: "Users",
					Object: "Session",
					Event: "Revoke"
				},
				Data: error.Data || {}
			});
		}
	}

	private static sendWebSocketMessages(sendCallbackables: boolean, additionalMessage?: string) {
		Object.keys(this._requests.nocallbackRequests).sort().forEach(id => this._websocket.send(this._requests.nocallbackRequests[id]));
		this._requests.nocallbackRequests = {};

		if (sendCallbackables) {
			Object.keys(this._requests.callbackableRequests).sort().forEach(id => this._websocket.send(this._requests.callbackableRequests[id]));
		}

		if (AppUtility.isNotEmpty(additionalMessage)) {
			this._websocket.send(additionalMessage);
		}
	}

	private static sendWebSocketMessage(requestInfo: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const id = `cmd-${this._requests.counter}`;
		const request = AppCrypto.stringify({
			ID: id,
			ServiceName: requestInfo.ServiceName,
			ObjectName: requestInfo.ObjectName || "",
			Verb: requestInfo.Verb || "GET",
			Query: requestInfo.Query || {},
			Header: requestInfo.Header || {},
			Extra: requestInfo.Extra || {},
			Body: requestInfo.Body || {}
		});
		this._requests.counter++;
		if (onSuccess !== undefined || onError !== undefined) {
			this._requests.callbackableRequests[id] = request;
			this._requests.successCallbacks[id] = onSuccess;
			this._requests.errorCallbacks[id] = onError;
		}
		if (this.isWebSocketReady) {
			this.sendWebSocketMessages(false, request);
		}
		else if (onSuccess === undefined && onError === undefined) {
			this._requests.nocallbackRequests[id] = request;
		}
	}

	private static canUseWebSocket(useXHR: boolean = false, checkPeriod: boolean = true) {
		let can = !useXHR && this.isWebSocketReady;
		if (can && checkPeriod) {
			if (+new Date() - this.pingTime > 300000) { // 5 minutes
				can = false;
				this.reopenWebSocket("[AppAPIs]: Ping period is too large...");
			}
		}
		return can;
	}

	/**
		* Sends a request to APIs using XMLHttpRequest
		* @param verb HTTP verb to perform the request
		* @param url Full URI of the end-point API's uri to perform the request
		* @param headers Additional headers to perform the request
		* @param body The JSON object that contains the body to perform the request
		* @param options The options to perform the request
	*/
	public static sendXMLHttpRequest(
		verb: string,
		url: string,
		options?: {
			headers?: HttpHeaders | { [header: string]: string | string[] };
			observe?: "body";
			params?: HttpParams | { [param: string]: string | string[] };
			reportProgress?: boolean;
			responseType?: "json";
			withCredentials?: boolean;
		},
		body?: any
	) {
		const http = this.http;
		if (http === undefined) {
			throw new Error("[AppAPIs]: Please call the 'initializeHttpClient' method to initialize the HttpClient instance before sending any request!");
		}
		switch ((verb || "GET").toUpperCase()) {
			case "GET":
				return http.get(url, options);
			case "POST":
				return http.post(url, body, options);
			case "PUT":
				return http.put(url, body, options);
			case "PATCH":
				return http.patch(url, options);
			case "DELETE":
				return http.delete(url, options);
			default:
				return http.get(url, options);
		}
	}

	/**
		* Sends a request to APIs using XMLHttpRequest
		* @param verb HTTP verb to perform the request
		* @param url Full URI of the end-point API's uri to perform the request
		* @param headers Additional headers to perform the request
		* @param body The JSON object that contains the body to perform the request
	*/
	public static sendXMLHttpRequestAsync(verb: string, url: string, headers?: any, body?: any) {
		return this.sendXMLHttpRequest(verb, url, { headers: this.getHeaders(headers) }, body).toPromise();
	}

	/**
		* Sends a request to APIs
		* @param request The requesting information
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param useXHR Set to true to always use XHR, false to let system decides
	*/
	public static send(request: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (this.canUseWebSocket(useXHR)) {
			const info = AppUtility.isNotEmpty(request.Path) ? this.parseRequestInfo(request.Path) : undefined;
			const requestInfo = {
				ServiceName: info !== undefined ? info.ServiceName : request.ServiceName,
				ObjectName: info !== undefined ? info.ObjectName : request.ObjectName,
				Query: (info !== undefined ? info.Query : request.Query) || {},
				Verb: request.Verb || "GET",
				Header: request.Header,
				Extra: request.Extra,
				Body: request.Body
			};
			["service-name", "object-name"].forEach(name => delete requestInfo.Query[name]);
			if (info !== undefined && AppUtility.isNotEmpty(info.ObjectIdentity)) {
				requestInfo.Query["object-identity"] = info.ObjectIdentity;
			}
			this.sendWebSocketMessage(requestInfo, onSuccess, onError);
			return EmptyObservable;
		}
		else {
			let path = request.Path;
			if (path === undefined) {
				let query = AppUtility.clone(request.Query || {});
				const objectIdentity = query["object-identity"];
				["service-name", "object-name", "object-identity"].forEach(name => delete query[name]);
				query = `?${AppUtility.getQueryOfJson(query)}`;
				path = `${request.ServiceName}${AppUtility.isNotEmpty(request.ObjectName) ? `/${request.ObjectName}` : ""}${AppUtility.isNotEmpty(objectIdentity) ? `/${objectIdentity}` : ""}${query === "?" ? "" : query}`;
			}
			path += request.Extra !== undefined ? (path.indexOf("?") > 0 ? "&" : "?") + `x-request-extra=${AppCrypto.jsonEncode(request.Extra)}` : "";
			return this.sendXMLHttpRequest(request.Verb || "GET", this.getURL(path), { headers: request.Header }, request.Body);
		}
	}

	/**
	 * Sends a request to APIs
	 * @param request The requesting information
	 * @param onSuccess The callback function to handle the returning data
	 * @param onError The callback function to handle the returning error
	 * @param useXHR Set to true to always use XHR, false to let system decides
	*/
	public static async sendAsync(request: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (this.canUseWebSocket(useXHR, false)) {
			this.send(request, onSuccess, onError, false);
		}
		else {
			try {
				const data = await this.send(request, undefined, undefined, true).toPromise();
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			}
			catch (error) {
				if (onError !== undefined) {
					onError(error);
				}
				else {
					console.error("[AppAPIs]: Error occurred while sending a request to APIs", error);
				}
			}
		}
	}

	/**
		* Sends a request to APIs using XMLHttpRequest with GET verb to fetch data
		* @param url Full URI of the end-point API's uri to perform the request
		* @param headers Additional headers to perform the request
	*/
	public static fetchAsync(url: string, headers?: any) {
		return this.sendXMLHttpRequestAsync("GET", url, headers);
	}

	/** Broadcasts a message to all subscribers */
	public static broadcast(message: AppMessage) {
		this._serviceScopeSubject.next({ "service": message.Type.Service, "message": message });
		if (AppUtility.isNotEmpty(message.Type.Object)) {
			this._objectScopeSubject.next({ "service": message.Type.Service, "object": message.Type.Object, "message": message });
		}
	}

}
