declare var RSA: any;
import * as CryptoJS from "crypto-js";

/** Servicing component for working with cryptography */
export class AppCrypto {

	private static _aes = {
		key: undefined,
		iv: undefined
	};
	private static _rsa = new RSA();
	private static _jwt: string;

	/** Stringifies an object to JSON string */
	public static stringify(obj: any, preProcess?: (obj: any) => void) {
		if (preProcess !== undefined) {
			preProcess(obj);
		}
		return JSON.stringify(obj || {}, (_, value) => typeof value === "undefined" ? null : value instanceof Set || value instanceof Map ? Array.from(value.entries()) : value);
	}

	/** Gets MD5 hash of the string */
	public static md5(text: string) {
		return CryptoJS.MD5(text).toString();
	}

	/** Gets MD5 hash of the object */
	public static hash(obj: any, preProcess?: (obj: any) => void) {
		return this.md5(this.stringify(obj, preProcess));
	}

	/** Signs the string with the specified key using HMAC SHA256 */
	public static sign(text: string, key: string, toBase64Url: boolean = true) {
		const signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(text, key));
		return toBase64Url ? this.toBase64Url(signature) : signature;
	}

	/** Convert base64 text to base64-url */
	public static toBase64Url(base64: string) {
		return base64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
	}

	/** Converts the base64-url text to base64 */
	public static toBase64(base64url: string) {
		let base64 = base64url.replace(/\-/g, "+").replace(/\_/g, "/");
		switch (base64.length % 4) {
			case 0:
				break;
			case 2:
				base64 += "==";
				break;
			case 3:
				base64 += "=";
				break;
			default:
				throw new Error("Base64-url string is not well-form");
		}
		return base64;
	}

	/** Encodes the plain text to base64 */
	public static base64Encode(text: string) {
		return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));
	}

	/** Decodes the base64 text */
	public static base64Decode(text: string) {
		return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text));
	}

	/** Encodes the plain text to base64-url */
	public static base64urlEncode(text: string) {
		return this.toBase64Url(this.base64Encode(text));
	}

	/** Decodes the base64-url text */
	public static base64urlDecode(base64url: string) {
		return this.base64Decode(this.toBase64(base64url));
	}

	/** Encodes the object to base64-url */
	public static jsonEncode(object: any) {
		return this.base64urlEncode(this.stringify(object || {}));
	}

	/** Decodes the object from base64-url */
	public static jsonDecode(base64url: string) {
		return JSON.parse(this.base64urlDecode(base64url));
	}

	/** Encodes the JSON Web Token */
	public static jwtEncode(jwt: any, key?: string, updateIssuedAt: boolean = true) {
		if (updateIssuedAt) {
			jwt.iat = Math.round(+new Date() / 1000);
		}
		const encoded = `${this.jsonEncode({ typ: "JWT", alg: "HS256" })}.${this.jsonEncode(jwt)}`;
		return `${encoded}.${this.sign(encoded, key || this._jwt)}`;
	}

	/** Decodes the JSON Web Token */
	public static jwtDecode(jwt: string, key?: string, verify: boolean = true) {
		const elements = jwt.split(".");
		return !verify || (elements.length > 2 && this.sign(`${elements[0]}.${elements[1]}`, key || this._jwt) === elements[2])
			? this.jsonDecode(elements[1])
			: undefined;
	}

	/** Encrypts the string - using AES */
	public static aesEncrypt(text: string, key?: any, iv?: any) {
		return CryptoJS.AES.encrypt(text, key || this._aes.key, { iv: iv || this._aes.iv }).toString();
	}

	/** Decrypts the string - using AES */
	public static aesDecrypt(text: string, key?: any, iv?: any) {
		return CryptoJS.AES.decrypt(text, key || this._aes.key, { iv: iv || this._aes.iv }).toString(CryptoJS.enc.Utf8);
	}

	/** Encrypts the string - using RSA */
	public static rsaEncrypt(text: string) {
		return this._rsa.encrypt(text) as string;
	}

	/** Decrypts the string - using RSA */
	public static rsaDecrypt(text: string) {
		return this._rsa.decrypt(text) as string;
	}

	/** Initializes all keys for encrypting/decrypting/signing */
	public static init(keys: { aes: { key: string; iv: string }; rsa: { encryptionExponent?: string; decryptionExponent?: string; exponent: string; modulus: string }; jwt: string; }) {
		if (keys.aes !== undefined) {
			this._aes.key = CryptoJS.enc.Hex.parse(keys.aes.key);
			this._aes.iv = CryptoJS.enc.Hex.parse(keys.aes.iv);
		}
		if (keys.rsa !== undefined) {
			this._rsa.init(keys.rsa.encryptionExponent || keys.rsa.exponent, keys.rsa.decryptionExponent || keys.rsa.exponent, keys.rsa.modulus);
		}
		if (keys.jwt !== undefined) {
			this._jwt = keys.jwt = keys.aes !== undefined ? this.aesDecrypt(keys.jwt) : keys.jwt;
		}
	}

}
