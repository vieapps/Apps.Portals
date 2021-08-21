import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";

@Component({
	selector: "page-users-login",
	templateUrl: "./login.page.html",
	styleUrls: ["./login.page.scss"]
})

export class UsersLogInPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
	) {
	}

	title = "Login";
	mode = "";
	login = {
		form: new FormGroup({}),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>,
		buttons: {
			login: {
				label: "Login",
				icon: undefined as string
			},
			register: {
				label: "Register",
				icon: undefined as string
			}
		}
	};
	otp = {
		providers: new Array<{ Info: string, Label: string, Time: Date, Type: string }>(),
		form: new FormGroup({}),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>,
		value: undefined as any,
		button: {
			label: "Verify",
			icon: undefined as string
		},
		subscription: undefined as Subscription
	};
	reset = {
		form: new FormGroup({}),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>,
		button: {
			label: "Forgot password",
			icon: "key"
		}
	};

	get color() {
		return this.configSvc.color;
	}

	get registrable() {
		return this.configSvc.appConfig.accounts.registrable;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	ngOnInit() {
		this.openLoginAsync();
	}

	ngOnDestroy() {
		if (this.otp.subscription !== undefined) {
			this.otp.subscription.unsubscribe();
		}
	}

	async openLoginAsync() {
		this.login.config = this.login.config || [
			{
				Name: "Account",
				Required: true,
				Options: {
					Type: this.configSvc.appConfig.accounts.phoneIsAllowed ? "text" : "email",
					Label: await this.configSvc.getResourceAsync(`users.login.login.controls.${this.configSvc.appConfig.accounts.phoneIsAllowed ? "Account" : "Email"}.label`),
					PlaceHolder: await this.configSvc.getResourceAsync(`users.login.login.controls.${this.configSvc.appConfig.accounts.phoneIsAllowed ? "Account" : "Email"}.placeholder`),
					MinLength: 1,
					MaxLength: 150,
					AutoFocus: true
				}
			},
			{
				Name: "Password",
				Required: true,
				Options: {
					Type: "password",
					Label: await this.configSvc.getResourceAsync("users.login.login.controls.Password"),
					MinLength: 1,
					MaxLength: 150,
					OnKeyUp: event => AppUtility.invoke(event.key === "Enter" ? () => this.logIn() : undefined)
				}
			}
		];
		if (this.configSvc.appConfig.isWebApp) {
			this.login.config.push({
				Name: "Persistence",
				Required: true,
				Type: "YesNo",
				Options: {
					Type: "toggle",
					Label: await this.configSvc.getResourceAsync("users.login.login.controls.SaveLogins")
				}
			});
		}
		this.login.buttons.login.label = await this.configSvc.getResourceAsync("users.login.login.buttons.login");
		this.login.buttons.register.label = await this.configSvc.getResourceAsync("users.login.login.buttons.register");
		this.reset.button.label = await this.configSvc.getResourceAsync("users.login.login.buttons.forgot");
		this.mode = "login";
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.login.login.title");
		this.trackAsync(this.title);
	}

	onLoginFormInitialized() {
		if (this.configSvc.appConfig.isWebApp) {
			this.login.form.patchValue({ Persistence: this.configSvc.appConfig.app.persistence });
		}
	}

	logIn() {
		if (this.appFormsSvc.validate(this.login.form)) {
			if (this.configSvc.appConfig.isWebApp) {
				this.configSvc.appConfig.app.persistence = this.login.form.value.Persistence;
				if (!this.configSvc.appConfig.app.persistence) {
					this.configSvc.deleteSessionAsync();
				}
			}
			this.appFormsSvc.showLoadingAsync(this.title).then(() => this.authSvc.logInAsync(
				this.login.form.value.Account,
				this.login.form.value.Password,
				data => this.trackAsync(this.title).then(() => this.appFormsSvc.hideLoadingAsync(() => data.Require2FA ? this.openLoginOTPAsync(data) : this.close())),
				error => this.trackAsync(this.title).then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.login.controls.find(ctrl => ctrl.Name === "Account").focus()))
			);
		}
	}

	async openLoginOTPAsync(data: any) {
		this.otp.providers = data.Providers;
		this.otp.value = {
			ID: data.ID,
			Provider: this.otp.providers.first().Info
		};
		this.otp.config = this.otp.config || [
			{
				Name: "ID",
				Hidden: true
			},
			{
				Name: "Provider",
				Type: "Select",
				Hidden: this.otp.providers.length < 2 && this.otp.providers.first(info => info.Type === "App") !== undefined,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.login.otp.controls.Provider"),
					SelectOptions: {
						Values: this.otp.providers.map(provider => {
							return {
								Value: provider.Info,
								Label: provider.Label
							};
						})
					},
					OnChanged: async (_, control) => {
						const provider = this.otp.providers.firstOrDefault(p => p.Info === control.value);
						if (provider !== undefined && provider.Type === "SMS") {
							this.requestOTP();
						}
						else {
							this.otp.controls.find(ctrl => AppUtility.isEquals(ctrl.Name, "OTP")).focus();
						}
					}
				}
			},
			{
				Name: "OTP",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.login.otp.controls.OTP.label"),
					Description: "",
					MinLength: 4,
					MaxLength: 12,
					AutoFocus: true
				}
			}
		];
		if (this.otp.subscription === undefined) {
			if (this.otp.providers.first(provider => provider.Type === "SMS")) {
				this.otp.config.find(ctrl => ctrl.Name === "Provider").Options.Icon = {
					Name: "chatbox-ellipses",
					Color: "secondary",
					Fill: "clear",
					Slot: "end",
					OnClick: (_, control) => {
						const provider = this.otp.providers.firstOrDefault(p => p.Info === control.value);
						if (provider !== undefined && provider.Type === "SMS") {
							this.requestOTP();
						}
						else {
							this.otp.controls.find(ctrl => ctrl.Name === "OTP").focus();
						}
					}
				};
			}
			this.otp.subscription = this.otp.form.valueChanges.subscribe(async value => {
				const provider = this.otp.providers.firstOrDefault(p => p.Info === value.Provider);
				this.otp.controls.find(ctrl => ctrl.Name === "OTP").Options.Description = provider.Type === "SMS"
					? await this.configSvc.getResourceAsync("users.login.otp.controls.OTP.description.sms")
					: await this.configSvc.getResourceAsync("users.login.otp.controls.OTP.description.app");
			});
		}
		this.mode = "otp";
		this.otp.button.label = await this.configSvc.getResourceAsync("users.login.otp.button");
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.login.otp.title");
		await this.trackAsync(this.title + " | OTP", this.configSvc.appConfig.URLs.users.otp, "Request", "Users:OTP");
	}

	requestOTP(control?: AppFormsControl, account?: string, provider?: string, query?: string, object?: string) {
		this.usersSvc.prepare2FAMethodAsync(
			() => {
				(control || this.otp.controls.find(ctrl => ctrl.Name === "OTP")).focus();
				this.trackAsync(`${this.title} | ${object || "OTP"}`, this.configSvc.appConfig.URLs.users.otp, "Request", "Users:OTP");
			},
			error => this.appFormsSvc.showErrorAsync(error).then(() => {
				(control || this.otp.controls.find(ctrl => ctrl.Name === "OTP")).focus();
				this.trackAsync(`${this.title} | ${object || "OTP"}`, this.configSvc.appConfig.URLs.users.otp, "Request", "Users:OTP");
			}),
			`x-sms-otp=${account || this.otp.form.value.ID}` + (AppUtility.isNotEmpty(query) ? "&" + query : "") + "&x-body=" + AppCrypto.jsonEncode({
				OtpType: AppCrypto.rsaEncrypt("SMS"),
				OtpPhone: AppCrypto.rsaEncrypt(provider || this.otp.form.value.Provider)
			})
		);
	}

	logInOTP() {
		if (this.appFormsSvc.validate(this.otp.form)) {
			this.appFormsSvc.showLoadingAsync(this.title).then(() => this.authSvc.logInOTPAsync(
				this.otp.form.value.ID,
				this.otp.form.value.Provider,
				this.otp.form.value.OTP,
				() => this.trackAsync(this.title + " | OTP", this.configSvc.appConfig.URLs.users.otp, "Validate", "Users:OTP").then(() => this.appFormsSvc.hideLoadingAsync(() => this.close())),
				error => this.appFormsSvc.showErrorAsync(error).then(() => {
					const control = this.otp.controls.find(ctrl => ctrl.Name === "OTP");
					control.controlRef.deleteValue();
					control.focus();
					this.trackAsync(this.title + " | OTP", this.configSvc.appConfig.URLs.users.otp, "Validate", "Users:OTP");
				})
			));
		}
	}

	async openResetPasswordAsync() {
		this.reset.config = this.reset.config || [
			{
				Name: "Account",
				Required: true,
				Options: {
					Type: this.configSvc.appConfig.accounts.phoneIsAllowed ? "text" : "email",
					Label: await this.configSvc.getResourceAsync(`users.login.login.controls.${this.configSvc.appConfig.accounts.phoneIsAllowed ? "Account" : "Email"}.label`),
					PlaceHolder: await this.configSvc.getResourceAsync(`users.login.login.controls.${this.configSvc.appConfig.accounts.phoneIsAllowed ? "Account" : "Email"}.placeholder`),
					MinLength: 1,
					MaxLength: 150,
					AutoFocus: true
				}
			},
			{
				Name: "OTP",
				Required: false,
				Hidden: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.login.reset.controls.Captcha.label"),
					Description: await this.configSvc.getResourceAsync("users.login.reset.controls.Captcha.sms"),
					MinLength: 4,
					MaxLength: 12,
					Icon: {
						Name: "chatbox-ellipses",
						Color: "secondary",
						Fill: "clear",
						Slot: "end",
						OnClick: () => {
							const account = this.reset.form.value.Account;
							if (AppUtility.isNotEmpty(account) && AppUtility.isPhone(account)) {
								this.requestOTP(this.reset.controls.find(ctrl => ctrl.Name === "OTP"), account, account, `x-sms-account=${AppCrypto.base64urlEncode(account)}`, "Reset");
							}
							else {
								this.reset.controls.find(ctrl => ctrl.Name === "Account").focus();
							}
						}
					}
				}
			},
			{
				Name: "Captcha",
				Required: false,
				Hidden: true,
				Type: "Captcha",
				Options: {
					Label: await this.configSvc.getResourceAsync("users.login.reset.controls.Captcha.label"),
					Description: await this.configSvc.getResourceAsync("users.login.reset.controls.Captcha.description"),
					MinLength: 4,
					MaxLength: 4
				}
			}
		];
		this.reset.button = {
			label: await this.configSvc.getResourceAsync("common.buttons.continue"),
			icon: undefined
		};
		this.mode = "reset";
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.login.reset.title");
		await this.trackAsync(this.title, `${this.configSvc.appConfig.URLs.users.root}/reset`, "Open", "Users:Password");
	}

	resetPassword() {
		const account = this.reset.form.value.Account;
		if (AppUtility.isEmpty(account)) {
			return;
		}

		if (this.configSvc.appConfig.accounts.phoneIsAllowed && AppUtility.isPhone(account)) {
			const control = this.reset.controls.find(ctrl => ctrl.Name === "OTP");
			const otp = this.reset.form.value.OTP;
			if (AppUtility.isEmpty(otp)) {
				if (control.Hidden) {
					control.Hidden = false;
					AppUtility.invoke(async () => this.reset.button.label = await this.configSvc.getResourceAsync("users.login.reset.button"));
					this.requestOTP(control, account, account, `x-sms-account=${AppCrypto.base64urlEncode(account)}`, "Reset");
				}
				control.focus(123);
			}
			else {
				this.appFormsSvc.showLoadingAsync(this.title).then(() => this.authSvc.renewPasswordAsync(
					account,
					otp,
					() => this.trackAsync(this.title, `${this.configSvc.appConfig.URLs.users.root}/reset`, "Reset", "Users:Password").then(async () => this.appFormsSvc.showAlertAsync(
						await this.configSvc.getResourceAsync("users.login.reset.title"),
						undefined,
						await this.configSvc.getResourceAsync("users.login.reset.messages.sms", { account: this.reset.form.value.Account }),
						() => this.openLoginAsync()
					)),
					error => this.appFormsSvc.showErrorAsync(error).then(() => {
						control.controlRef.deleteValue();
						control.focus(123);
						this.trackAsync(this.title, `${this.configSvc.appConfig.URLs.users.root}/reset`, "Reset", "Users:Password");
					})
				));
			}
		}

		else {
			const control = this.reset.controls.find(ctrl => ctrl.Name === "Captcha");
			const captcha = this.reset.form.value.Captcha;
			if (AppUtility.isEmpty(captcha)) {
				if (control.Hidden) {
					control.Hidden = false;
					AppUtility.invoke(async () => this.reset.button.label = await this.configSvc.getResourceAsync("users.login.reset.button"));
					this.refreshCaptcha();
				}
				control.focus(123);
			}
			else {
				this.appFormsSvc.showLoadingAsync(this.title).then(() => this.authSvc.resetPasswordAsync(
					account,
					captcha,
					() => this.trackAsync(this.title, `${this.configSvc.appConfig.URLs.users.root}/reset`, "Reset", "Users:Password").then(async () => this.appFormsSvc.showAlertAsync(
						await this.configSvc.getResourceAsync("users.login.reset.title"),
						undefined,
						await this.configSvc.getResourceAsync("users.login.reset.messages.account", { account: this.reset.form.value.Account }),
						() => this.close()
					)),
					error => this.trackAsync(this.title, `${this.configSvc.appConfig.URLs.users.root}/reset`, "Reset", "Users:Password").then(() => {
						this.refreshCaptcha();
						this.appFormsSvc.showErrorAsync(error, undefined, () => control.controlRef.deleteValue());
					}))
				);
			}
		}
	}

	onResetPasswordFormInitialized() {
		if (!this.reset.controls.find(ctrl => ctrl.Name === "Captcha").Hidden) {
			this.refreshCaptcha();
		}
		this.reset.form.patchValue({ Account: this.login.form.value.Account });
	}

	refreshCaptcha() {
		this.authSvc.registerCaptchaAsync(() => this.reset.controls.find(ctrl => ctrl.Name === "Captcha").captchaURI = this.configSvc.appConfig.session.captcha.uri);
	}

	onRefreshCaptcha() {
		this.refreshCaptcha();
	}

	close() {
		if (AppUtility.isNotEmpty(this.configSvc.queryParams["next"])) {
			try {
				this.configSvc.navigateHomeAsync(AppCrypto.base64urlDecode(this.configSvc.queryParams["next"]));
			}
			catch (error) {
				console.error("<Login>: Error occurred while redirecting", error);
				this.configSvc.navigateHomeAsync();
			}
		}
		else {
			if (this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.root)) {
				this.configSvc.navigateHomeAsync();
			}
			else {
				this.configSvc.navigateBackAsync();
			}
		}
	}

	register() {
		this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.users.register);
	}

	private trackAsync(title: string, url?: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: `Users - ${title}`, campaignUrl: url || this.configSvc.appConfig.URLs.users.login, category: category || "Users:Account", action: action || "LogIn" }, false);
	}

}
