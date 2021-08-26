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
		return this.configSvc.appConfig.accounts.registrable;
	}

	/** Checks to see the user can send invitations or not */
	public get canSendInvitations() {
		return this.canDo(this.configSvc.appConfig.accounts.sendInvitationRole);
	}

	/** Checks to see the user can set privileges of current service or not */
	public get canSetServicePrivileges() {
		const account = this.configSvc.getAccount();
		if (account !== undefined) {
			if (this.configSvc.appConfig.accounts.setServicePrivilegs) {
				return this.canDo(this.configSvc.appConfig.accounts.setServicePrivilegsRole, this.configSvc.appConfig.services.active, account);
			}
			else {
				const service = this.configSvc.appConfig.services.all.first(svc => svc.name === this.configSvc.appConfig.services.active);
				return service !== undefined && AppUtility.isTrue(service.canSetPrivilegs) && this.canDo(this.configSvc.appConfig.accounts.setServicePrivilegsRole, service.name, account);
			}
		}
		return false;
	}

	protected processError(message: string, error: any, onNext?: (error?: any) => void) {
		error = AppUtility.parseError(error);
		if (AppUtility.isGotSecurityException(error) && "UnauthorizedException" !== error.Type && "AccessDeniedException" !== error.Type) {
			this.configSvc.resetSessionAsync(() =>
				this.configSvc.initializeSessionAsync(() =>
					this.configSvc.registerSessionAsync(() => {
						this.showLog("Reregistered the session when got security issue");
						if (onNext !== undefined) {
							onNext(error);
						}
					})
				)
			);
		}
		else {
			super.processError(message, error, onNext);
		}
	}

	public logInAsync(account: string, password: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("session", undefined, this.configSvc.relatedQuery, "users"),
			{
				Account: AppCrypto.rsaEncrypt(account),
				Password: AppCrypto.rsaEncrypt(password)
			},
			data => {
				if (AppUtility.isTrue(data.Require2FA)) {
					this.showLog("Log in with static password successful, but need to verify with 2FA", this.configSvc.isDebug ? data : "");
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				}
				else {
					this.showLog("Log in successful", this.configSvc.isDebug ? data : "");
					this.updateSessionWhenLogInAsync(data, onSuccess);
				}
			},
			error => this.processError("Error occurred while logging in", error, onError),
			undefined,
			true
		);
	}

	public logInOTPAsync(id: string, info: string, otp: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("session", undefined, this.configSvc.relatedQuery, "users"),
			{
				ID: AppCrypto.rsaEncrypt(id),
				Info: AppCrypto.rsaEncrypt(info),
				OTP: AppCrypto.rsaEncrypt(otp)
			},
			data => {
				this.showLog("Log in with OTP successful");
				this.updateSessionWhenLogInAsync(data, onSuccess);
			},
			error => this.processError("Error occurred while logging in with OTP", error, onError),
			undefined,
			true
		);
	}

	public logOutAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("session", undefined, this.configSvc.relatedQuery, "users"),
			data => this.configSvc.updateSessionAsync(data, () => this.configSvc.registerSessionAsync(() => {
				this.showLog("Log out successful", this.configSvc.isDebug ? data : "");
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
				AppEvents.broadcast("Account", { Type: "Updated", Mode: "Apps" });
				AppEvents.broadcast("Profile", { Type: "Updated", Mode: "Apps" });
				AppEvents.broadcast("Session", { Type: "LogOut" });
				AppEvents.sendToElectron("Users", { Type: "LogOut", Data: this.configSvc.appConfig.session });
			}, onError), true),
			error => this.processError("Error occurred while logging out", error, onError),
			undefined,
			true
		);
	}

	public resetPasswordAsync(account: string, captcha: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("account", "reset", `uri=${this.configSvc.activateURL}&${this.configSvc.relatedQuery}`, "users"),
			{
				Account: AppCrypto.rsaEncrypt(account)
			},
			onSuccess,
			error => this.processError("Error occurred while requesting new password", error, onError),
			this.configSvc.appConfig.getCaptchaInfo(captcha)
		);
	}

	public renewPasswordAsync(account: string, otp: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("account", "renew", this.configSvc.relatedQuery, "users"),
			{
				Account: AppCrypto.rsaEncrypt(account),
				OtpCode: AppCrypto.rsaEncrypt(otp)
			},
			onSuccess,
			error => this.processError("Error occurred while renewing password", error, onError)
		);
	}

	public registerCaptchaAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.readAsync(
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

	private updateSessionWhenLogInAsync(data: any, onNext: (data?: any) => void) {
		return AppUtility.invoke(onNext !== undefined ? () => onNext(data) : () => {}).then(() => this.configSvc.updateSessionAsync(data, () => {
			AppEvents.broadcast("Session", { Type: "LogIn" });
			AppEvents.sendToElectron("Users", { Type: "LogIn", Data: this.configSvc.appConfig.session });
		}));
	}

}
