import { Subject, EMPTY as EmptyObservable } from "rxjs";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { AppConfig } from "@app/app.config";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";

/** Presents the struct of a message */
export interface AppMessage {
	Type: {
		Service: string;
		Object?: string;
		Event?: string;
	};
	Data: any;
}

/** Presents the struct of a requesting information */
export interface AppRequestInfo {
	Path?: string;
	ServiceName?: string;
	ObjectName?: string;
	Verb?: string;
	Header?: { [key: string]: string };
	Query?: { [key: string]: string };
	Extra?: { [key: string]: string };
	Body?: any;
}

/** Servicing component for working with APIs */
export class AppAPIs {

	private static _websocket: WebSocket;
	private static _websocketStatus: string;
	private static _websocketURL: string;
	private static _onWebSocketOpened: (event: Event) => void;
	private static _onWebSocketClosed: (event: CloseEvent) => void;
	private static _onWebSocketGotError: (event: Event) => void;
	private static _onWebSocketGotMessage: (event: MessageEvent) => void;
	private static _onResendWebSocketMessages: () => void;
	private static _messageTypes: { [key: string]: { Service: string; Object?: string; Event?: string; } } = {};
	private static _serviceScopeHandlers: { [key: string]: Array<{ func: (message: AppMessage) => void, identity: string }> } = {};
	private static _objectScopeHandlers: { [key: string]: Array<{ func: (message: AppMessage) => void, identity: string }> } = {};
	private static _serviceScopeSubject: Subject<{ service: string, message: AppMessage }>;
	private static _objectScopeSubject: Subject<{ service: string, object: string, message: AppMessage }>;
	private static _nocallbackMessages: { [id: string]: string } = {};
	private static _callbackableMessages: { [id: string]: string } = {};
	private static _successCallbacks: { [id: string]: (data?: any) => void } = {};
	private static _errorCallbacks: { [id: string]: (error?: any) => void } = {};
	private static _ping: number;
	private static _counter = 0;
	private static _attempt = 0;
	private static _resendID: string;
	private static _http: HttpClient;

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

	/** Gets state that determines the WebSocket connection is ready or not */
	public static get isWebSocketReady() {
		return this._websocket !== undefined && this._websocketStatus === "ready";
	}

	/** Gets the last time when got PING */
	public static get ping() {
		return this._ping;
	}

	/** Gets the HttpClient instance for working with XMLHttpRequest (XHR) */
	public static get http() {
		return this._http;
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
			AppUtility.getAttributes(data).forEach(name => {
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
		const uri = AppUtility.parseURI(path);
		const requestInfo = {
			ServiceName: uri.Paths[0],
			ObjectName: uri.Paths.length > 1 ? uri.Paths[1] : "",
			ObjectIdentity: undefined as string,
			Query: uri.QueryParams
		};
		if (uri.Paths.length > 2) {
			requestInfo.ObjectIdentity = requestInfo.Query["object-identity"] = uri.Paths[2];
		}
		return requestInfo;
	}

	private static parseMessageType(messageType: string) {
		let type = this._messageTypes[messageType];
		if (type === undefined) {
			let pos = messageType.indexOf("#"), object = "", event = "";
			const service = pos > 0 ? messageType.substring(0, pos) : messageType;
			if (pos > 0) {
				object = messageType.substring(pos + 1);
				pos = object.indexOf("#");
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
			this._messageTypes[messageType] = type;
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
	  * Registers a handler for processing updating messages at scope of an object
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
	public static openWebSocket(onOpened?: () => void, isReopenOrRestart: boolean = false) {
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
							console.error(`[AppAPIs]: Error occurred while running a handler (${handler.identity})`, error);
						}
					});
				},
				error => console.error(`[AppAPIs]: Got an error while processing data with handlers => ${AppUtility.getErrorMessage(error)}`, error)
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
							console.error(`[AppAPIs]: Error occurred while running a handler (${handler.identity})`, error);
						}
					});
				},
				error => console.error(`[AppAPIs]: Got an error while processing data with handlers => ${AppUtility.getErrorMessage(error)}`, error)
			);
		}

		// create new instance of WebSocket
		this._websocketStatus = "initializing";
		this._websocketURL = (AppUtility.isNotEmpty(AppConfig.URIs.updates) ? AppConfig.URIs.updates : AppConfig.URIs.apis).replace("http://", "ws://").replace("https://", "wss://");
		this._websocket = new WebSocket(`${this._websocketURL}v?x-session-id=${AppCrypto.base64urlEncode(AppConfig.session.id)}&x-device-id=${AppCrypto.base64urlEncode(AppConfig.session.device)}` + (isReopenOrRestart ? "&x-restart=" : ""));
		this._ping = +new Date();

		// assign 'on-open' event handler
		this._websocket.onopen = event => {
			this._websocketStatus = "ready";
			this.authenticateWebSocket();
			console.log(`[AppAPIs]: The WebSocket connection was opened... (${AppUtility.parseURI(this._websocketURL).HostURI})`, AppUtility.toIsoDateTime(new Date(), true));
			if (this._onWebSocketOpened !== undefined) {
				try {
					this._onWebSocketOpened(event);
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the 'on-open' handler", error);
				}
			}
		};

		// assign 'on-close' event handler
		this._websocket.onclose = event => {
			this._websocketStatus = "close";
			console.log(`[AppAPIs]: The WebSocket connection was closed [${event.reason}]`, AppUtility.toIsoDateTime(new Date(), true));
			if (this._onWebSocketClosed !== undefined) {
				try {
					this._onWebSocketClosed(event);
				}
				catch (error) {
					console.error("[AppAPIs]: Error occurred while running the 'on-close' handler", error);
				}
			}
			if (AppUtility.isNotEmpty(this._websocketURL) && 1007 !== event.code) {
				this.reopenWebSocket();
			}
		};

		// assign 'on-error' event handler
		this._websocket.onerror = event => {
			this._websocketStatus = "error";
			console.warn("[AppAPIs]: The WebSocket connection was got an error...", AppConfig.isDebug ? event : "");
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
			let msg: { ID: string; Type: string; Data: any; };
			try {
				msg = JSON.parse(event.data || "{}");
			}
			catch (error) {
				console.error("[AppAPIs]: Error occurred while parsing the message", error instanceof SyntaxError ? "" : error);
				const totalQueuedMessages = AppUtility.getAttributes(this._callbackableMessages).length;
				if (totalQueuedMessages > 0) {
					const defer = Math.round(1234 + totalQueuedMessages + (345 * totalQueuedMessages * Math.random()));
					if (AppConfig.isDebug) {
						console.log(`[AppAPIs]: Callbackable queue still got ${totalQueuedMessages} message(s) - resend in ${defer}ms`);
					}
					AppUtility.invoke(() => this.resendWebSocketMessages(), defer);
				}
				return;
			}

			// prepare
			const data = msg.Data || {};
			const gotID = AppUtility.isNotEmpty(msg.ID);
			const successCallback = gotID ? this._successCallbacks[msg.ID] : undefined;
			const errorCallback = gotID ? this._errorCallbacks[msg.ID] : undefined;
			if (gotID) {
				delete this._callbackableMessages[msg.ID];
				delete this._successCallbacks[msg.ID];
				delete this._errorCallbacks[msg.ID];
			}

			// got an error
			if ("Error" === msg.Type) {
				// got a security issue
				if (AppUtility.isGotSecurityException(data) && "UnauthorizedException" !== data.Type && "AccessDeniedException" !== data.Type) {
					console.warn(`[AppAPIs]: ${data.Type} (${data.Code}): ${data.Message}`, data);

					// the token is expired => re-open WebSocket to renew token and reauthenticate
					if ("TokenExpiredException" === data.Type) {
						this.reopenWebSocket("[AppAPIs]: Re-open WebSocket connection because the token is expired");
					}

					// need to terminate current session
					else {
						this.broadcast({
							Type: {
								Service: "Users",
								Object: "Session",
								Event: "Revoke"
							},
							Data: data
						});
					}
				}

				// got a callback on error
				else if (errorCallback !== undefined) {
					errorCallback(data);
				}

				// print the error when has no callback
				else {
					console.error(`[AppAPIs]: ${data.Type} (${data.Code}): ${data.Message}`, AppConfig.isDebug ? data : "");
				}
			}

			// got a callback on success
			else if (successCallback !== undefined) {
				successCallback(data);
			}

			// got a special message => broadcast or do a special action
			else {
				// prepare
				const messageType = this.parseMessageType(msg.Type);

				// knocking on heaven door
				if (messageType.Service === "Knock") {
					console.log("[AppAPIs]: Knock, Knock, Knock ... => Yes, I'm right here", AppUtility.toIsoDateTime(new Date(), true));
				}

				// send PONG
				else if (messageType.Service === "Ping") {
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Got a heartbeat signal => response with PONG", AppUtility.toIsoDateTime(new Date(), true));
					}
					this._ping = +new Date();
					this.sendWebSocketRequest({
						ServiceName: "Session",
						Verb: "PONG"
					});
				}

				// run schedulers
				else if (messageType.Service === "Scheduler") {
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Got a signal to run scheduler", AppUtility.toIsoDateTime(new Date(), true));
					}
					this.broadcast({ Type: { Service: "Scheduler" }, Data: data });
				}

				// refresh some data
				else if (messageType.Service === "Refresher") {
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Got a signal to refresh data", AppUtility.toIsoDateTime(new Date(), true));
					}
					this.broadcast({ Type: { Service: "Refresher" }, Data: data });
				}

				// broadcast the messags to all subscribers
				else if (!gotID) {
					const message: AppMessage = { Type: messageType, Data: data };
					if (AppConfig.isDebug) {
						console.log("[AppAPIs]: Got an updating message", AppConfig.isNativeApp ? AppCrypto.stringify(message) : message);
					}
					this.broadcast(message);
				}
			}

			// resend queued callbackable messages
			if (this._onResendWebSocketMessages !== undefined) {
				if (AppUtility.isGotData(this._callbackableMessages)) {
					AppUtility.invoke(() => (this._onResendWebSocketMessages || (() => {}))(), Math.round(1234 + (123 * Math.random())));
				}
				else {
					this._resendID = undefined;
					this._onResendWebSocketMessages = undefined;
				}
			}
		};

		// callback when done
		if (onOpened !== undefined) {
			AppUtility.invoke(onOpened, this.isWebSocketReady ? 13 : 567);
		}
	}

	private static destroyWebSocket() {
		if (this._websocket !== undefined) {
			this._websocket.close();
			this._websocket = undefined;
		}
	}

	/** Closes the WebSocket connection */
	public static closeWebSocket(onClosed?: () => void) {
		this.destroyWebSocket();
		this._websocketURL = undefined;
		this._websocketStatus = "close";
		if (onClosed !== undefined) {
			onClosed();
		}
	}

	/** Reopens the WebSocket connection */
	public static reopenWebSocket(reason?: string, defer?: number) {
		if (this._websocketStatus !== "restarting") {
			this.destroyWebSocket();
			this._websocketStatus = "restarting";
			this._attempt++;
			console.warn(`[AppAPIs]: ${reason || "Re-open because the WebSocket connection is broken"}`);
			AppUtility.invoke(() => {
				console.log(`[AppAPIs]: The WebSocket connection is re-opening... #${this._attempt}`);
				this.openWebSocket(() => {
					if (this.isWebSocketReady) {
						console.log(`[AppAPIs]: The WebSocket connection was re-opened... #${this._attempt}`);
						AppUtility.invoke(() => this._attempt = 0, 123);
					}
				}, true);
			}, defer || 123 + (this._attempt * 13));
		}
	}

	private static updateWebSocket(options?: { message?: string; resendCallbackMessages?: boolean } ) {
		// send all 'no callback' messages
		AppUtility.getAttributes(this._nocallbackMessages).sort().forEach(id => this._websocket.send(this._nocallbackMessages[id]));
		this._nocallbackMessages = {};

		// send the message
		if (options !== undefined && AppUtility.isNotEmpty(options.message)) {
			this._websocket.send(options.message);
		}

		// resend all 'callback' messages
		if (options !== undefined && options.resendCallbackMessages) {
			this.resendWebSocketMessages();
		}
	}

	private static canUseWebSocket(useXHR: boolean = false) {
		let can = !useXHR && this.isWebSocketReady;
		if (can && +new Date() - this.ping > 300000) {
			can = false;
			this.reopenWebSocket("[AppAPIs]: Ping period is too large...");
		}
		return can;
	}

	/** Sends a message to APIs to authenticate the WebSocket connection */
	public static authenticateWebSocket() {
		this._nocallbackMessages["0"] = AppCrypto.stringify({
			ServiceName: "Session",
			Verb: "AUTH",
			Header: {
				"x-session-id": AppCrypto.aesEncrypt(AppConfig.session.id),
				"x-device-id": AppCrypto.aesEncrypt(AppConfig.session.device)
			},
			Body: AppConfig.getAuthenticatedHeaders()
		});
		if (this.isWebSocketReady) {
			this.updateWebSocket({ resendCallbackMessages: true });
		}
	}

	private static resendWebSocketMessages() {
		this._onResendWebSocketMessages = undefined;
		const ids = AppUtility.getAttributes(this._callbackableMessages);
		const id = ids.sort().firstOrDefault();
		if (id !== undefined) {
			this._resendID = id;
			this._websocket.send(this._callbackableMessages[id]);
			if (ids.length > 1) {
				this._onResendWebSocketMessages = () => {
					if (this._resendID !== AppUtility.getAttributes(this._callbackableMessages).sort().firstOrDefault()) {
						this.resendWebSocketMessages();
					}
					else {
						this._resendID = undefined;
						this._onResendWebSocketMessages = undefined;
					}
				};
			}
		}
		else {
			this._resendID = undefined;
		}
	}

	/** Sends a message to APIs using WebSocket */
	public static sendWebSocketMessage(message: string) {
		if (this.isWebSocketReady && AppUtility.isNotEmpty(message)) {
			this._websocket.send(message);
		}
	}

	/**
		* Sends a request to APIs using WebSocket
		* @param request The requesting information
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
	*/
	public static sendWebSocketRequest(requestInfo: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		this._counter++;
		const id = AppUtility.right(`000000000${this._counter}`, 10);
		const request = {
			ServiceName: requestInfo.ServiceName,
			ObjectName: requestInfo.ObjectName || "",
			Verb: requestInfo.Verb || "GET",
			Header: requestInfo.Header || {},
			Query: requestInfo.Query || {},
			Extra: requestInfo.Extra || {},
			Body: requestInfo.Body || {}
		};
		const gotCallback = onSuccess !== undefined || onError !== undefined;
		if (gotCallback) {
			request["ID"] = id;
		}
		const message = AppCrypto.stringify(request);
		if (gotCallback) {
			this._callbackableMessages[id] = message;
			this._successCallbacks[id] = onSuccess;
			this._errorCallbacks[id] = onError;
		}
		if (this.isWebSocketReady) {
			this.updateWebSocket({ message: message });
		}
		else if (!gotCallback) {
			this._nocallbackMessages[id] = message;
		}
	}

	/**
		* Sends a request to APIs using XMLHttpRequest
		* @param verb The HTTP verb to perform the request
		* @param url The absolute URL of APIs to perform the request
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
		* @param verb The HTTP verb to perform the request
		* @param url The absolute URL of APIs to perform the request
		* @param headers Additional headers to perform the request
		* @param body The JSON object that contains the body to perform the request
	*/
	public static sendXMLHttpRequestAsync(verb: string, url: string, headers?: any, body?: any) {
		return AppUtility.toAsync(this.sendXMLHttpRequest(verb, url, { headers: this.getHeaders(headers) }, body));
	}

	/**
		* Sends a request to APIs
		* @param requestInfo The requesting information
		* @param useXHR Set to true to always use XHR, false to let system decides
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
	*/
	public static sendRequest(requestInfo: AppRequestInfo, useXHR: boolean = true, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		if (this.canUseWebSocket(useXHR)) {
			const request = AppUtility.isNotEmpty(requestInfo.Path) ? this.parseRequestInfo(requestInfo.Path) : undefined;
			const requestMsg = {
				ServiceName: request !== undefined ? request.ServiceName : requestInfo.ServiceName,
				ObjectName: request !== undefined ? request.ObjectName : requestInfo.ObjectName,
				Verb: requestInfo.Verb,
				Header: AppUtility.clone(requestInfo.Header || {}),
				Query: AppUtility.clone((request !== undefined ? request.Query : requestInfo.Query) || {}),
				Extra: requestInfo.Extra,
				Body: requestInfo.Body
			};
			["x-app-token", "x-app-name", "x-app-platform", "x-device-id", "x-session-id"].forEach(name => delete requestMsg.Header[name]);
			["service-name", "object-name"].forEach(name => delete requestMsg.Query[name]);
			if (request !== undefined && AppUtility.isNotEmpty(request.ObjectIdentity)) {
				requestMsg.Query["object-identity"] = request.ObjectIdentity;
			}
			this.sendWebSocketRequest(requestMsg, onSuccess, onError);
			return EmptyObservable;
		}
		else {
			let path = requestInfo.Path;
			if (AppUtility.isEmpty(path)) {
				let query = AppUtility.clone(requestInfo.Query || {});
				const objectIdentity = query["object-identity"];
				["service-name", "object-name", "object-identity"].forEach(name => delete query[name]);
				query = `?${AppUtility.toQuery(query)}`;
				path = `${requestInfo.ServiceName}${AppUtility.isNotEmpty(requestInfo.ObjectName) ? `/${requestInfo.ObjectName}` : ""}${AppUtility.isNotEmpty(objectIdentity) ? `/${objectIdentity}` : ""}${query === "?" ? "" : query}`;
			}
			path += requestInfo.Extra !== undefined ? (path.indexOf("?") > 0 ? "&" : "?") + `x-request-extra=${AppCrypto.jsonEncode(requestInfo.Extra)}` : "";
			return this.sendXMLHttpRequest(requestInfo.Verb, this.getURL(path), { headers: requestInfo.Header }, requestInfo.Body);
		}
	}

	/**
	 * Sends a request to APIs
	 * @param requestInfo The requesting information
	 * @param onSuccess The callback function to handle the returning data
	 * @param onError The callback function to handle the returning error
	 * @param useXHR Set to true to always use XHR, false to let system decides
	*/
	public static async sendRequestAsync(requestInfo: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		if (this.canUseWebSocket(useXHR)) {
			this.sendRequest(requestInfo, false, onSuccess, onError);
		}
		else {
			try {
				const data = await AppUtility.toAsync(this.sendRequest(requestInfo));
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

	/** Broadcasts a message to all subscribers */
	public static broadcast(message: AppMessage) {
		this._serviceScopeSubject.next({ "service": message.Type.Service, "message": message });
		if (AppUtility.isNotEmpty(message.Type.Object)) {
			this._objectScopeSubject.next({ "service": message.Type.Service, "object": message.Type.Object, "message": message });
		}
	}

}
