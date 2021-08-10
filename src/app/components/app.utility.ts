import { Observable } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";

/** Servicing component for working with app */
export class AppUtility {

	private static _exceptions = [
		"UnauthorizedException", "AccessDeniedException",
		"SessionNotFoundException", "SessionExpiredException", "SessionInformationRequiredException", "InvalidSessionException",
		"TokenNotFoundException", "TokenExpiredException", "TokenRevokedException", "InvalidTokenException", "InvalidTokenSignatureException"
	];

	/** Checks to see the object is boolean and equals to true */
	public static isTrue(object?: any) {
		return object !== undefined && typeof object === "boolean" && object === true;
	}

	/** Checks to see the object is boolean (or not defined) and equals to false */
	public static isFalse(object?: any) {
		return object === undefined || (typeof object === "boolean" && object === false);
	}

	/** Checks to see the object is really object or not */
	public static isObject(object?: any, notNull?: boolean) {
		return object !== undefined && typeof object === "object" && (this.isTrue(notNull) ? object !== null : true);
	}

	/** Checks to see the object is array or not */
	public static isArray(object?: any, notNull?: boolean) {
		return object !== undefined && Array.isArray(object) && (this.isTrue(notNull) ? object !== null : true);
	}

	/** Checks to see the object is date or not */
	public static isDate(object?: any) {
		return object !== undefined && object instanceof Date;
	}

	/** Gets the state that determines the email address is valid or not */
	public static isEmail(email?: string) {
		const regex = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
		return regex.test(String(email).trim().replace(/\s+/g, "").replace(/#/g, ""));
	}

	/** Gets the state that determines the phone number is valid or not */
	public static isPhone(phone?: string) {
		const regex = /^\s*(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\s*$/i;
		return regex.test(String(phone).trim().replace(/\s+/g, "").replace(/-/g, "").replace(/\./g, ""));
	}

	/** Checks to see the object is null or not */
	public static isNull(object?: any) {
		return object === undefined || object === null;
	}

	/** Checks to see the object is defined and null or not */
	public static isNotNull(object?: any) {
		return object !== undefined && object !== null;
	}

	/** Checks to see the string is undefined or empty */
	public static isEmpty(object?: any) {
		return this.isNull(object) || (typeof object === "string" && (object as string).trim() === "");
	}

	/** Checks to see the string is defined and not empty */
	public static isNotEmpty(object?: any) {
		return this.isNotNull(object) && typeof object === "string" && (object as string).trim() !== "";
	}

	/** Compares two strings to see is equals or not */
	public static isEquals(str1: string, str2: string) {
		return this.isNotNull(str1) && this.isNotNull(str2) && str1.toLowerCase() === str2.toLowerCase();
	}

	/** Gets the state to determines the working browser is Apple Safari */
	public static isAppleSafari(userAgent?: string) {
		userAgent = userAgent || navigator.userAgent;
		return userAgent.indexOf("Macintosh") > 0 && userAgent.indexOf("AppleWebKit") > 0 && userAgent.indexOf("Chrome") < 0 && userAgent.indexOf("Edge") < 0 && userAgent.indexOf("Edg") < 0;
	}

	/** Checks the error to see that is security exception or not */
	public static isGotSecurityException(error?: any) {
		error = this.parseError(error);
		return this.isObject(error, true) && this.isNotEmpty(error.Type)
			? this._exceptions.find(exception => exception === error.Type) !== undefined
			: false;
	}

	/** Checks the error to see that is wrong account or password exception or not */
	public static isGotWrongAccountOrPasswordException(error?: any) {
		return this.isObject(error, true) && "WrongAccountException" === error.Type;
	}

	/** Checks the error to see that is captcha exception or not */
	public static isGotCaptchaException(error?: any) {
		return this.isObject(error, true) && this.isNotEmpty(error.Type) && this.isNotEmpty(error.Message)
			? error.Message.indexOf("Captcha code is invalid") > -1
			: false;
	}

	/** Checks the error to see that is OTP exception or not */
	public static isGotOTPException(error?: any) {
		return this.isObject(error, true) && this.isNotEmpty(error.Type) && this.isNotEmpty(error.Message)
			? error.Type === "OTPLoginFailedException" && error.Message.indexOf("Bad OTP") > -1
			: false;
	}

	/** Gets the state to determines the object is got data or not (means the object has any attribute or not) */
	public static isGotData(object: any, length: number = 1) {
		return (this.isArray(object, true) ? object.length : object instanceof Set || object instanceof Map ? object.size : this.getAttributes(object).length) >= length;
	}

	/** Gets the error message */
	public static getErrorMessage(error: any) {
		error = this.parseError(error);
		return this.isObject(error, true) && error.Type !== undefined && error.Message !== undefined
			? `Error: ${error.Message}\nType: ${error.Type}\nCorrelation ID: ${error.CorrelationID}`
			: error instanceof Error
				? error.message
				: `Unexpected error: ${error}`;
	}

	/** Gets the collection of objects' attributes */
	public static getAttributes(object: any, predicate?: (name: string) => boolean) {
		return predicate !== undefined ? Object.keys(object || {}).filter(predicate) : Object.keys(object || {});
	}

	/** Gets their own properties of an object */
	public static getProperties<T>(object: T, onlyWritable: boolean = false) {
		const ownProperties = Object.getOwnPropertyDescriptors(object);
		const objProperties = this.getAttributes(ownProperties).map(name => ({
			name: name,
			info: ownProperties[name]
		}));
		return onlyWritable
			? objProperties.filter(property => property.info.writable)
			: objProperties;
	}

	/** Gets the sub-sequence the sequence that ordering by the random scoring number */
	public static getTopScores<T>(sequence: Array<any>, amount?: number, converter?: (element: any) => T): T[] | any[] {
		const results = sequence.map(element => this.clone(element, undefined, undefined, obj => obj["Score"] = Math.random())).sortBy({ name: "Score", reverse: true }).take(amount);
		return converter === undefined
			? results
			: results.map(element => converter(element));
	}

	/** Gets all the available characters (0 and A-Z) */
	public static getChars() {
		const chars = new Array<string>("0");
		for (let code = 65; code < 91; code++) {
			chars.push(String.fromCharCode(code));
		}
		return chars;
	}

	/** Parses the error */
	public static parseError(error: any) {
		try {
			return error instanceof HttpErrorResponse
				? error.error
				: "Error" === error.Type && error.Data !== undefined ? error.Data : error;
		}
		catch (e) {
			return error;
		}
	}

	/** Parses an URI */
	public static parseURI(uri?: string) {
		uri = uri || (location ? location.href : "scheme://service.as.host/path?query=#?hash=");

		let scheme = "http", host = "local", relativeURI = "";

		let pos = uri.indexOf("://");
		if (pos > -1 ) {
			scheme = uri.substr(0, pos);
			pos += 3;
			const end = uri.indexOf("/", pos);
			relativeURI = uri.substr(end);
			if (scheme !== "file") {
				host = uri.substr(pos, end - pos);
			}
		}
		else {
			relativeURI = uri;
		}

		let port = "";
		pos = host.indexOf(":");
		if (pos > 0) {
			port = host.substr(pos + 1);
			host = host.substr(0, pos);
		}

		let path = "", query = "", hash = "";
		pos = relativeURI.indexOf("?");
		if (pos > 0) {
			path = relativeURI.substr(0, pos);
			query = relativeURI.substr(pos + 1);
			let end = relativeURI.indexOf("#");
			if (end > 0 && end < pos) {
				hash = query;
				query = "";
			}
			else if (end > 0 && end > pos) {
				end = query.indexOf("#");
				hash = query.substr(end + 1);
				query = query.substr(0, end);
			}
		}
		else {
			path = relativeURI;
		}

		while (path.endsWith("?") || path.endsWith("&") || path.endsWith("#")) {
			path = path.substr(0, path.length - 1);
		}

		const queryParams = {} as { [key: string]: string };
		while (query.startsWith("?") || query.startsWith("&")) {
			query = query.substr(1);
		}
		if (query !== "") {
			query.split("&").forEach(param => {
				const params = param.split("=");
				queryParams[params[0]] = decodeURIComponent(params[1]);
			});
		}

		const hashParams = {} as { [key: string]: string };
		while (hash.startsWith("?") || hash.startsWith("&") || hash.startsWith("#")) {
			hash = hash.substr(1);
		}
		if (hash !== "") {
			hash.split("&").forEach(param => {
				const params = param.split("=");
				hashParams[params[0]] = decodeURIComponent(params[1]);
			});
		}

		return {
			AbsoluteURI: uri,
			RelativeURI: relativeURI,
			HostURI: scheme + "://" + host + (port !== "" ? ":" + port : ""),
			Scheme: scheme,
			Host: host,
			HostNames: AppUtility.toArray(host, ".") as Array<string>,
			Port: port,
			Path: path,
			Paths: AppUtility.toArray(path, "/") as Array<string>,
			Query: query,
			QueryParams: queryParams,
			Hash: hash,
			HashParams: hashParams
		};
	}

	/** Gets the position of the sub-string in the string */
	public static indexOf(str: string, substr: string, start?: number) {
		return this.isNotEmpty(str) && this.isNotEmpty(substr)
			? str.indexOf(substr, start)
			: -1;
	}

	/** Copies 'left' string */
	public static left(str: string, length: number) {
		return this.isNotEmpty(str) && str.length > length
			? str.substring(0, str.length - length)
			: str;
	}

	/** Copies 'right' string */
	public static right(str: string, length: number) {
		return this.isNotEmpty(str) && str.length > length
			? str.substring(str.length - length)
			: str;
	}

	/** Converts an object into a JSON string */
	public static stringify(object: any, replacer?: (key: string, value: any) => any) {
		return JSON.stringify(
			object || {},
			(key, value) => replacer !== undefined
				? replacer(key, value)
				: typeof value === "undefined" ? null : value instanceof Set || value instanceof Map ? Array.from(value.entries()) : value
		);
	}

	/** Converts a JSON string into an object */
	public static parse(json: string, reviver?: (key: string, value: any) => any) {
		return JSON.parse(
			json || "{}",
			(key, value) => reviver !== undefined
				? reviver(key, value)
				: value === null ? undefined : value
		);
	}

	/**
	 * Copys data from the source (object or JSON) into the objects" properties
	 * @param source The source to copy data from
	 * @param target The instance of an object to copy data into
	 * @param onCompleted The handler to run when the copy process is on-going completed with normalized data from source
	*/
	public static copy<T>(source: any, target: T, onCompleted?: (data: any) => void) {
		try {
			const data = this.isNotEmpty(source)
				? this.parse(source)
				: this.isObject(source, true)
					? source
					: {};

			this.getProperties(target, true).map(info => info.name).filter(name => typeof target[name] !== "function").forEach(name => {
				const value = data[name];
				target[name] = value === undefined || value === null
					? undefined
					: this.isDate(target[name]) ? new Date(value) : value;
			});

			if (onCompleted !== undefined) {
				onCompleted(data);
			}
			return target;
		}
		catch (error) {
			console.error(`[Utility]: Error occurred while copying object`, error);
			return target;
		}
	}

	/**
	 * Cleans undefined properties from the object
	 * @param object The instance of an object to process
	 * @param excluded The collection of excluded properties are not be deleted event value is undefined
	 * @param onCompleted The handler to run when cleaning process is completed
	*/
	public static clean<T>(object: T, excluded?: Array<string>, onCompleted?: (object: T) => void) {
		this.getProperties(object).forEach(info => {
			if (this.isNull(object[info.name])) {
				if (excluded === undefined || excluded.indexOf(info.name) < 0) {
					delete object[info.name];
				}
			}
			else if (this.isObject(object[info.name])) {
				this.clean(object[info.name], excluded);
				if (this.getProperties(object[info.name]).length < 1) {
					delete object[info.name];
				}
			}
		});
		if (onCompleted !== undefined) {
			onCompleted(object);
		}
		return object;
	}

	/**
	 * Clones the object (means do stringify the source object and re-parse via JSON
	 * @param source The source object for cloning
	 * @param beRemovedOrCleanUndefined The array of attributes of the cloning object to be removed before returing or the boolean value to specified to clean undefined properties
	 * @param excluded The collection of excluded properties are not be deleted event value is undefined
	 * @param onCompleted The handler to run when process is completed
	*/
	public static clone<T>(source: T, beRemovedOrCleanUndefined?: Array<string> | boolean, excluded?: Array<string>, onCompleted?: (object: any) => void) {
		// clone
		const object = this.parse(this.stringify(source));

		// remove the specified properties
		if (this.isArray(beRemovedOrCleanUndefined, true)) {
			(beRemovedOrCleanUndefined as Array<string>).forEach(name => delete object[name]);
			if (onCompleted !== undefined) {
				onCompleted(object);
			}
		}

		// clean undefined
		else if (this.isTrue(beRemovedOrCleanUndefined)) {
			this.clean(object, excluded, onCompleted);
		}

		else if (onCompleted !== undefined) {
			onCompleted(object);
		}

		// return clone object
		return object;
	}

	/** Removes tags from the HTML content */
	public static removeTags(html: string, keepTags?: string[]) {
		if (this.isNotEmpty(html)) {
			(keepTags || []).forEach(tag => {
				html = html.replace(this.toRegExp("/\\<" + tag + "\\>/gi"), `[${tag}]`);
				html = html.replace(this.toRegExp("/\\<\\/" + tag + "\\>/gi"), `[/${tag}]`);
			});
			html = html.replace(/(<([^>]+)>)/gi, "");
			(keepTags || []).forEach(tag => {
				html = html.replace(this.toRegExp("/\\[" + tag + "\\]/gi"), `<${tag}>`);
				html = html.replace(this.toRegExp("/\\[\\/" + tag + "\\]/gi"), `</${tag}>`);
			});
		}
		return html || "";
	}

	/** Normalizes the HTML content */
	public static normalizeHtml(html?: string, removeTags?: boolean) {
		const wellHtml = this.isNotEmpty(html)
			? this.isTrue(removeTags)
				? this.removeTags(html)
				: html
			: "";
		return wellHtml !== ""
			? wellHtml.replace(/\&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/\t/g, "").replace(/\r/g, "").replace(/\n/g, "<br/>")
			: "";
	}

	/** Formats the mustache-style (double braces) template with params */
	public static format(template: string, params: { [key: string]: any }) {
		const parameters = (template.match(/{{([^{}]*)}}/g) || []).map(param => ({ token: param, name: param.match(/[\w\.]+/)[0] }));
		this.getAttributes(params).forEach(key => {
			const value: string = (params[key] || "").toString();
			parameters.filter(parameter => parameter.name === key).forEach(parameter => template = template.replace(this.toRegExp(`/${parameter.token}/g`), value));
		});
		return template;
	}

	/** Invokes an action by 'setTimeout' */
	public static invoke(action: () => void, defer?: number) {
		setTimeout(() => action(), defer || 0);
	}

	/** Converts an observable object to promise object for working with async/await */
	public static toAsync<T>(observable: Observable<T>) {
		return observable.toPromise();
	}

	/** Converts the objects' properties to array of key-value pair */
	public static toKeyValuePair(object: any, predicate?: (kvp: { key: string; value: any; }) => boolean) {
		let keyvaluePairs = new Array<{ key: string; value: any; }>();
		if (this.isArray(object, true)) {
			keyvaluePairs = (object as Array<{ key: any; value: any; }>).filter(kvp => AppUtility.isObject(kvp, true) && AppUtility.isNotNull(kvp.key)).map(kvp => ({ key: kvp.key.toString(), value: kvp.value}));
		}
		else if (object instanceof Set) {
			object.forEach(kvp => keyvaluePairs.push({ key: kvp !== undefined ? kvp.key : undefined, value: kvp !== undefined ? kvp.value : undefined }));
			keyvaluePairs = keyvaluePairs.filter(kvp => kvp.key !== undefined).map(kvp => ({ key: kvp.key.toString(), value: kvp.value }));
		}
		else if (object instanceof Map) {
			object.forEach((value, key) => keyvaluePairs.push({ key: key.toString(), value: value }));
		}
		else if (this.isObject(object, true)) {
			keyvaluePairs = this.getAttributes(object).map(attribute => ({ key: attribute, value: object[attribute] }));
		}
		return predicate !== undefined ? keyvaluePairs.filter(predicate) : keyvaluePairs;
	}

	/** Converts the string/object to an array of strings/key-value pair/value of objects' properties */
	public static toArray(object: any, separator?: any): Array<string> | Array<any> | Array<{ key: string, value: any }> {
		if (this.isArray(object)) {
			return object as Array<any>;
		}
		else if (object instanceof Set || object instanceof Map) {
			return Array.from(object.values());
		}
		else if (this.isNotEmpty(object)) {
			const array = this.indexOf(object as string, this.isNotEmpty(separator) ? separator : ",") > 0
				? (object as string).split(this.isNotEmpty(separator) ? separator : ",")
				: [object as string];
			return array.map(element => this.isNotEmpty(element) ? element.trim() : "");
		}
		else if (this.isObject(object, true)) {
			return this.isTrue(separator)
				? this.toKeyValuePair(object)
				: this.getAttributes(object).map(name => object[name]);
		}
		else {
			return [object];
		}
	}

	/** Converts and joins the array of objects to a string */
	public static toStr(array: Array<any>, separator?: string) {
		let string = "";
		if (this.isArray(array, true)) {
			separator = separator || "";
			array.forEach(item => string += (string !== "" ? separator : "") + (item || "").toString());
		}
		return string;
	}

	/** Converts the object to query string */
	public static toQuery(object: any) {
		try {
			return this.toStr(this.toKeyValuePair(object).map(kvp => `${kvp.key}=${encodeURIComponent((kvp.value || "").toString())}`), "&");
		}
		catch (error) {
			return "";
		}
	}

	/** Converts object to integer */
	public static toInt(value: any) {
		return this.isNotEmpty(value)
			? parseInt(value, 0)
			: 0;
	}

	/** Converts the regular expression string to RegExp object */
	public static toRegExp(regex: string) {
		const flags = regex.replace(/.*\/([gimy]*)$/, "$1");
		const pattern = regex.replace(new RegExp("^/(.*?)/" + flags + "$"), "$1");
		return new RegExp(pattern, flags);
	}

	/**
	 * Converts date-time object to ISO 8601 date time string to use with date-picker
	 * @param date the date value to convert
	 * @param seconds true to include the value of seconds
	 * @param miliseconds true to include the value of mili-seconds
	 * @param useLocalTimezone true to use local time zone
	*/
	public static toIsoDateTime(date: string | number | Date, seconds: boolean = false, miliseconds: boolean = false, useLocalTimezone: boolean = true) {
		if (date === undefined || date === null) {
			return undefined;
		}
		const datetime = new Date(date);
		if (isNaN(datetime.getTime())) {
			return undefined;
		}
		if (useLocalTimezone) {
			const timeOffsetInHours = (datetime.getTimezoneOffset() / 60) * (-1);
			datetime.setHours(datetime.getHours() + timeOffsetInHours);
		}
		let isoDateTime = datetime.toJSON().replace("Z", "");
		if (miliseconds) {
			return isoDateTime;
		}
		isoDateTime = isoDateTime.substr(0, 19);
		return seconds ? isoDateTime : isoDateTime.substr(0, 16);
	}

	/** Converts date-time object to ISO 8601 date string to use with date-picker */
	public static toIsoDate(date: string | number | Date) {
		const isoDateTime = date === undefined || "-" === date
			? undefined
			: this.toIsoDateTime(date, true, true);
		return isoDateTime !== undefined ? isoDateTime.substr(0, 10) : undefined;
	}

	/** Converts the ANSI string to a string that can use in an URI */
	public static toURI(input?: string): string {
		if (!this.isNotEmpty(input) || input.trim() === "") {
			return "";
		}

		let result = input.trim();
		result = result.replace(/\s/g, "-").replace(/\&/g, "").replace(/\?/g, "");
		result = result.replace(/\+/g, "").replace(/\//g, "-").replace(/\'/g, "");
		result = result.replace(/\\/g, "-").replace(/\=/g, "").replace(/\,/g, "").replace(/\./g, "-");
		result = result.replace(/\(/g, "").replace(/\)/g, "").replace(/\#/g, "").replace(/\%/g, "");
		result = result.replace(/\`/g, "").replace(/\!/g, "").replace(/\@/g, "").replace(/\$/g, "");
		result = result.replace(/\>/g, "").replace(/\</g, "").replace(/\{/g, "").replace(/\}/g, "");
		result = result.replace(/\[/g, "").replace(/\]/g, "").replace(/\*/g, "").replace(/\^/g, "");
		result = result.replace(/\:/g, "").replace(/\;/g, "").replace(/\|/g, "").replace(/\"/g, "");
		result = result.replace(/\_\-\_/g, "-").replace(/\-\_\-/g, "-").replace(/\-\-\-/g, "-").replace(/\-\-/g, "-");
		return result.toLowerCase();
	}

	/** Converts the Vietnamese string to ANSI string */
	public static toANSI(input?: string, asURI?: boolean): string {
		if (!this.isNotEmpty(input) || input.trim() === "") {
			return "";
		}

		let result = input.trim();

		// a A
		result = result.replace(/\u00E1/g, "a");
		result = result.replace(/\u00C1/g, "A");
		result = result.replace(/\u00E0/g, "a");
		result = result.replace(/\u00C0/g, "A");
		result = result.replace(/\u1EA3/g, "a");
		result = result.replace(/\u1EA2/g, "A");
		result = result.replace(/\u00E3/g, "a");
		result = result.replace(/\u00C3/g, "A");
		result = result.replace(/\u1EA1/g, "a");
		result = result.replace(/\u1EA0/g, "A");

		result = result.replace(/\u0103/g, "a");
		result = result.replace(/\u0102/g, "A");
		result = result.replace(/\u1EAF/g, "a");
		result = result.replace(/\u1EAE/g, "A");
		result = result.replace(/\u1EB1/g, "a");
		result = result.replace(/\u1EB0/g, "A");
		result = result.replace(/\u1EB3/g, "a");
		result = result.replace(/\u1EB2/g, "A");
		result = result.replace(/\u1EB5/g, "a");
		result = result.replace(/\u1EB4/g, "A");
		result = result.replace(/\u1EB7/g, "a");
		result = result.replace(/\u1EB6/g, "A");

		result = result.replace(/\u00E2/g, "a");
		result = result.replace(/\u00C2/g, "A");
		result = result.replace(/\u1EA5/g, "a");
		result = result.replace(/\u1EA4/g, "A");
		result = result.replace(/\u1EA7/g, "a");
		result = result.replace(/\u1EA6/g, "A");
		result = result.replace(/\u1EA9/g, "a");
		result = result.replace(/\u1EA8/g, "A");
		result = result.replace(/\u1EAB/g, "a");
		result = result.replace(/\u1EAA/g, "A");
		result = result.replace(/\u1EAD/g, "a");
		result = result.replace(/\u1EAC/g, "A");

		// e E
		result = result.replace(/\u00E9/g, "e");
		result = result.replace(/\u00C9/g, "E");
		result = result.replace(/\u00E8/g, "e");
		result = result.replace(/\u00C8/g, "E");
		result = result.replace(/\u1EBB/g, "e");
		result = result.replace(/\u1EBA/g, "E");
		result = result.replace(/\u1EBD/g, "e");
		result = result.replace(/\u1EBC/g, "E");
		result = result.replace(/\u1EB9/g, "e");
		result = result.replace(/\u1EB8/g, "E");

		result = result.replace(/\u00EA/g, "e");
		result = result.replace(/\u00CA/g, "E");
		result = result.replace(/\u1EBF/g, "e");
		result = result.replace(/\u1EBE/g, "E");
		result = result.replace(/\u1EC1/g, "e");
		result = result.replace(/\u1EC0/g, "E");
		result = result.replace(/\u1EC3/g, "e");
		result = result.replace(/\u1EC2/g, "E");
		result = result.replace(/\u1EC5/g, "e");
		result = result.replace(/\u1EC4/g, "E");
		result = result.replace(/\u1EC7/g, "e");
		result = result.replace(/\u1EC6/g, "E");

		// i I
		result = result.replace(/\u00ED/g, "i");
		result = result.replace(/\u00CD/g, "I");
		result = result.replace(/\u00EC/g, "i");
		result = result.replace(/\u00CC/g, "I");
		result = result.replace(/\u1EC9/g, "i");
		result = result.replace(/\u1EC8/g, "I");
		result = result.replace(/\u0129/g, "i");
		result = result.replace(/\u0128/g, "I");
		result = result.replace(/\u1ECB/g, "i");
		result = result.replace(/\u1ECA/g, "I");

		// o O
		result = result.replace(/\u00F3/g, "o");
		result = result.replace(/\u00D3/g, "O");
		result = result.replace(/\u00F2/g, "o");
		result = result.replace(/\u00D2/g, "O");
		result = result.replace(/\u1ECF/g, "o");
		result = result.replace(/\u1ECE/g, "O");
		result = result.replace(/\u00F5/g, "o");
		result = result.replace(/\u00D5/g, "O");
		result = result.replace(/\u1ECD/g, "o");
		result = result.replace(/\u1ECC/g, "O");

		result = result.replace(/\u01A1/g, "o");
		result = result.replace(/\u01A0/g, "O");
		result = result.replace(/\u1EDB/g, "o");
		result = result.replace(/\u1EDA/g, "O");
		result = result.replace(/\u1EDD/g, "o");
		result = result.replace(/\u1EDC/g, "O");
		result = result.replace(/\u1EDF/g, "o");
		result = result.replace(/\u1EDE/g, "O");
		result = result.replace(/\u1EE1/g, "o");
		result = result.replace(/\u1EE0/g, "O");
		result = result.replace(/\u1EE3/g, "o");
		result = result.replace(/\u1EE2/g, "O");

		result = result.replace(/\u00F4/g, "o");
		result = result.replace(/\u00D4/g, "O");
		result = result.replace(/\u1ED1/g, "o");
		result = result.replace(/\u1ED0/g, "O");
		result = result.replace(/\u1ED3/g, "o");
		result = result.replace(/\u1ED2/g, "O");
		result = result.replace(/\u1ED5/g, "o");
		result = result.replace(/\u1ED4/g, "O");
		result = result.replace(/\u1ED7/g, "o");
		result = result.replace(/\u1ED6/g, "O");
		result = result.replace(/\u1ED9/g, "o");
		result = result.replace(/\u1ED8/g, "O");

		// u U
		result = result.replace(/\u00FA/g, "u");
		result = result.replace(/\u00DA/g, "U");
		result = result.replace(/\u00F9/g, "u");
		result = result.replace(/\u00D9/g, "U");
		result = result.replace(/\u1EE7/g, "u");
		result = result.replace(/\u1EE6/g, "U");
		result = result.replace(/\u0169/g, "u");
		result = result.replace(/\u0168/g, "U");
		result = result.replace(/\u1EE5/g, "u");
		result = result.replace(/\u1EE4/g, "U");

		result = result.replace(/\u01B0/g, "u");
		result = result.replace(/\u01AF/g, "U");
		result = result.replace(/\u1EE9/g, "u");
		result = result.replace(/\u1EE8/g, "U");
		result = result.replace(/\u1EEB/g, "u");
		result = result.replace(/\u1EEA/g, "U");
		result = result.replace(/\u1EED/g, "u");
		result = result.replace(/\u1EEC/g, "U");
		result = result.replace(/\u1EEF/g, "u");
		result = result.replace(/\u1EEE/g, "U");
		result = result.replace(/\u1EF1/g, "u");
		result = result.replace(/\u1EF0/g, "U");

		// y Y
		result = result.replace(/\u00FD/g, "y");
		result = result.replace(/\u00DD/g, "Y");
		result = result.replace(/\u1EF3/g, "y");
		result = result.replace(/\u1EF2/g, "Y");
		result = result.replace(/\u1EF7/g, "y");
		result = result.replace(/\u1EF6/g, "Y");
		result = result.replace(/\u1EF9/g, "y");
		result = result.replace(/\u1EF8/g, "Y");
		result = result.replace(/\u1EF5/g, "y");
		result = result.replace(/\u1EF4/g, "Y");

		// d D
		result = result.replace(/\u00D0/g, "D");
		result = result.replace(/\u0110/g, "D");
		result = result.replace(/\u0111/g, "d");

		// spaces
		result = result.replace(/\s\s+/g, " ");

		return this.isTrue(asURI)
			? this.toURI(result)
			: result.trim();
	}

}
