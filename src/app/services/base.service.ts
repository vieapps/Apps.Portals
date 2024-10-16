import { Injectable } from "@angular/core";
import { Location } from "@angular/common";
import { Router, CanActivate } from "@angular/router";
import { AppConfig } from "@app/app.config";
import { AppAPIs } from "@app/components/app.apis";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppPagination } from "@app/components/app.pagination";
import { AppRequestInfo, AppMessage, AppDataRequest } from "@app/components/app.objects";

/** Base class of all services of the app */
export class Base {

	private _name = "";

	constructor(
		name?: string
	) {
		this._name = name;
	}

	/** Gets name of the service (for working with paginations as prefix, display logs/errors, ...) */
	get name() {
		return this._name;
	}

	/** Gets the headers that include the authenticated information */
	getHeaders(additional?: any, onCompleted?: (headers: { [key: string]: string }) => void) {
		return AppAPIs.getHeaders(additional, onCompleted);
	}

	/**
		* Gets the URI path for working with APIs
		* @param objectName The name of the object
		* @param objectIdentity The identity of the object
		* @param query The additional query
		* @param serviceName The name of the service
	*/
	protected getPath(objectName: string, objectIdentity?: string, query?: string, serviceName?: string) {
		return `${(serviceName || this.name).toLowerCase()}${AppUtility.isNotEmpty(objectName) ? `/${objectName.toLowerCase()}` : ""}` + (AppUtility.isNotEmpty(objectIdentity) ? `/${objectIdentity}` : "") + (AppUtility.isNotEmpty(query) ? `?${query}` : "");
	}

	/**
		* Gets the URI path for searching ('x-request' parameter was included in the query) with APIs
		* @param objectName The name of the object for searching
		* @param query The additional query
		* @param serviceName The name of the service
	*/
	protected getSearchingPath(objectName: string, query?: string, serviceName?: string) {
		return this.getPath(objectName, "search", "x-request={{request}}" + (AppUtility.isNotEmpty(query) ? `&${query}` : ""), serviceName);
	}

	/** Gets the message for working with console/log file */
	protected getMessage(message: string) {
		return `[${this.name}]: ${message}`;
	}

	/** Prints the log message to console/log file */
	protected showLog(message: string, ...optionalParams: any[]) {
		console.log(this.getMessage(message), optionalParams);
	}

	/** Prints the warning message to console/log file */
	protected showWarning(message: string, ...optionalParams: any[]) {
		console.log(this.getMessage(message), optionalParams);
	}

	/** Gets the error message to print to console/log file */
	protected getError(message: string, error?: any) {
		return this.getMessage(`${message}\n${AppUtility.getErrorMessage(error)}`);
	}

	/** Prints the error message to console/log file and run the next action */
	protected showError(message: string, error?: any, onNext?: (error?: any) => void) {
		console.error(this.getError(message, error), error);
		if (onNext !== undefined) {
			onNext(AppUtility.parseError(error));
		}
	}

	/** Process the error */
	protected processError(message: string, error?: any, onNext?: (error?: any) => void) {
		if (onNext !== undefined) {
			onNext(AppUtility.parseError(error));
		}
		else {
			this.showError(message, error);
		}
	}

	/**
		* Sends a request to APIs to perform an action of a specified service
		* @param requestInfo The requesting information
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param useXHR Set to true to always use XHR
	*/
	protected sendRequest(requestInfo: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		requestInfo.Header = this.getHeaders(requestInfo.Header);
		const subscription = useXHR
			? AppAPIs.sendRequest(requestInfo).subscribe(onSuccess, onError)
			: AppAPIs.sendRequest(requestInfo, false, onSuccess, onError).subscribe();
		if (!useXHR) {
			subscription.unsubscribe();
		}
		return subscription;
	}

	/**
		* Sends a request to APIs to perform an action of a specified service
		* @param requestInfo The requesting information
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param useXHR Set to true to always use XHR
	*/
	protected sendRequestAsync(requestInfo: AppRequestInfo, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false) {
		requestInfo.Header = this.getHeaders(requestInfo.Header);
		return AppAPIs.sendRequestAsync(requestInfo, onSuccess, onError, useXHR);
	}

	/**
		* Sends a request to APIs to search for instances (with GET verb and "x-request" of query parameter)
		* @param path The URI path (of the APIs) to send the request to
		* @param request The requesting information
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param dontProcessPagination Set to true to by-pass process pagination
		* @param headers The additional header
	*/
	protected search(path: string, request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, headers?: { [header: string]: string }) {
		return this.sendRequest(
			{
				Path: AppUtility.format(path, { request: AppCrypto.jsonEncode(request || {}) }),
				Verb: "GET",
				Header: headers
			},
			data => {
				if (AppUtility.isFalse(dontProcessPagination)) {
					const requestInfo = AppAPIs.parseRequestInfo(path);
					AppPagination.set(data, `${requestInfo.ObjectName}@${requestInfo.ServiceName}`.toLowerCase());
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError),
			true
		);
	}

	/**
		* Sends a request to APIs to search for instances (with GET verb and "x-request" of query parameter)
		* @param path The URI path (of the APIs) to send the request to
		* @param request The requesting information
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param dontProcessPagination Set to true to by-pass process pagination
		* @param headers The additional header
		* @param useXHR Set to true to always use XHR, false to let system decides
	*/
	protected async searchAsync(path: string, request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontProcessPagination: boolean = false, headers?: { [header: string]: string }, useXHR: boolean = false) {
		request = request || {};
		const processPagination = AppUtility.isFalse(dontProcessPagination);
		const requestInfo = processPagination ? AppAPIs.parseRequestInfo(path) : undefined;
		const paginationPrefix = processPagination ? `${requestInfo.ObjectName}@${requestInfo.ServiceName}`.toLowerCase() : undefined;
		const pagination = processPagination ? AppPagination.get(request, paginationPrefix) : undefined;
		const pageNumber = processPagination && request.Pagination !== undefined ? request.Pagination.PageNumber : pagination !== undefined ? pagination.PageNumber : 0;
		if (pagination !== undefined && (pageNumber < pagination.PageNumber || pagination.TotalPages <= pagination.PageNumber)) {
			await AppUtility.invoke(onSuccess);
		}
		else {
			if (request.Pagination !== undefined && request.Pagination.PageNumber !== undefined) {
				request.Pagination.PageNumber++;
			}
			await this.sendRequestAsync(
				{
					Path: AppUtility.format(path, { request: AppCrypto.jsonEncode(request) }),
					Verb: "GET",
					Header: headers
				},
				data => {
					if (processPagination) {
						AppPagination.set(data, paginationPrefix);
					}
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				},
				error => this.processError("Error occurred while searching", error, onError),
				useXHR
			);
		}
	}

	/**
		* Sends a request to APIs to create new an instance
		* @param path The URI path (of the APIs) to send the request to
		* @param body The JSON body to send the request
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param headers The additional headers to send the request
		* @param useXHR Set to true to always use XHR, false to let system decides
	*/
	protected createAsync(path: string, body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.sendRequestAsync(
			{
				Path: path,
				Verb: "POST",
				Header: headers,
				Body: body
			},
			onSuccess,
			error => this.processError("Error occurred while creating", error, onError),
			useXHR
		);
	}

	/**
		* Sends a request to APIs to read an instance
		* @param path The URI path (of the APIs) to send the request to
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param headers The additional headers to send the request
		* @param useXHR Set to true to always use XHR, false to let system decides
	*/
	protected readAsync(path: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.sendRequestAsync(
			{
				Path: path,
				Verb: "GET",
				Header: headers
			},
			onSuccess,
			error => this.processError("Error occurred while reading", error, onError),
			useXHR
		);
	}

	/**
		* Sends a request to APIs to update an instance
		* @param path The URI path (of the APIs) to send the request to
		* @param body The JSON body to send the request
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param headers The additional headers to send the request
		* @param useXHR Set to true to always use XHR, false to let system decides
	*/
	protected updateAsync(path: string, body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = false) {
		return this.sendRequestAsync(
			{
				Path: path,
				Verb: "PUT",
				Header: headers,
				Body: body
			},
			onSuccess,
			error => this.processError("Error occurred while updating", error, onError),
			useXHR
		);
	}

	/**
		* Sends a request to APIs to delete an instance
		* @param path The URI path (of the APIs) to send the request to
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param headers The additional headers to send the request
		* @param useXHR Set to true to always use XHR, false to let system decides
	*/
	protected deleteAsync(path: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }, useXHR: boolean = true) {
		return this.sendRequestAsync(
			{
				Path: path,
				Verb: "DELETE",
				Header: headers
			},
			onSuccess,
			error => this.processError("Error occurred while deleting", error, onError),
			useXHR
		);
	}

	/**
		* Sends a request to fetch data from APIs (using XHR with GET verb)
		* @param path The URI path (of the APIs) to send the request to
		* @param onSuccess The callback function to handle the returning data
		* @param onError The callback function to handle the returning error
		* @param headers The additional headers to send the request
	*/
	protected fetchAsync(path: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, headers?: { [header: string]: string }) {
		return this.readAsync(path, onSuccess, onError, headers, true);
	}

	/** Broadcasts a message to all subscribers */
	protected broadcast(message: AppMessage) {
		AppAPIs.broadcast(message);
	}

	/** Forwards a message to all subscribers (means broadcast to all subscribers) */
	protected forward(message: any, serviceName?: string, objectName?: string, event?: string) {
		this.broadcast({
			Type: {
				Service: serviceName || this.name,
				Object: objectName,
				Event: event
			},
			Data: message
		});
	}

}

@Injectable()
export class AppReadyGuardService implements CanActivate {

	constructor(
		private router: Router,
		private location: Location
	) {
	}

	canActivate() {
		if (!AppConfig.isReady) {
			AppConfig.URLs.redirectToWhenReady = AppCrypto.base64urlEncode(this.location.path());
			this.router.navigateByUrl(AppConfig.URLs.home);
		}
		return AppConfig.isReady;
	}

}

@Injectable()
export class AuthenticatedGuardService implements CanActivate {

	constructor(
		private router: Router,
		private location: Location
	) {
	}

	canActivate() {
		if (!AppConfig.isAuthenticated) {
			this.router.navigateByUrl(AppConfig.URLs.users.login + "?next=" + AppCrypto.base64urlEncode(this.location.path()));
		}
		return AppConfig.isAuthenticated;
	}

}

@Injectable()
export class NotAuthenticatedGuardService implements CanActivate {

	constructor(
		private router: Router
	) {
	}

	canActivate() {
		if (AppConfig.isAuthenticated) {
			this.router.navigateByUrl(AppConfig.URLs.home);
		}
		return !AppConfig.isAuthenticated;
	}

}

@Injectable()
export class RegisterGuardService implements CanActivate {

	constructor(
		private router: Router
	) {
	}

	canActivate() {
		if (!AppConfig.accounts.registrable) {
			this.router.navigateByUrl(AppConfig.URLs.home);
		}
		return AppConfig.accounts.registrable;
	}

}
