import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";

@Component({
	selector: "page-users-register",
	templateUrl: "./register.page.html",
	styleUrls: ["./register.page.scss"]
})

export class UsersRegisterPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
	) {
	}

	title = "Register new account";
	register = {
		form: new FormGroup({}, [this.appFormsSvc.areEquals("Email", "ConfirmEmail"), this.appFormsSvc.areEquals("Password", "ConfirmPassword")]),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>,
		button: {
			label: "Register",
			icon: undefined as string
		}
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.prepareAsync();
	}

	private async prepareAsync() {
		const config: Array<AppFormsControlConfig> = [
			{
				Name: "Email",
				Required: true,
				Options: {
					Type: "email",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Email"),
					MinLength: 1,
					MaxLength: 250,
					AutoFocus: true
				}
			},
			{
				Name: "ConfirmEmail",
				Required: true,
				Validators: [this.appFormsSvc.isEquals("Email")],
				Options: {
					Type: "email",
					Label: await this.configSvc.getResourceAsync("users.register.controls.ConfirmEmail"),
					MinLength: 1,
					MaxLength: 250
				}
			},
			{
				Name: "Password",
				Required: true,
				Options: {
					Type: "password",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Password"),
					MinLength: 1,
					MaxLength: 150
				}
			},
			{
				Name: "ConfirmPassword",
				Required: true,
				Validators: [this.appFormsSvc.isEquals("Password")],
				Options: {
					Type: "password",
					Label: await this.configSvc.getResourceAsync("users.register.controls.ConfirmPassword"),
					MinLength: 1,
					MaxLength: 150
				}
			},
			{
				Name: "Name",
				Required: true,
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Name.label"),
					Description: await this.configSvc.getResourceAsync("users.register.controls.Name.description"),
					MinLength: 1,
					MaxLength: 250
				}
			},
			{
				Name: "Gender",
				Type: "Select",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.Gender.label"),
					SelectOptions: {
						Values: ["NotProvided", "Male", "Female"].map(gender => {
							return {
								Value: gender,
								Label: `{{users.register.controls.Gender.options.${gender}}}`
							};
						})
					}
				}
			},
			{
				Name: "BirthDay",
				Type: "DatePicker",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.BirthDay"),
					MinValue: (new Date().getFullYear() - 100) + "-01-01",
					MaxValue: (new Date().getFullYear() - 16) + "-12-31",
					DatePickerOptions: {
						AllowTimes: false
					}
				}
			},
			{
				Name: "Address",
				Required: true,
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Address.label"),
					MinLength: 1,
					MaxLength: 250
				}
			},
			{
				Name: "Addresses",
				Type: "Lookup",
				Required: true,
				Options: {
					Type: "Address",
					PlaceHolder: await this.configSvc.getResourceAsync("users.register.controls.Address.placeholder"),
					MinLength: 2,
					MaxLength: 250
				}
			},
			{
				Name: "Mobile",
				Required: true,
				Options: {
					Type: "tel",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Mobile"),
					MinLength: 10,
					MaxLength: 15
				}
			},
			{
				Name: "Captcha",
				Type: "Captcha",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.login.reset.controls.Captcha.label"),
					Description: await this.configSvc.getResourceAsync("users.login.reset.controls.Captcha.description"),
					MinLength: 4,
					MaxLength: 4
				}
			}
		];

		config.forEach(options => {
			if (this.configSvc.appConfig.accounts.registration.hidden.indexOf(options.Name) > -1) {
				options.Hidden = true;
				options.Required = false;
			}
			else if (!options.Required && this.configSvc.appConfig.accounts.registration.required.indexOf(options.Name) > -1) {
				options.Required = true;
			}
		});

		this.register.button.label = await this.configSvc.getResourceAsync("users.register.button");
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.register.title");
		this.register.config = config;
		await this.trackAsync(this.title);
	}

	onFormInitialized() {
		this.refreshCaptchaAsync();
		this.register.form.patchValue({ Gender: "NotProvided" });
	}

	async registerAsync() {
		if (this.appFormsSvc.validate(this.register.form)) {
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.usersSvc.registerAsync(
				this.register.form.value,
				this.register.form.value.Captcha,
				async () => await Promise.all([
					this.trackAsync(this.title),
					this.appFormsSvc.showAlertAsync(
						await this.configSvc.getResourceAsync("users.register.alert.header"),
						undefined,
						await this.configSvc.getResourceAsync("users.register.alert.message", { email: this.register.form.value.Email }),
						async () => await (this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.root) ? this.configSvc.navigateRootAsync() : this.configSvc.navigateBackAsync())
					)
				]),
				async error => await Promise.all([
					this.trackAsync(this.title),
					this.refreshCaptchaAsync(),
					this.appFormsSvc.showErrorAsync(error, undefined, () => {
						if (AppUtility.isGotCaptchaException(error)) {
							this.register.controls.find(c => AppUtility.isEquals(c.Name, "Captcha")).controlRef.deleteValue();
						}
					})
				])
			);
		}
	}

	private refreshCaptchaAsync() {
		return this.authSvc.registerCaptchaAsync(() => this.register.controls.find(c => AppUtility.isEquals(c.Name, "Captcha")).captchaURI = this.configSvc.appConfig.session.captcha.uri);
	}

	onRefreshCaptcha() {
		this.refreshCaptchaAsync();
	}

	private async trackAsync(title: string) {
		await TrackingUtility.trackAsync({ title: `Users - ${title}`, campaignUrl: this.configSvc.appConfig.URLs.users.register, category: "Users:Account", action: "Register" }, false);
	}

}
