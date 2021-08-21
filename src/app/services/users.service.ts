import { Injectable } from "@angular/core";
import { DatePipe } from "@angular/common";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsControlConfig } from "@app/components/forms.objects";
import { Account } from "@app/models/account";
import { UserProfile } from "@app/models/user";
import { Privilege } from "@app/models/privileges";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { AppMessage, AppDataRequest } from "@app/components/app.objects";

@Injectable()
export class UsersService extends BaseService {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private datePipe: DatePipe
	) {
		super("Users");
		AppAPIs.registerAsServiceScopeProcessor(this.name, message => this.processUpdateMessage(message));
		AppAPIs.registerAsServiceScopeProcessor("Refresher", () => {
			if (this.configSvc.isAuthenticated) {
				AppUtility.invoke(() => Promise.all(this.configSvc.appConfig.services.all.map(service => service.name).map(service => this.getProfileAsync(this.configSvc.appConfig.session.account.id, () => AppEvents.broadcast("Profile", { Type: "Updated", Mode: "APIs" }), undefined, false, true, this.configSvc.appConfig.getRelatedQuery(service)))));
			}
		});
		AppEvents.on("App", info => {
			if (info.args.Type === "OptionsUpdated" && this.configSvc.isAuthenticated) {
				const profile = this.configSvc.getAccount().profile;
				if (profile !== undefined) {
					profile.Language = this.configSvc.appConfig.options.i18n;
					profile.Options = this.configSvc.appConfig.options;
					this.updateProfileAsync(profile, () => this.configSvc.storeSessionAsync());
				}
			}
		});
		AppEvents.on("Navigated", _ => {
			const profile = this.configSvc.getAccount().profile;
			if (profile !== undefined) {
				profile.LastAccess = new Date();
			}
			else if (this.configSvc.isAuthenticated) {
				AppUtility.invoke(() => this.getProfileAsync(undefined, () => {
					AppEvents.broadcast("Profile", { Type: "Updated", Mode: "APIs" });
					AppEvents.sendToElectron("Users", { Type: "Profile", Mode: "APIs", Data: this.configSvc.getAccount().profile });
				}, undefined, false, true), 456);
			}
		});
	}

	public get completerDataSource() {
		const convertToCompleterItem = (data: any) => {
			const profile = data === undefined
				? undefined
				: data instanceof UserProfile
					? data as UserProfile
					: UserProfile.deserialize(data);
			return profile === undefined
				? undefined
				: { title: profile.Name, description: profile.getEmail(!this.authSvc.isSystemAdministrator()), image: profile.avatarURI, originalObject: profile };
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("profile", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(obj => UserProfile.contains(obj.ID) ? convertToCompleterItem(UserProfile.get(obj.ID)) : convertToCompleterItem(UserProfile.update(UserProfile.deserialize(obj)))),
			convertToCompleterItem
		);
	}

	public searchProfiles(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("profile", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!UserProfile.contains(obj.ID)) {
							UserProfile.update(obj);
						}
					});
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError)
		);
	}

	public searchProfilesAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("profile", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(obj => {
						if (!UserProfile.contains(obj.ID)) {
							UserProfile.update(obj);
						}
					});
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError)
		);
	}

	public registerAsync(registerInfo: any, captcha: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("account", undefined, `uri=${this.configSvc.activateURL}&${this.configSvc.relatedQuery}`),
			AppUtility.clone(registerInfo, ["ConfirmEmail", "ConfirmPassword", "Captcha"], undefined, body => {
				body.Email = AppCrypto.rsaEncrypt(body.Email);
				body.Password = AppCrypto.rsaEncrypt(body.Password);
				body["ReferID"] = this.configSvc.appConfig.refer.id;
				body["ReferSection"] = this.configSvc.appConfig.refer.section;
			}),
			onSuccess,
			onError,
			this.configSvc.appConfig.getCaptchaInfo(captcha)
		);
	}

	public sendInvitationAsync(name: string, email: string, privileges?: Array<Privilege>, relatedInfo?: { [key: string]: any }, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const body = {
			Name: name,
			Email: AppCrypto.rsaEncrypt(email),
			Campaign: "InApp-Invitation",
			Medium: this.configSvc.appConfig.app.id
		};
		if (privileges !== undefined) {
			body["Privileges"] = AppCrypto.aesEncrypt(JSON.stringify(privileges));
		}
		if (relatedInfo !== undefined) {
			body["RelatedInfo"] = AppCrypto.aesEncrypt(JSON.stringify(relatedInfo));
		}
		return this.createAsync(
			this.getPath("account", "invite", `uri=${this.configSvc.activateURL}&${this.configSvc.relatedQuery}`),
			body,
			onSuccess,
			error => this.processError("Error occurred while sending an invitation", error, onError)
		);
	}

	public activateAsync(mode: string, code: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const uri = this.configSvc.appConfig.URIs.apis + this.getPath("activate", undefined, `mode=${mode}&code=${code}&${this.configSvc.relatedQuery}`);
		return this.readAsync(
			uri,
			async data => await this.configSvc.updateSessionAsync(data, () => {
				this.showLog("Activated...", this.configSvc.isDebug ? this.configSvc.appConfig.session : "");
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			}),
			error => this.showError(`Error occurred while activating (${mode})`, error, onError),
			undefined,
			true
		);
	}

	public getProfileAsync(id?: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, useXHR: boolean = false, force: boolean = false, relatedQuery?: string) {
		id = id || this.configSvc.getAccount().id;
		return !force && UserProfile.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("profile", id, relatedQuery || this.configSvc.relatedQuery),
					data => {
						UserProfile.update(data);
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while reading profile", error, onError),
					{ "x-app-idetity": this.configSvc.appConfig.app.id, "x-app-name": this.configSvc.appConfig.app.name },
					useXHR
				);
	}

	public updateProfileAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("profile", body.ID || this.configSvc.getAccount().id, this.configSvc.relatedQuery),
			body,
			data => {
				UserProfile.update(data);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating profile", error, onError)
		);
	}

	public updatePasswordAsync(password: string, newPassword: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("account", "password", this.configSvc.relatedQuery),
			{
				OldPassword: AppCrypto.rsaEncrypt(password),
				Password: AppCrypto.rsaEncrypt(newPassword)
			},
			onSuccess,
			error => this.processError("Error occurred while updating password", error, onError)
		);
	}

	public updateEmailAsync(password: string, newEmail: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("account", "email", this.configSvc.relatedQuery),
			{
				OldPassword: AppCrypto.rsaEncrypt(password),
				Email: AppCrypto.rsaEncrypt(newEmail)
			},
			onSuccess,
			error => this.processError("Error occurred while updating email", error, onError)
		);
	}

	public prepare2FAMethodAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void, query?: string) {
		return this.readAsync(
			this.getPath("otp", undefined, `${AppUtility.isNotEmpty(query) ? `${query}&` : ""}${this.configSvc.relatedQuery}`),
			onSuccess,
			error => this.processError("Error occurred while preparing an 2FA method", error, onError)
		);
	}

	public add2FAMethodAsync(password: string, provisioning: string, otp: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("otp", undefined, this.configSvc.relatedQuery),
			{
				Provisioning: provisioning,
				OTP: otp
			},
			data => this.configSvc.updateAccount(data, onSuccess),
			error => this.processError("Error occurred while adding an 2FA method", error, onError),
			{ "x-password": AppCrypto.rsaEncrypt(password) }
		);
	}

	public delete2FAMethodAsync(password: string, info: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteAsync(
			this.getPath("otp", undefined, `info=${info}&${this.configSvc.relatedQuery}`),
			data => this.configSvc.updateAccount(data, onSuccess),
			error => this.processError("Error occurred while deleting an 2FA method", error, onError),
			{ "x-password": AppCrypto.rsaEncrypt(password) }
		);
	}

	public getServicePrivilegesAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return Account.contains(id)
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("account", id, this.configSvc.relatedQuery),
					data => this.configSvc.updateAccount(data, onSuccess, true),
					error => this.processError("Error occurred while reading privileges", error, onError)
				);
	}

	public updateServicePrivilegesAsync(id: string, privileges: { [key: string]: Array<Privilege> }, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("account", id, this.configSvc.relatedQuery),
			{
				Privileges: AppCrypto.aesEncrypt(JSON.stringify(privileges))
			},
			data => this.configSvc.updateAccount(data, onSuccess, true),
			error => this.processError("Error occurred while updating privileges", error, onError)
		);
	}

	private processUpdateMessage(message: AppMessage) {
		const account = this.configSvc.getAccount();
		switch (message.Type.Object) {
			case "Session":
				switch (message.Type.Event) {
					case "Update":
						this.configSvc.updateSessionAsync(message.Data, () => {
							this.showLog("The session was updated with new access token", this.configSvc.appConfig.session);
							AppEvents.broadcast("Account", { Type: "Updated", Mode: "APIs" });
							AppEvents.sendToElectron("Users", { Type: "Session", Data: this.configSvc.appConfig.session });
						}, false, false);
						break;

					case "Revoke":
						if (AppUtility.isGotSecurityException(message.Data)) {
							this.showLog("Revoke the session and register new when got a security issue", this.configSvc.isDebug ? this.configSvc.appConfig.session : "");
							this.configSvc.resetSessionAsync(() => this.configSvc.initializeSessionAsync(() => this.configSvc.registerSessionAsync(() => AppAPIs.reopenWebSocket("Reopens when got a security issue"))), false);
						}
						else {
							this.configSvc.updateSessionAsync(message.Data, () => this.configSvc.registerSessionAsync(() => {
								this.showLog("The session was revoked by the APIs", this.configSvc.isDebug ? this.configSvc.appConfig.session : "");
								AppAPIs.reopenWebSocket("Reopens when the session was revoked by the APIs");
							}), false, false);
						}
						AppEvents.broadcast("Account", { Type: "Updated", Mode: "APIs" });
						AppEvents.broadcast("Profile", { Type: "Updated", Mode: "APIs" });
						AppEvents.sendToElectron("Users", { Type: "LogOut" });
						break;

					case "State":
						const userProfile = UserProfile.get(message.Data.UserID);
						if (userProfile !== undefined) {
							userProfile.IsOnline = message.Data.IsOnline ? true : this.configSvc.isAuthenticated && account.id === userProfile.ID ? true : false;
							userProfile.LastAccess = new Date();
							AppEvents.sendToElectron("Users", message);
						}
						break;

					default:
						this.showLog("Got an update of a session", message);
						break;
				}
				break;

			case "Account":
				this.configSvc.updateAccount(message.Data);
				if (this.configSvc.isAuthenticated && account.id === message.Data.ID) {
					AppEvents.broadcast("Account", { Type: "Updated", Mode: "APIs" });
					AppEvents.sendToElectron("Users", message);
				}
				break;

			case "Profile":
				UserProfile.update(message.Data);
				if (this.configSvc.isAuthenticated && account.id === message.Data.ID) {
					const profile = account.profile;
					profile.IsOnline = true;
					profile.LastAccess = new Date();
					if (this.configSvc.appConfig.options.i18n !== profile.Language) {
						this.configSvc.changeLanguageAsync(profile.Language);
					}
					this.configSvc.updateOptionsAsync(profile.Options).then(() => {
						AppEvents.broadcast("Profile", { Type: "Updated", Mode: "APIs" });
						AppEvents.sendToElectron("Users", { Type: "Profile", Mode: "APIs", Data: profile });
					});
					if (this.configSvc.appConfig.facebook.token !== undefined && this.configSvc.appConfig.facebook.id !== undefined) {
						this.configSvc.getFacebookProfile();
					}
					if (this.configSvc.appConfig.app.persistence) {
						this.configSvc.storeSessionAsync();
					}
				}
				break;

			default:
				this.showLog("Got an update of an user", message);
				break;
		}
	}

	public getAuditFormControl(created: Date, createdID: string, lastModified: Date, lastModifiedID: string, segment?: string, onCompleted?: (controlConfig: AppFormsControlConfig) => void) {
		const controlConfig: AppFormsControlConfig = {
			Name: "Audits",
			Type: "Text",
			Segment: segment,
			Options: {
				Label: "{{common.audits.label}}",
				Type: "label",
				OnAfterViewInit: async formControl => formControl.control.Extras["Text"] = await this.getAuditInfoAsync(created, createdID, lastModified, lastModifiedID)
			}
		};
		if (onCompleted !== undefined) {
			onCompleted(controlConfig);
		}
		return controlConfig;
	}

	public async getAuditInfoAsync(created: Date, createdID: string, lastModified: Date, lastModifiedID: string) {
		let creator = UserProfile.get(createdID);
		if (creator === undefined) {
			await this.getProfileAsync(createdID, _ => creator = UserProfile.get(createdID) || new UserProfile("Unknown"), _ => creator = new UserProfile("Unknown"), true);
		}
		let modifier = UserProfile.get(lastModifiedID);
		if (modifier === undefined) {
			await this.getProfileAsync(lastModifiedID, _ => modifier = UserProfile.get(lastModifiedID) || new UserProfile("Unknown"), _ => modifier = new UserProfile("Unknown"), true);
		}
		const params = {
			creator: creator.Name,
			creatorProfileURI: creator.routerURI,
			created: this.datePipe.transform(created, "h:mm a @ d/M/y"),
			modifier: modifier.Name,
			modifierProfileURI: modifier.routerURI,
			modified: this.datePipe.transform(lastModified, "h:mm a @ d/M/y")
		};
		return AppUtility.format(await this.configSvc.getResourceAsync("common.audits.info"), params);
	}

}
