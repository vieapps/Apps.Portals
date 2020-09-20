import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { ConfigurationService } from "@app/services/configuration.service";
import { UsersService } from "@app/services/users.service";

@Component({
	selector: "control-app-preferences",
	templateUrl: "./app.preferences.control.html",
	styleUrls: ["./app.preferences.control.scss"]
})

export class AppPreferencesControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private usersSvc: UsersService
	) {
	}

	get color() {
		return this.configSvc.color;
	}

	get logo() {
		return "./assets/images/icon.png";
	}

	get title() {
		return this.configSvc.appConfig.app.name;
	}

	get description() {
		return this.configSvc.appConfig.app.description;
	}

	get copyright() {
		let license = this.configSvc.appConfig.app.license;
		license += license.indexOf("license") < 0 ? " license" : "";
		return  `${this.configSvc.appConfig.app.copyright} - v${this.configSvc.appConfig.app.version} - Distributed under ${license}`;
	}

	get frameworks() {
		return `Powered by ${this.configSvc.appConfig.app.frameworks} and love from ${this.configSvc.appConfig.app.copyright.replace("©", "").trim()}`;
	}

	get downloadURLs() {
		return this.configSvc.appConfig.downloadURLs;
	}

	get languages() {
		return this.configSvc.languages;
	}

	get appShell() {
		return this.configSvc.appConfig.app.shell;
	}

	labels = {
		options: {
			label: "Options",
			language: "Language",
			theme: "Use dark theme"
		},
		apps: {
			desktop: "Desktop apps",
			mobile: "Mobile & Tablet apps"
		},
		about: "About",
		ok: "OK",
		cancel: "Cancel"
	};

	options = {
		language: "vi-VN",
		darkTheme: false
	};

	ngOnInit() {
		this.prepareAsync();
		AppEvents.on("App", async info => {
			if ("LanguageChanged" === info.args.Type) {
				await this.prepareLabelsAsync();
			}
		}, "AppPreferences");
	}

	ngOnDestroy() {
		AppEvents.off("App", "AppPreferences");
	}

	private async prepareAsync() {
		await this.prepareLabelsAsync();
		this.options = {
			language: this.configSvc.appConfig.language,
			darkTheme: AppUtility.isEquals("dark", this.color)
		};
	}

	private async prepareLabelsAsync() {
		this.labels = {
			options: {
				label: await this.configSvc.getResourceAsync("common.preferences.label"),
				language: await this.configSvc.getResourceAsync("common.preferences.options.language"),
				theme: await this.configSvc.getResourceAsync("common.preferences.options.theme"),
			},
			apps: {
				desktop: await this.configSvc.getResourceAsync("common.preferences.apps.desktop"),
				mobile: await this.configSvc.getResourceAsync("common.preferences.apps.mobile")
			},
			about: await this.configSvc.getResourceAsync("common.preferences.about"),
			ok: await this.configSvc.getResourceAsync("common.buttons.ok"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};
	}

	async onLanguageChangedAsync(event: any) {
		if (this.options.language !== event.detail.value) {
			this.options.language = event.detail.value;
			if (this.configSvc.isAuthenticated) {
				const profile = this.configSvc.getAccount().profile;
				profile.Language = this.options.language;
				await this.usersSvc.updateProfileAsync(profile, async _ => {
					await this.configSvc.storeSessionAsync();
					await this.configSvc.changeLanguageAsync(this.options.language);
				});
			}
			else {
				await this.configSvc.changeLanguageAsync(this.options.language);
			}
		}
	}

	async onThemeChangedAsync(event: any) {
		this.options.darkTheme = AppUtility.isTrue(event.detail.checked);
		this.configSvc.appConfig.options.theme = this.options.darkTheme ? "dark" : "light";
		await this.configSvc.storeOptionsAsync();
	}

}
