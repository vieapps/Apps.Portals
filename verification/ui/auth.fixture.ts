import { ChangeDetectionStrategy, Component } from "@angular/core";
import { HttpClient, HttpErrorResponse, HttpResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";
import { AppConfig } from "@app/app.config";
import { AppAPIs } from "@app/components/app.apis";
import { AppCrypto } from "@app/components/app.crypto";
import { ConfigurationService } from "@app/services/configuration.service";
import { UsersService } from "@app/services/users.service";

export const authFixture = { scenario: "password", otpAttempts: 0, requests: [] as { method: string; path: string; fields: string[] }[] };
const signingKey = "non-secret-browser-fixture-key";
const aes = { key: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", iv: "101112131415161718191a1b1c1d1e1f" };

/** Installed only by the verification entry. Production services and encryption stay real. */
export async function installAuthFixtures(config: ConfigurationService, users: UsersService) {
	const keys = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
	const jwk = await crypto.subtle.exportKey("jwk", keys.privateKey);
	const hex = (value: string) => Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0).toString(16).padStart(2, "0")).join("");
	AppCrypto.init({ aes, rsa: undefined, jwt: undefined });
	const envelope = (uid = "") => ({
		ID: "fixture-session", DeviceID: "fixture-device",
		Keys: { JWT: AppCrypto.aesEncrypt(signingKey), AES: { Key: aes.key, IV: aes.iv }, RSA: { EncryptionExponent: hex(jwk.e), DecryptionExponent: hex(jwk.d), Modulus: hex(jwk.n) } },
		Token: AppCrypto.jwtEncode({ uid }, signingKey)
	});
	AppConfig.URIs.apis = AppConfig.URIs.ws = "https://fixture.invalid/";
	AppConfig.URIs.files = "https://fixture.invalid/files/";
	AppConfig.accounts.registrable = false;
	AppConfig.app.query.preferXHR = true;
	const peer = new HttpClient({ handle: request => {
		const url = new URL(request.url);
		if (url.hostname !== "fixture.invalid") throw new Error("Unexpected fixture API destination: " + url.origin);
		authFixture.requests.push({ method: request.method, path: url.pathname, fields: Object.keys(request.body || {}) });
		let body: any;
		if (url.pathname === "/users/session") {
			if (request.method === "POST") {
				if (authFixture.scenario === "password-error") return throwError(() => new HttpErrorResponse({ status: 400, error: { Type: "WrongAccountException", Message: "Fixture password rejected" } }));
				body = authFixture.scenario === "password" ? envelope("fixture-user") : {
					Require2FA: true, ID: "fixture-challenge", Providers: [
						{ Info: "fixture-app", Label: "Fixture authenticator", Type: "App" },
						...(authFixture.scenario === "sms" ? [{ Info: "+84900000000", Label: "Fixture SMS", Type: "SMS" }] : [])
					]
				};
			}
			else if (request.method === "PUT") {
				authFixture.otpAttempts++;
				if (authFixture.scenario === "otp-error" && authFixture.otpAttempts === 1) return throwError(() => new HttpErrorResponse({ status: 400, error: { Type: "OTPLoginFailedException", Message: "Bad OTP: fixture" } }));
				body = envelope("fixture-user");
			}
			else body = url.searchParams.has("register") ? {} : envelope();
		}
		else if (url.pathname === "/users/account") body = { ID: "fixture-user", Roles: ["All"] };
		else if (url.pathname === "/users/profile") body = { ID: "fixture-user", Name: "Fixture User", Email: "fixture@example.invalid", Language: AppConfig.options.i18n, Options: { ...AppConfig.options, extras: {} } };
		else if (url.pathname === "/users/otp") body = {};
		else throw new Error("Unexpected fixture API path: " + url.pathname);
		return of(new HttpResponse({ body }));
	} });
	// AppAPIs owns its client statically. Only this test entry replaces that peer; i18n keeps localhost XHR.
	(AppAPIs as any)._http = peer;
	users.initialize();
	await new Promise<void>((resolve, reject) => { config.initializeSessionAsync(() => resolve(), reject); });
}

@Component({
	selector: "verification-auth-chooser", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Authentication fixtures</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<ion-button (click)="start('password')">Password login fixture</ion-button>
			<ion-button (click)="start('app')">Authenticator fixture</ion-button>
			<ion-button (click)="start('sms')">SMS provider fixture</ion-button>
			<ion-button (click)="start('password-error')">Password failure fixture</ion-button>
			<ion-button (click)="start('otp-error')">OTP retry fixture</ion-button>
		</ion-content>`
})
export class AuthFixtureChooser {
	constructor(private config: ConfigurationService) {}
	async start(scenario: string) {
		authFixture.scenario = scenario; authFixture.otpAttempts = 0; authFixture.requests.length = 0;
		AppConfig.app.persistence = true;
		await new Promise<void>((resolve, reject) => { this.config.initializeSessionAsync(() => resolve(), reject); });
		await this.config.navigateForwardAsync("/users/login?next=" + AppCrypto.base64urlEncode("/__verification/auth-result"));
	}
}

@Component({
	selector: "verification-auth-result", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Authentication result</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding"><p data-testid="auth-result">{{ result | json }}</p>
			<ion-button (click)="again()">Return to auth fixtures</ion-button></ion-content>`
})
export class AuthFixtureResult {
	result = { authenticated: AppConfig.isAuthenticated, user: AppConfig.session.account?.id, profile: AppConfig.session.account?.profile?.Name, requests: authFixture.requests };
	constructor(private config: ConfigurationService) {}
	again() { return this.config.navigateRootAsync("/__verification/auth"); }
}
