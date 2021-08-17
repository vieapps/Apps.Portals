import { Component, OnInit, ViewChild } from "@angular/core";
import { IonInput } from "@ionic/angular";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { UsersService } from "@app/services/users.service";

@Component({
	selector: "page-users-otp",
	templateUrl: "./otp.page.html",
	styleUrls: ["./otp.page.scss"]
})

export class UsersOtpPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService
	) {
	}

	title = "OTP";
	providers = new Array<{ Type: string, Label: string, Time: Date, Info: string }>();
	required = false;
	status = "off";
	state = "show";
	mode = "app";
	password = "";
	provision = {
		info: "",
		uri: "",
		value: "",
		phone: ""
	};
	labels = {
		status: "status",
		providers: {
			title: "providers",
			select: "select",
			app: "Use an authenticator app",
			sms: "Use SMS OTP"
		},
	};
	buttons = {
		on: "Power on",
		delete: "Delete",
		add: "Add",
		send: "Send OTP",
		verify: "Verify",
		done: "Done"
	};
	controls = {
		app: {
			label: "QR code for the authenticator app",
			description: "Open authenticator app, scan the QR code and enter the generated code.<br/>Can use Google Authenticator/Microsoft Authenticator on AppStore/PlayStore"
		},
		sms: {
			label: "Phone number",
			description: "Enter your phone number and click 'Send OTP' button to receive a password"
		},
		provision: "Enter the OTP code of the authenticator app",
		password: {
			label: "Password",
			show: false
		}
	};

	@ViewChild("phone", { static: false }) private phoneCtrl: IonInput;
	@ViewChild("otp", { static: false }) private otpCtrl: IonInput;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get phoneIsAllowed() {
		return this.configSvc.appConfig.accountRegistrations.phoneIsAllowed;
	}

	get gotAuthenticatorApp() {
		return this.providers.first(info => info.Type === "App") !== undefined;
	}

	ngOnInit() {
		this.prepareAsync();
	}

	async prepareAsync(onNext?: () => void) {
		const account = this.configSvc.getAccount();
		this.required = account.twoFactors !== undefined ? account.twoFactors.required : false;
		this.providers = account.twoFactors !== undefined ? account.twoFactors.providers : [];
		this.mode = this.gotAuthenticatorApp ? "sms" : "app";
		this.password = "";
		await Promise.all([
			this.prepareResourcesAsync(),
			this.prepareStatusAsync()
		]);
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("users.profile.otp.title");
		await this.trackAsync(this.title, "Open");
		if (onNext !== undefined) {
			onNext();
		}
	}

	async prepareResourcesAsync() {
		this.labels = {
			status: await this.configSvc.getResourceAsync("users.profile.otp.status.label"),
			providers: {
				title: await this.configSvc.getResourceAsync("users.profile.otp.providers.title"),
				select: await this.configSvc.getResourceAsync("users.profile.otp.providers.select"),
				app: await this.configSvc.getResourceAsync("users.profile.otp.providers.app"),
				sms: await this.configSvc.getResourceAsync("users.profile.otp.providers.sms")
			}
		};
		this.buttons = {
			on: await this.configSvc.getResourceAsync("users.profile.otp.buttons.on"),
			delete: await this.configSvc.getResourceAsync("users.profile.otp.buttons.delete"),
			add: await this.configSvc.getResourceAsync("common.buttons.add"),
			send: await this.configSvc.getResourceAsync("users.profile.otp.buttons.send"),
			verify: await this.configSvc.getResourceAsync("users.profile.otp.buttons.verify"),
			done: await this.configSvc.getResourceAsync("common.buttons.done")
		};
		this.controls = {
			app: {
				label: await this.configSvc.getResourceAsync("users.profile.otp.controls.app.label"),
				description: await this.configSvc.getResourceAsync("users.profile.otp.controls.app.description")
			},
			sms: {
				label: await this.configSvc.getResourceAsync("users.profile.otp.controls.sms.label"),
				description: await this.configSvc.getResourceAsync("users.profile.otp.controls.sms.description")
			},
			provision: await this.configSvc.getResourceAsync(`users.profile.otp.controls.provision.${this.mode}`),
			password: {
				label: await this.configSvc.getResourceAsync("users.profile.password.controls.OldPassword"),
				show: false
			}
		};
	}

	async prepareStatusAsync() {
		this.status = this.required
			? await this.configSvc.getResourceAsync("users.profile.otp.status.on")
			: this.provision.uri === ""
				? await this.configSvc.getResourceAsync("users.profile.otp.status.off")
				: await this.configSvc.getResourceAsync("users.profile.otp.status.provisioning");
	}

	async provisonAsync() {
		this.state = "setup";
		this.password = "";
		this.provision.value = "";
		this.provision.uri = "";
		this.controls.provision = await this.configSvc.getResourceAsync(`users.profile.otp.controls.provision.${this.mode}`);

		if (this.mode === "sms") {
			if (AppUtility.isNotEmpty(this.provision.phone) && AppUtility.isPhone(this.provision.phone)) {
				await this.appFormsSvc.showAlertAsync(
					await this.configSvc.getResourceAsync("users.profile.otp.buttons.verify"),
					undefined,
					await this.configSvc.getResourceAsync("users.profile.otp.messages.verify", { label: this.provision.phone }),
					async () => {
						await this.appFormsSvc.showLoadingAsync(this.title);
						await this.prepare2FAMethodAsync();
					},
					await this.configSvc.getResourceAsync("common.buttons.ok"),
					await this.configSvc.getResourceAsync("common.buttons.cancel")
				);
			}
			else {
				await this.prepareStatusAsync();
				PlatformUtility.focus(this.phoneCtrl);
			}
		}
		else {
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.prepare2FAMethodAsync();
		}
	}

	async prepare2FAMethodAsync() {
		await this.usersSvc.prepare2FAMethodAsync(
			async data => {
				this.provision.info = data.Provisioning;
				this.provision.uri = this.mode === "sms" ? "" : data.URI;
				await Promise.all([
					this.trackAsync(this.title + " | Prepare | Success", "Prepare"),
					this.prepareStatusAsync(),
					this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.otpCtrl))
				]);
			},
			async error => await Promise.all([
				this.trackAsync(this.title + " | Prepare | Error", "Prepare"),
				this.appFormsSvc.showErrorAsync(error)
			]),
			this.mode === "sms"
				? "x-body=" + AppCrypto.jsonEncode({
					OtpType: AppCrypto.rsaEncrypt("SMS"),
					OtpPhone: AppCrypto.rsaEncrypt(this.provision.phone)
				})
				: undefined
		);
	}

	async addAsync() {
		await this.appFormsSvc.showLoadingAsync(this.title);
		await this.usersSvc.add2FAMethodAsync(
			this.password,
			this.provision.info,
			this.provision.value,
			async () => {
				this.state = "show";
				this.password = "";
				this.provision.info = "";
				this.provision.value = "";
				this.provision.uri = "";
				this.provision.phone = "";
				await this.prepareAsync();
				await Promise.all([
					this.trackAsync(this.title + " | Update | Success"),
					this.appFormsSvc.hideLoadingAsync()
				]);
			},
			async error => await Promise.all([
				this.trackAsync(this.title + " | Update | Error"),
				this.appFormsSvc.showErrorAsync(error, undefined, () => {
					this.provision.value = "";
					this.password = "";
					PlatformUtility.focus(this.otpCtrl);
				})
			])
		);
	}

	async deleteAsync(provider: { Type: string, Label: string, Time: Date, Info: string }) {
		await this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("users.profile.otp.buttons.delete"),
			undefined,
			await this.configSvc.getResourceAsync("users.profile.otp.messages.confirm", { label: provider.Label }),
			async data => await this.usersSvc.delete2FAMethodAsync(
				data.password + "",
				provider.Info,
				async () => await this.prepareAsync(async () => await Promise.all([
					this.trackAsync(this.title + " | Delete | Success", "Delete"),
					this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("users.profile.otp.messages.success", { label: provider.Label }))
				])),
				async error => await Promise.all([
					this.trackAsync(this.title + " | Delete | Error", "Delete"),
					this.appFormsSvc.showErrorAsync(error)
				])
			),
			await this.configSvc.getResourceAsync("common.buttons.yes"),
			await this.configSvc.getResourceAsync("common.buttons.no"),
			[
				{
					name: "password",
					type: "password",
					placeholder: await this.configSvc.getResourceAsync("users.profile.password.controls.OldPassword")
				}
			]
		);
	}

	async doneAsync(onNext?: () => void) {
		await Promise.all([
			this.trackAsync(this.title + " | Done", "Complete"),
			this.appFormsSvc.hideLoadingAsync(async () => {
				if (onNext !== undefined) {
					onNext();
				}
				await this.configSvc.navigateBackAsync(!this.configSvc.previousURL.startsWith(this.configSvc.appConfig.URLs.users.profile) ? `${this.configSvc.appConfig.URLs.users.profile}/my` : undefined);
			})
		]);
	}

	private async trackAsync(title: string, action?: string) {
		await TrackingUtility.trackAsync({ title: `Users - ${title}`, campaignUrl: this.configSvc.appConfig.URLs.users.otp, category: "Users:OTP", action: action || "Update" }, false);
	}

}
