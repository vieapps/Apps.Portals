import * as CryptoJS from "crypto-js";
import { RSA } from "@app/components/app.crypto.rsa";
import { AppUtility } from "@app/components/app.utility";

/** Servicing component for working with cryptography */
export class AppCrypto {

	private static _aes = { key: undefined as CryptoJS.lib.WordArray, iv: undefined as CryptoJS.lib.WordArray };
	private static _rsa = new RSA();
	private static _jwt: string;

	private static toBase64(base64url: string) {
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
				throw new Error("base64url string is not well-form");
		}
		return base64;
	}

	private static toBase64Url(base64: string) {
		return base64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
	}

	private static toHex(base64: string) {
		return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Base64.parse(base64));
	}

	/** Gets MD5 hash of the string */
	static md5(text: string) {
		return CryptoJS.MD5(text).toString();
	}

	/** Gets MD5 hash of the object */
	static hash(object: any) {
		return this.md5(AppUtility.stringify(object));
	}

	/** Signs the string with the specified key using HMAC SHA256 */
	static sign(text: string, key?: string | CryptoJS.lib.WordArray, asBase64Url: boolean = true) {
		const signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(text, key || this._jwt));
		return asBase64Url ? this.toBase64Url(signature) : signature;
	}

	/** Encodes the plain text to base64 */
	static base64Encode(text: string) {
		return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));
	}

	/** Decodes the base64 text */
	static base64Decode(text: string) {
		return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text));
	}

	/** Encodes the plain text to base64-url */
	static base64urlEncode(text: string) {
		return this.toBase64Url(this.base64Encode(text));
	}

	/** Decodes the base64-url text */
	static base64urlDecode(base64url: string) {
		return this.base64Decode(this.toBase64(base64url));
	}

	/** Encodes the object to base64-url */
	static jsonEncode(object: any) {
		return this.base64urlEncode(AppUtility.stringify(object));
	}

	/** Decodes the object from base64-url */
	static jsonDecode(base64url: string) {
		return AppUtility.parse(this.base64urlDecode(base64url));
	}

	/** Encodes the JSON Web Token */
	static jwtEncode(payload: any, key?: string | CryptoJS.lib.WordArray, updateIssuedAt: boolean = true) {
		if (updateIssuedAt) {
			payload.iat = Math.round(+new Date() / 1000);
		}
		const encoded = `${this.jsonEncode({ typ: "JWT", alg: "HS256" })}.${this.jsonEncode(payload)}`;
		return `${encoded}.${this.sign(encoded, key)}`;
	}

	/** Decodes the JSON Web Token */
	static jwtDecode(jwt: string, key?: string | CryptoJS.lib.WordArray, verify: boolean = true) {
		const elements = jwt.split(".");
		return !verify || (elements.length > 2 && this.sign(`${elements[0]}.${elements[1]}`, key) === elements[2])
			? this.jsonDecode(elements[1])
			: undefined;
	}

	/** Encrypts the string - using AES */
	static aesEncrypt(text: string, toHex: boolean = false) {
		const encrypted = CryptoJS.AES.encrypt(text, this._aes.key, { iv: this._aes.iv }).toString();
		return toHex ? this.toHex(encrypted) : encrypted;
	}

	/** Decrypts the string - using AES */
	static aesDecrypt(text: string) {
		return CryptoJS.AES.decrypt(text, this._aes.key, { iv: this._aes.iv }).toString(CryptoJS.enc.Utf8);
	}

	/** Encrypts the string - using RSA */
	static rsaEncrypt(text: string, toHex: boolean = false) {
		const encrypted = this._rsa.encrypt(text);
		return toHex ? this.toHex(encrypted) : encrypted;
	}

	/** Decrypts the string - using RSA */
	static rsaDecrypt(text: string) {
		return this._rsa.decrypt(text);
	}

	/** Initializes all keys for encrypting/decrypting/signing */
	static init(keys: { aes: { key: string; iv: string; isBase64?: boolean; }; rsa: { encryptionExponent?: string; decryptionExponent?: string; exponent: string; modulus: string; isBase64?: boolean; }; jwt: string; }) {
		if (AppUtility.isObject(keys.aes, true)) {
			this._aes.key = CryptoJS.enc.Hex.parse(AppUtility.isTrue(keys.aes.isBase64) ? this.toHex(keys.aes.key) : keys.aes.key);
			this._aes.iv = CryptoJS.enc.Hex.parse(AppUtility.isTrue(keys.aes.isBase64) ? this.toHex(keys.aes.iv) : keys.aes.iv);
		}
		if (AppUtility.isObject(keys.rsa, true)) {
			let encryptionExponent = keys.rsa.encryptionExponent || keys.rsa.exponent;
			let decryptionExponent = keys.rsa.decryptionExponent || keys.rsa.exponent;
			let modulus = keys.rsa.modulus;
			if (AppUtility.isTrue(keys.rsa.isBase64)) {
				encryptionExponent = this.toHex(encryptionExponent);
				decryptionExponent = this.toHex(decryptionExponent);
				modulus = this.toHex(modulus);
			}
			this._rsa.init(encryptionExponent, decryptionExponent, modulus);
		}
		if (AppUtility.isNotEmpty(keys.jwt)) {
			this._jwt = keys.jwt = AppUtility.isObject(keys.aes, true) ? this.aesDecrypt(keys.jwt) : keys.jwt;
		}
	}

}
