import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsComponent } from "@app/components/forms.component";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { UserProfile } from "@app/models/user";
import { Account } from "@app/models/account";
import { Privilege } from "@app/models/privileges";

@Component({
	selector: "page-users-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class UsersUpdatePage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
	) {
	}

	title = "Update profile";
	mode = "";
	id: string;
	profile: UserProfile;
	buttons = {
		ok: undefined as {
			text: string;
			icon?: string;
			handler: () => void
		},
		cancel: undefined as {
			text: string;
			icon?: string;
			handler: () => void
		}
	};
	update = {
		form: new FormGroup({}),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>,
		hash: undefined as string,
		language: this.configSvc.appConfig.language,
		darkTheme: AppUtility.isEquals("dark", this.configSvc.color)
	};
	password = {
		form: new FormGroup({}, [this.appFormsSvc.areEquals("Password", "ConfirmPassword")]),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>
	};
	email = {
		form: new FormGroup({}, [this.appFormsSvc.areEquals("Email", "ConfirmEmail")]),
		controls: new Array<AppFormsControl>(),
		config: undefined as Array<AppFormsControlConfig>
	};

	services: Array<string>;
	private servicePrivileges = {
		privileges: {} as { [key: string]: Array<Privilege> },
		hash: ""
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.prepareAsync();
	}

	private prepareAsync() {
		const id = this.configSvc.requestParams["ID"] || this.configSvc.getAccount().id;
		return this.usersSvc.getProfileAsync(
			id,
			async () => {
				this.profile = UserProfile.get(id);
				if (this.profile === undefined || (this.profile.ID !== this.configSvc.getAccount().id && !this.authSvc.isSystemAdministrator())) {
					await Promise.all([
						this.appFormsSvc.showToastAsync("Hmmm..."),
						this.configSvc.navigateRootAsync()
					]);
				}
				else {
					this.mode = this.configSvc.requestParams["Mode"] || "profile";
					switch (this.mode) {
						case "password":
							await this.openUpdatePasswordAsync();
							break;
						case "email":
							await this.openUpdateEmailAsync();
							break;
						case "privileges":
							await this.openUpdateServicePrivilegesAsync();
							break;
						default:
							await this.openUpdateProfileAsync();
							break;
					}
				}
			},
			async error => await this.appFormsSvc.showErrorAsync(error)
		);
	}

	onFormInitialized(event: AppFormsComponent) {
		if (this.update.config === event.config) {
			this.update.form.patchValue(this.profile);
			if (this.update.form.controls !== undefined && this.update.form.controls.DarkTheme !== undefined) {
				this.update.form.controls.DarkTheme.setValue(this.update.darkTheme);
			}
			this.update.hash = AppCrypto.hash(this.update.form.value);
		}
	}

	async prepareButtonsAsync() {
		this.buttons.cancel = { text: await this.configSvc.getResourceAsync("common.buttons.cancel"), handler: async () => await this.showProfileAsync() };
		this.buttons.ok = { text: await this.configSvc.getResourceAsync("common.buttons.update"), handler: undefined };

		if (this.mode === "profile") {
			this.buttons.cancel.handler = async () => await this.appFormsSvc.showAlertAsync(
				await this.configSvc.getResourceAsync("users.profile.update.messages.alert"),
				undefined,
				await this.configSvc.getResourceAsync("users.profile.update.messages.confirm"),
				async () => await this.showProfileAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
			this.buttons.ok.handler = async () => await this.updateProfileAsync();
		}
		else if (this.mode === "password") {
			this.buttons.ok.text = await this.configSvc.getResourceAsync("users.profile.buttons.password");
			this.buttons.ok.handler = async () => await this.updatePasswordAsync();
		}
		else if (this.mode === "email") {
			this.buttons.ok.text = await this.configSvc.getResourceAsync("users.profile.buttons.email");
			this.buttons.ok.handler = async () => await this.updateEmailAsync();
		}
		else if (this.mode === "privileges") {
			this.buttons.ok.handler = async () => await this.updateServicePrivilegesAsync();
		}
		else {
			this.buttons.cancel = undefined;
			this.buttons.ok = undefined;
		}
	}

	async openUpdateProfileAsync() {
		const config: Array<AppFormsControlConfig> = [
			{
				Name: "ID",
				Hidden: true
			},
			{
				Name: "Name",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.Name.label"),
					Description: await this.configSvc.getResourceAsync("users.register.controls.Name.description"),
					MinLength: 1,
					MaxLength: 250,
					AutoFocus: true
				}
			},
			{
				Name: "Gender",
				Type: "Select",
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
				Options: {
					Type: "date",
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
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.Address.label"),
					MinLength: 1,
					MaxLength: 250
				}
			},
			{
				Name: "Addresses",
				Type: "Lookup",
				Options: {
					Type: "Address",
					PlaceHolder: await this.configSvc.getResourceAsync("users.register.controls.Address.placeholder"),
					MinLength: 2,
					LookupOptions: {
						Multiple: false,
						AsModal: false,
						AsCompleter: true
					}
				}
			},
			{
				Name: "Mobile",
				Options: {
					Type: "tel",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Mobile"),
					MinLength: 10,
					MaxLength: 15,
				}
			},
			{
				Name: "Email",
				Required: true,
				Options: {
					Type: "email",
					Label: await this.configSvc.getResourceAsync("users.register.controls.Email"),
					ReadOnly: true
				}
			},
			{
				Name: "Language",
				Type: "Select",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.Language.label"),
					Description: await this.configSvc.getResourceAsync("users.register.controls.Language.description"),
					SelectOptions: {
						Values: this.configSvc.languages
					},
				}
			},
			{
				Name: "DarkTheme",
				Type: "YesNo",
				Options: {
					Label: await this.configSvc.getResourceAsync("users.register.controls.DarkTheme"),
					Type: "toggle"
				}
			}
		];

		config.forEach(options => {
			if (!options.Required && this.configSvc.appConfig.accounts.registration.required.findIndex(value => AppUtility.isEquals(value, options.Name)) > -1) {
				options.Required = true;
			}
		});
		this.configSvc.appConfig.accounts.registration.excluded.forEach(name => config.removeAt(config.findIndex(ctrl => ctrl.Name === name)));

		this.update.language = this.profile.Language;
		this.update.darkTheme = AppUtility.isEquals("dark", this.configSvc.color);
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.profile.update.title");
		await Promise.all([
			this.prepareButtonsAsync(),
			this.trackAsync(this.title, "Open")
		]);
		this.update.config = config;
	}

	async updateProfileAsync() {
		if (!this.appFormsSvc.validate(this.update.form)) {
			return;
		}
		else if (this.update.hash === AppCrypto.hash(this.update.form.value)) {
			await this.showProfileAsync();
		}
		else {
			const profile = this.update.form.value;
			profile.Options = this.configSvc.appConfig.options;
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.usersSvc.updateProfileAsync(
				profile,
				async () => {
					if (this.profile.ID === this.configSvc.getAccount().id) {
						await this.configSvc.storeSessionAsync();
						if (this.update.form.value.Language !== undefined && this.update.form.value.DarkTheme !== undefined && (this.update.language !== this.update.form.value.Language || this.update.darkTheme !== this.update.form.value.DarkTheme)) {
							this.configSvc.appConfig.options.theme = this.update.form.value.DarkTheme ? "dark" : "light";
							if (this.update.language !== this.update.form.value.Language) {
								await this.configSvc.changeLanguageAsync(this.update.form.value.Language);
							}
							else {
								await this.configSvc.saveOptionsAsync();
							}
						}
						AppEvents.broadcast("Profile", { Type: "Updated" });
					}
					await Promise.all([
						this.trackAsync(this.title),
						this.showProfileAsync(async () => await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.update.messages.success")))
					]);
				},
				async error => await Promise.all([
					this.trackAsync(this.title),
					this.appFormsSvc.showErrorAsync(error)
				])
			);
		}
	}

	async openUpdatePasswordAsync() {
		this.password.config = [
			{
				Name: "OldPassword",
				Required: true,
				Options: {
					Type: "password",
					Label: await this.configSvc.getResourceAsync("users.profile.password.controls.OldPassword"),
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
					Label: await this.configSvc.getResourceAsync("users.profile.password.controls.Password"),
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
					Label: await this.configSvc.getResourceAsync("users.profile.password.controls.ConfirmPassword"),
					MinLength: 1,
					MaxLength: 150
				}
			},
		];
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.profile.password.title");
		await Promise.all([
			this.prepareButtonsAsync(),
			this.trackAsync(this.title, "Open", "Users:Password")
		]);
	}

	async updatePasswordAsync() {
		if (this.appFormsSvc.validate(this.password.form)) {
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.usersSvc.updatePasswordAsync(
				this.password.form.value.OldPassword,
				this.password.form.value.Password,
				async () => await Promise.all([
					this.trackAsync(this.title, "Update", "Users:Password"),
					this.showProfileAsync(async () => await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.password.message")))
				]),
				async error => await Promise.all([
					this.trackAsync(this.title, "Update", "Users:Password"),
					this.appFormsSvc.showErrorAsync(error, undefined, () => this.password.controls.find(ctrl => ctrl.Name === "OldPassword").focus())
				])
			);
		}
	}

	async openUpdateEmailAsync() {
		this.email.config = [
			{
				Name: "OldPassword",
				Required: true,
				Options: {
					Type: "password",
					Label: await this.configSvc.getResourceAsync("users.profile.password.controls.OldPassword"),
					MinLength: 1,
					MaxLength: 150,
					AutoFocus: true
				}
			},
			{
				Name: "Email",
				Required: true,
				Options: {
					Type: "email",
					Label: await this.configSvc.getResourceAsync("users.profile.email.controls.Email"),
					MinLength: 1,
					MaxLength: 150
				}
			},
			{
				Name: "ConfirmEmail",
				Required: true,
				Validators: [this.appFormsSvc.isEquals("Email")],
				Options: {
					Type: "email",
					Label: await this.configSvc.getResourceAsync("users.profile.email.controls.ConfirmEmail"),
					MinLength: 1,
					MaxLength: 150
				}
			},
		];
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.profile.email.title");
		await Promise.all([
			this.prepareButtonsAsync(),
			this.trackAsync(this.title, "Open", "Users:Email")
		]);
	}

	async updateEmailAsync() {
		if (this.appFormsSvc.validate(this.email.form)) {
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.usersSvc.updateEmailAsync(
				this.email.form.value.OldPassword,
				this.email.form.value.Email,
				async () => await Promise.all([
					this.trackAsync(this.title, "Update", "Users:Email"),
					this.showProfileAsync(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.email.message")))
				]),
				async error => await Promise.all([
					this.trackAsync(this.title, "Update", "Users:Email"),
					this.appFormsSvc.showErrorAsync(error, undefined, () => this.email.controls.find(ctrl => ctrl.Name === "OldPassword").focus())
				])
			);
		}
	}

	async openUpdateServicePrivilegesAsync() {
		this.services = this.configSvc.appConfig.services.all.filter(service => this.authSvc.isServiceAdministrator(service.name) && AppUtility.isTrue(service.canSetPrivilegs)).map(service => service.name.toLowerCase());
		const privileges = Account.get(this.profile.ID).privileges;
		this.services.forEach(service => this.servicePrivileges.privileges[service] = privileges.filter(privilege => AppUtility.isEquals(privilege.ServiceName, service)));
		this.servicePrivileges.hash = AppCrypto.hash(this.servicePrivileges.privileges);
		const title = await this.configSvc.getResourceAsync("users.profile.privileges.title");
		this.configSvc.appTitle = this.title = `${title} [${this.profile.Name}]`;
		await Promise.all([
			this.prepareButtonsAsync(),
			this.trackAsync(title, "Open", "Users:Privileges")
		]);
	}

	trackServicePrivileges(index: number, service: string) {
		return `${service}@${index}`;
	}

	getServicePrivileges(service: string) {
		return this.servicePrivileges.privileges[service];
	}

	onServicePrivilegesChanged(event: any) {
		this.servicePrivileges.privileges[event.service] = event.privileges as Array<Privilege>;
	}

	async updateServicePrivilegesAsync() {
		if (this.servicePrivileges.hash !== AppCrypto.hash(this.servicePrivileges.privileges)) {
			const title = await this.configSvc.getResourceAsync("users.profile.privileges.title");
			await this.appFormsSvc.showLoadingAsync(title);
			await this.usersSvc.updateServicePrivilegesAsync(
				this.profile.ID,
				this.servicePrivileges.privileges,
				async () => await Promise.all([
					this.trackAsync(title, "Update", "Users:Privileges"),
					this.showProfileAsync(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.privileges.message", { name: this.profile.Name })))
				]),
				async error => await Promise.all([
					this.trackAsync(title, "Update", "Users:Privileges"),
					this.appFormsSvc.showErrorAsync(error)
				])
			);
		}
		else {
			await this.showProfileAsync();
		}
	}

	showProfileAsync(preProcess?: () => void) {
		return this.appFormsSvc.hideLoadingAsync(async () => {
			if (preProcess !== undefined) {
				preProcess();
			}
			await this.configSvc.navigateBackAsync(!this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.profile) ? `${this.configSvc.appConfig.URLs.users.profile}/my` : undefined);
		});
	}

	private async trackAsync(title: string, action?: string, category?: string) {
		await TrackingUtility.trackAsync({ title: `Users - ${title}`, campaignUrl: this.configSvc.appConfig.URLs.users.profile, category: category || "Users:Profile", action: action || "Update" }, false);
	}

}
