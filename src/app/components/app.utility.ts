import { HttpErrorResponse } from "@angular/common/http";
import { AppCrypto } from "@app/components/app.crypto";

/** Servicing component for working with app */
export class AppUtility {

	private static _exceptions: Array<string> = [
		"UnauthorizedException", "AccessDeniedException",
		"SessionNotFoundException", "SessionExpiredException", "SessionInformationRequiredException", "InvalidSessionException",
		"TokenNotFoundException", "TokenExpiredException", "TokenRevokedException", "InvalidTokenException", "InvalidTokenSignatureException"
	];

	/** Checks to see the object is boolean and equals to true */
	public static isTrue(obj?: any) {
		return obj !== undefined && typeof obj === "boolean" && obj === true;
	}

	/** Checks to see the object is boolean (or not defined) and equals to false */
	public static isFalse(obj?: any) {
		return obj === undefined || (typeof obj === "boolean" && obj === false);
	}

	/** Checks to see the object is really object or not */
	public static isObject(obj?: any, notNull?: boolean) {
		return obj !== undefined && typeof obj === "object" && (this.isTrue(notNull) ? obj !== null : true);
	}

	/** Checks to see the object is array or not */
	public static isArray(obj?: any, notNull?: boolean) {
		return obj !== undefined && Array.isArray(obj) && (this.isTrue(notNull) ? obj !== null : true);
	}

	/** Checks to see the object is date or not */
	public static isDate(obj?: any) {
		return obj !== undefined && obj instanceof Date;
	}

	/** Checks to see the object is null or not */
	public static isNull(obj?: any) {
		return obj === undefined || obj === null;
	}

	/** Checks to see the object is defined and null or not */
	public static isNotNull(obj?: any) {
		return obj !== undefined && obj !== null;
	}

	/** Checks to see the string is undefined or empty */
	public static isEmpty(obj?: any) {
		return this.isNull(obj) || (typeof obj === "string" && (obj as string).trim() === "");
	}

	/** Checks to see the string is defined and not empty */
	public static isNotEmpty(obj?: any) {
		return this.isNotNull(obj) && typeof obj === "string" && (obj as string).trim() !== "";
	}

	/** Compares two strings to see is equals or not */
	public static isEquals(str1: string, str2: string) {
		return this.isNotNull(str1) && this.isNotNull(str2) && str1.toLowerCase() === str2.toLowerCase();
	}

	/** Gets the position of the sub-string in the string */
	public static indexOf(str: string, substr: string, start?: number) {
		return this.isNotEmpty(str) && this.isNotEmpty(substr)
			? str.indexOf(substr, start)
			: -1;
	}

	/** Gets the state that determines the email address is valid or not */
	public static isValidEmail(email?: string) {
		const atPos = this.isNotEmpty(email) ? email.indexOf("@") : -1;
		const dotPos = this.isNotEmpty(email) ? email.indexOf(".", atPos + 1) : -1;
		return atPos > 0 && dotPos > atPos;
	}

	/** Gets the hidden email address for displaying at the public */
	public static getHiddenEmail(email: string) {
		return `${email.substr(0, email.indexOf("@") - 2)}**@**${email.substr(email.indexOf("@") + 3)}`;
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

	/** Gets the error message */
	public static getErrorMessage(error: any) {
		error = this.parseError(error);
		return this.isObject(error, true) && error.Type !== undefined && error.Message !== undefined
			? `Error: ${error.Message}\nType: ${error.Type}\nCorrelation ID: ${error.CorrelationID}`
			: error instanceof Error
				? error.message
				: `Unexpected error: ${error}`;
	}

	/** Checks the error to see that is security exception or not */
	public static isGotSecurityException(error?: any) {
		error = this.parseError(error);
		return this.isObject(error, true) && this.isNotEmpty(error.Type)
			? this._exceptions.find(e => e === error.Type) !== undefined
			: false;
	}

	/** Checks the error to see that is wrong account or password exception or not */
	public static isGotWrongAccountOrPasswordException(error?: any) {
		return this.isObject(error, true) && this.isNotEmpty(error.Type)
			? error.Type === "WrongAccountException"
			: false;
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

	/** Gets their own properties of an object */
	public static getProperties<T>(obj: T, onlyWritable: boolean = false) {
		const properties = new Array<{ name: string; info: PropertyDescriptor }>();
		const ownProperties = Object.getOwnPropertyDescriptors(obj);
		Object.keys(ownProperties).forEach(name => properties.push({
			name: name,
			info: ownProperties[name]
		}));
		return onlyWritable
			? properties.filter(property => property.info.writable)
			: properties;
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
				? JSON.parse(source)
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
	 * @param obj The instance of an object to process
	 * @param excluded The collection of excluded properties are not be deleted event value is undefined
	 * @param onCompleted The handler to run when cleaning process is completed
	*/
	public static clean<T>(obj: T, excluded?: Array<string>, onCompleted?: (obj: T) => void) {
		this.getProperties(obj).forEach(info => {
			if (this.isNull(obj[info.name])) {
				if (excluded === undefined || excluded.indexOf(info.name) < 0) {
					delete obj[info.name];
				}
			}
			else if (this.isObject(obj[info.name])) {
				this.clean(obj[info.name], excluded);
				if (this.getProperties(obj[info.name]).length < 1) {
					delete obj[info.name];
				}
			}
		});
		if (onCompleted !== undefined) {
			onCompleted(obj);
		}
		return obj;
	}

	/**
	 * Clones the object (means do stringify the source object and re-parse via JSON
	 * @param source The source object for cloning
	 * @param beRemovedOrCleanUndefined The array of attributes of the cloning object to be removed before returing or the boolean value to specified to clean undefined properties
	 * @param excluded The collection of excluded properties are not be deleted event value is undefined
	 * @param onCompleted The handler to run when process is completed
	*/
	public static clone<T>(source: T, beRemovedOrCleanUndefined?: Array<string> | boolean, excluded?: Array<string>, onCompleted?: (obj: any) => void) {
		// clone
		const exists = [];
		const obj = JSON.parse(JSON.stringify(source, (_, value) => {
			if (this.isObject(value, true)) {
				if (exists.indexOf(value) !== -1) {
					return;
				}
				exists.push(value);
			}
			return value;
		}));

		// remove the specified properties
		if (this.isArray(beRemovedOrCleanUndefined, true)) {
			(beRemovedOrCleanUndefined as Array<string>).forEach(name => delete obj[name]);
			if (onCompleted !== undefined) {
				onCompleted(obj);
			}
		}

		// clean undefined
		else if (this.isTrue(beRemovedOrCleanUndefined)) {
			this.clean(obj, excluded, onCompleted);
		}

		else if (onCompleted !== undefined) {
			onCompleted(obj);
		}

		// return clone object
		return obj;
	}

	/** Gets the query of JSON */
	public static getQueryOfJson(json: { [key: string]: any }) {
		try {
			return this.isObject(json, true)
				? this.toStr(Object.keys(json).map(name => `${name}=${encodeURIComponent(json[name])}`), "&")
				: "";
		}
		catch (error) {
			return "";
		}
	}

	/** Gets the JSON of a query param (means decode by Base64Url and parse to JSON) */
	public static getJsonOfQuery(value: string): { [key: string]: any } {
		try {
			return this.isNotEmpty(value)
				? JSON.parse(AppCrypto.urlDecode(value))
				: {};
		}
		catch (error) {
			return {};
		}
	}

	/** Gets the sub-sequence the sequence that ordering by the random scoring number */
	public static getTopScores<T>(sequence: Array<any>, amount?: number, converter?: (element: any) => T): T[] | any[] {
		const results = sequence.map(element => this.clone(element, undefined, undefined, obj => obj["Score"] = Math.random())).sortBy({ name: "Score", reverse: true }).take(amount);
		return converter === undefined
			? results
			: results.map(element => converter(element));
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

	/** Gets all the available characters (0 and A-Z) */
	public static getChars() {
		const chars = new Array<string>("0");
		for (let code = 65; code < 91; code++) {
			chars.push(String.fromCharCode(code));
		}
		return chars;
	}

	/** Parses the mustache-style (double braces) template to get the collection of params */
	public static parse(template: string) {
		return (template.match(/{{([^{}]*)}}/g) || []).map(param => {
			return {
				token: param,
				name: param.match(/[\w\.]+/)[0]
			};
		});
	}

	/** Formats the mustache-style (double braces) template with params */
	public static format(template: string, params: { [key: string]: any }) {
		const tokenParams = this.parse(template);
		Object.keys(params).forEach(key => {
			const value = (params[key] || "").toString() as string;
			tokenParams.filter(param => param.name === key).forEach(param => template = template.replace(this.toRegExp(`/${param.token}/g`), value));
		});
		return template;
	}

	/** Stringifys the JSON and encode as base64-url */
	public static toBase64Url(json: any) {
		return this.isObject(json, true)
			? AppCrypto.urlEncode(JSON.stringify(json, (_, value) => typeof value === "undefined" ? null : value))
			: "";
	}

	/** Converts the string/object to an array of strings/key-value pair/value of objects' properties */
	public static toArray(obj: any, separator?: any): Array<string> | Array<any> | Array<{ key: string, value: any }> {
		if (this.isArray(obj)) {
			return obj as Array<any>;
		}
		else if (obj instanceof Set) {
			return Array.from((obj as Set<any>).values());
		}
		else if (obj instanceof Map) {
			return Array.from((obj as Map<any, any>).values());
		}
		else if (this.isNotEmpty(obj)) {
			const array = this.indexOf(obj as string, this.isNotEmpty(separator) ? separator : ",") > 0
				? (obj as string).split(this.isNotEmpty(separator) ? separator : ",")
				: [obj as string];
			return array.map(element => this.isNotEmpty(element) ? element.trim() : "");
		}
		else if (this.isObject(obj, true)) {
			if (this.isTrue(separator)) {
				return Object.keys(obj).map(name => {
					return {
						key: name,
						value: obj[name]
					};
				});
			}
			else {
				return Object.keys(obj).map(name => obj[name]);
			}
		}
		else {
			return [obj];
		}
	}

	/** Converts and joins the array of objects to a string */
	public static toStr(array: Array<any>, separator?: string) {
		if (!this.isArray(array, true)) {
			return "";
		}
		let string = "";
		array.forEach(item => string += (string !== "" ? (separator || "") : "") + item.toString());
		return string;
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

/** Decorator of an extension method */
export function Extension(object: any) {
	let originalFunction: Function;
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		originalFunction = descriptor.value;
		object.prototype[propertyKey] = (...args) => originalFunction(this, ...args);
	};
}
