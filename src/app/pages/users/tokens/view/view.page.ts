import { Component, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { FormGroup } from "@angular/forms";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { UsersService } from "@app/services/users.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { UserProfile, UserToken } from "@app/models/user";

@Component({
	selector: "page-tokens-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class TokensViewPage implements OnInit {

	constructor(
		private datePipe: DatePipe,
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private usersSvc: UsersService
	) {
	}

	token: UserToken;
	title = "View token";
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
		this.token = UserToken.get(this.configSvc.requestParams["ID"]);
		if (this.token === undefined) {
			Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateRootAsync()
			]);
			return;
		}
		const creator = UserProfile.get(this.token.CreatedID);
		
		const config: Array<AppFormsControlConfig> = [
			{
				Name: "Title",
				Type: "Text",
				Extras: { "Text": this.token.Title },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.Title.label"),
					MinLength: 1,
					MaxLength: 250,
					AutoFocus: true
				}
			},
			{
				Name: "UserID",
				Type: "Text",
				Extras: { "Text": this.token.user === undefined ? "Unknown" : `${this.token.user.Name} (${this.token.user.Email})` },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.UserID.label")
				}
			},
			{
				Name: "Expires",
				Type: "Text",
				Extras: { "Text": this.datePipe.transform(this.token.Expires, "h:mm a @ d/M/y") },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.Expires.label")
				}
			},
			{
				Name: "LastAccess",
				Type: "Text",
				Extras: { "Text": this.datePipe.transform(this.token.LastAccess, "h:mm a @ d/M/y") },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.LastAccess.label")
				}
			},
			{
				Name: "BearerToken",
				Type: "Text",
				Extras: { "Text": this.token.Token.Bearer },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.Token.Bearer"),
					Icon: {
						Name: "copy-outline",
						Fill: "clear",
						Color: "medium",
						Slot: "end",
						OnClick: async () => {
							await PlatformUtility.copyToClipboardAsync(this.token.Token.Bearer);
							await this.appFormsSvc.showToastAsync("Copied...");
						}
					}
				}
			},
			{
				Name: "BasicToken",
				Type: "Text",
				Extras: { "Text": this.token.Token.Basic },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.Token.Basic"),
					Icon: {
						Name: "copy-outline",
						Fill: "clear",
						Color: "medium",
						Slot: "end",
						OnClick: async () => {
							await PlatformUtility.copyToClipboardAsync(this.token.Token.Basic);
							await this.appFormsSvc.showToastAsync("Copied...");
						}
					}
				}
			},
			{
				Name: "Created",
				Type: "Text",
				Extras: { "Text": await this.configSvc.getResourceAsync("tokens.view.controls.Created.description", { user: creator === undefined ? "Unknown" : creator.Name, created: this.datePipe.transform(this.token.Created, "h:mm a @ d/M/y") }) },
				Options: {
					Type: "text",
					Label: await this.configSvc.getResourceAsync("tokens.view.controls.Created.label")
				}
			}
 		];

		this.button = await this.configSvc.getResourceAsync("tokens.view.button");
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync("tokens.view.title");
		this.config = config;
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("tokens.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("common.buttons.delete"));
				await this.usersSvc.deleteTokenAsync(
					this.token.ID,
					() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync()),
					error => this.appFormsSvc.showErrorAsync(error)
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
