import { Injectable } from "@angular/core";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { Account } from "@app/models/account";
import { Privileges } from "@app/models/privileges";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";

@Injectable()
export class AuthenticationService extends BaseService {

	constructor(
		private configSvc: ConfigurationService
	) {
		super("Authentication");
	}

	/**
	 * Determines the account is system administrator or not
	 * @param account The account to check (default is current logged in account)
	*/
	public isSystemAdministrator(account?: Account) {
		return (account || this.configSvc.getAccount()).isInRole("SystemAdministrator");
	}

	/**
	 * Determines the account is service administrator or not (can manage or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isServiceAdministrator(serviceName?: string, privileges?: Privileges, account?: Account) {
		return this.isAdministrator(serviceName, "", privileges, account);
	}

	/**
	 * Determines the account is service moderator or not (can manage or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isServiceModerator(serviceName?: string, privileges?: Privileges, account?: Account) {
		return this.isModerator(serviceName, "", privileges, account);
	}

	/**
	 * Determines the account is administrator or not (can manage or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isAdministrator(serviceName?: string, objectName?: string, privileges?: Privileges, account?: Account) {
		account = account || this.configSvc.getAccount();
		return this.isSystemAdministrator(account) || account.isAdministrator(serviceName || this.configSvc.appConfig.services.active, objectName, privileges);
	}

	/**
	 * Determines the account is moderator or not (can moderate or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isModerator(serviceName?: string, objectName?: string, privileges?: Privileges, account?: Account) {
		account = account || this.configSvc.getAccount();
		return this.isSystemAdministrator(account) || account.isModerator(serviceName || this.configSvc.appConfig.services.active, objectName, privileges);
	}

	/**
	 * Determines the account is editor or not (can edit or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isEditor(serviceName?: string, objectName?: string, privileges?: Privileges, account?: Account) {
		account = account || this.configSvc.getAccount();
		return this.isSystemAdministrator(account) || account.isEditor(serviceName || this.configSvc.appConfig.services.active, objectName, privileges);
	}

	/**
	 * Determines this account is contributor or not (can contribute or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isContributor(serviceName?: string, objectName?: string, privileges?: Privileges, account?: Account) {
		account = account || this.configSvc.getAccount();
		return this.isSystemAdministrator(account) || account.isContributor(serviceName || this.configSvc.appConfig.services.active, objectName, privileges);
	}

	/**
	 * Determines this account is viewer or not (can view or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isViewer(serviceName?: string, objectName?: string, privileges?: Privileges, account?: Account) {
		account = account || this.configSvc.getAccount();
		return this.isSystemAdministrator(account) || account.isViewer(serviceName || this.configSvc.appConfig.services.active, objectName, privileges);
	}

	/**
	 * Determines this account is downloader or not (can download or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 * @param account The account to check (default is current logged in account)
	 */
	public isDownloader(serviceName?: string, objectName?: string, privileges?: Privileges, account?: Account) {
		account = account || this.configSvc.getAccount();
		return this.isSystemAdministrator(account) || account.isDownloader(serviceName || this.configSvc.appConfig.services.active, objectName, privileges);
	}

	private canDo(role: string, serviceName?: string, account?: Account) {
		return AppUtility.isEquals("SystemAdministrator", role)
			? this.isSystemAdministrator(account)
			: AppUtility.isEquals("ServiceAdministrator", role)
				? this.isServiceAdministrator(serviceName, undefined, account)
				: AppUtility.isEquals("ServiceModerator", role)
					? this.isServiceModerator(serviceName, undefined, account)
					: AppUtility.isEquals("Authenticated", role)
						? this.configSvc.isAuthenticated
						: AppUtility.isEquals("All", role);
	}

	/** Checks to see the visitor can register new account or not */
	public get canRegisterNewAccounts() {
		return this.configSvc.appConfig.accountRegistrations.registrable;
	}

	/** Checks to see the user can send invitations or not */
	public get canSendInvitations() {
		return this.canDo(this.configSvc.appConfig.accountRegistrations.sendInvitationRole);
	}

	/** Checks to see the user can set privileges of current service or not */
	public get canSetServicePrivileges() {
		return this.configSvc.appConfig.accountRegistrations.setServicePrivilegs && this.canDo(this.configSvc.appConfig.accountRegistrations.setServicePrivilegsRole);
	}

	private async processErrorAsync(error: any, message: string, onNext?: (error?: any) => void) {
		if (AppUtility.isGotSecurityException(error)) {
			await this.configSvc.resetSessionAsync(async () =>
				await this.configSvc.initializeSessionAsync(async () =>
					await this.configSvc.registerSessionAsync(() => {
						this.showLog("Reregistered the session when got security issue");
						if (onNext !== undefined) {
							onNext(error);
						}
					})
				)
			);
		}
		else {
			this.processError(message, error, onNext);
		}
	}

	public async logInAsync(account: string, password: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.createAsync(
			this.getPath("session", undefined, this.configSvc.relatedQuery, "users"),
			{
				Account: AppCrypto.rsaEncrypt(account),
				Password: AppCrypto.rsaEncrypt(password)
			},
			async data => {
				if (AppUtility.isTrue(data.Require2FA)) {
					this.showLog("Log in with static password successful, but need to verify with 2FA", this.configSvc.isDebug ? data : "");
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				}
				else {
					this.showLog("Log in successful", this.configSvc.isDebug ? data : "");
					await this.updateSessionWhenLogInAsync(data, onSuccess);
				}
			},
			async error => await this.processErrorAsync(error, "Error occurred while logging in", onError),
			undefined,
			true
		);
	}

	public async logInOTPAsync(id: string, info: string, otp: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.updateAsync(
			this.getPath("session", undefined, this.configSvc.relatedQuery, "users"),
			{
				ID: AppCrypto.rsaEncrypt(id),
				Info: AppCrypto.rsaEncrypt(info),
				OTP: AppCrypto.rsaEncrypt(otp)
			},
			async data => {
				this.showLog("Log in with OTP successful");
				await this.updateSessionWhenLogInAsync(data, onSuccess);
			},
			async error => await this.processErrorAsync(error, "Error occurred while logging in with OTP", onError),
			undefined,
			true
		);
	}

	public async logOutAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.deleteAsync(
			this.getPath("session", undefined, this.configSvc.relatedQuery, "users"),
			async data => await this.configSvc.updateSessionAsync(data, async () => await this.configSvc.registerSessionAsync(() => {
				this.showLog("Log out successful", this.configSvc.isDebug ? data : "");
				AppEvents.broadcast("Account", { Type: "Updated" });
				AppEvents.broadcast("Profile", { Type: "Updated" });
				AppEvents.broadcast("Session", { Type: "LogOut" });
				AppEvents.sendToElectron("Users", { Type: "LogOut", Data: this.configSvc.appConfig.session });
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			}, onError), true),
			async error => await this.processErrorAsync(error, "Error occurred while logging out", onError),
			undefined,
			true
		);
	}

	public async resetPasswordAsync(account: string, captcha: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.updateAsync(
			this.getPath("account", "reset", `uri=${this.configSvc.activateURL}&${this.configSvc.relatedQuery}`, "users"),
			{
				Account: AppCrypto.rsaEncrypt(account)
			},
			onSuccess,
			async error => await this.processErrorAsync(error, "Error occurred while requesting new password", onError),
			this.configSvc.appConfig.getCaptchaHeaders(captcha)
		);
	}

	public async renewPasswordAsync(account: string, otp: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.updateAsync(
			this.getPath("account", "renew", this.configSvc.relatedQuery, "users"),
			{
				Account: AppCrypto.rsaEncrypt(account),
				OtpCode: AppCrypto.rsaEncrypt(otp)
			},
			onSuccess,
			async error => await this.processErrorAsync(error, "Error occurred while renewing password", onError)
		);
	}

	public async registerCaptchaAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.readAsync(
			this.getPath("captcha", undefined, `register=${this.configSvc.appConfig.session.id}&${this.configSvc.relatedQuery}`, "users"),
			data => {
				this.configSvc.appConfig.session.captcha = {
					code: data.Code,
					uri: data.Uri
				};
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while registering session captcha", error, onError)
		);
	}

	private async updateSessionWhenLogInAsync(data: any, onNext: (data?: any) => void) {
		await this.configSvc.updateSessionAsync(data, () => {
			AppEvents.broadcast("Session", { Type: "LogIn" });
			AppEvents.sendToElectron("Users", { Type: "LogIn", Data: this.configSvc.appConfig.session });
			if (onNext !== undefined) {
				onNext(data);
			}
		});
	}

}
