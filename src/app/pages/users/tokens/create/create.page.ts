import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UsersService } from "@app/services/users.service";
import { UserProfile, UserToken } from "@app/models/user";
import { UsersSelectorModalPage } from "@app/controls/common/user.selector.modal.page";

@Component({
	selector: "page-tokens-create",
	templateUrl: "./create.page.html",
	styleUrls: ["./create.page.scss"]
})

export class TokensCreatePage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
	) {
	}

	title = "Create new token";
	form = new FormGroup({});
	controls = new Array<AppFormsControl>();
	config = undefined as Array<AppFormsControlConfig>;
	button = "Create";

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		if (this.authSvc.isSystemAdministrator()) {
			this.prepareAsync();
		}
		else {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateRootAsync()
			]);
		}
	}

	private async prepareAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("tokens.create.title");
		this.button = await this.configSvc.getResourceAsync("tokens.create.button");
		this.config = [
			{
				Name: "Title",
				Required: true,
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.create.controls.Title.label"),
					Description: await this.configSvc.getResourceAsync("tokens.create.controls.Title.description"),
					MinLength: 1,
					MaxLength: 250,
					AutoFocus: true
				}
			},
			{
				Name: "UserID",
				Type: "Lookup",
				Required: true,
				Options: {
					Label: await this.configSvc.getResourceAsync("tokens.create.controls.UserID.label"),
					Description: await this.configSvc.getResourceAsync("tokens.create.controls.UserID.description"),
					LookupOptions: {
						Multiple: false,
						AllowDelete: false,
						ModalOptions: {
							Component: UsersSelectorModalPage,
							ComponentProps: { multiple: false },
							OnDismiss: (data, formControl) => {
								if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
									const user = UserProfile.get(data[0]);
									formControl.setValue(user.ID);
									formControl.lookupDisplayValues = [{ Value: user.ID, Label: user.Name }];
								}
							}
						}
					}
				}
			},
			{
				Name: "Expires",
				Type: "DatePicker",
				Required: true,
				Options: {					
					Label: await this.configSvc.getResourceAsync("tokens.create.controls.Expires.label"),
					Description: await this.configSvc.getResourceAsync("tokens.create.controls.Expires.description"),
					MinValue: (new Date().getFullYear()) + "-01-01",
					MaxValue: (new Date().getFullYear() + 100) + "-12-31",
					DatePickerOptions: {
						AllowTimes: true,
						AllowDelete: false
					}
				}
			}
		];
	}

	onFormInitialized() {
		const expires = new Date();
		expires.setFullYear(new Date().getFullYear() + 10);
		this.form.patchValue({ Expires: AppUtility.toIsoDateTime(expires) });
	}

	async createAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			const body = this.form.value;
			body.Expires += "00";
			await this.appFormsSvc.showLoadingAsync(this.title);
			await this.usersSvc.createTokenAsync(
				body,
				data => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync().then(() => this.configSvc.navigateForwardAsync(UserToken.get(data.ID).routerURI))),
				error => this.appFormsSvc.showErrorAsync(error)
			);
		}
	}

}
