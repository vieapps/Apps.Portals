import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { AppFormsService } from "@app/components/forms.service";

@Component({
	selector: "control-app-preferences",
	templateUrl: "./app.preferences.control.html",
	styleUrls: ["./app.preferences.control.scss"]
})

export class AppPreferencesControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService
	) {
	}

	get color() {
		return this.configSvc.color;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	get isSystemAdministrator() {
		return this.authSvc.isSystemAdministrator();
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

	get downloadable() {
		return this.configSvc.appConfig.app.shell !== "Electron" && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === "Portals") > -1;
	}

	get downloadURLs() {
		return this.configSvc.appConfig.downloadURLs;
	}

	get languages() {
		return this.configSvc.languages;
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
		profile: "Profile",
		flushCache: "Flush cache",
		about: "About",
		ok: "OK",
		cancel: "Cancel"
	};

	options = {
		language: "vi-VN",
		darkTheme: false
	};

	ngOnInit() {
		this.prepareLabelsAsync();
		this.options = {
			language: this.configSvc.appConfig.language,
			darkTheme: "dark" === this.color
		};
		AppEvents.on("App", info => {
			if ("Initialized" === info.args.Type || ("Language" === info.args.Type && "Changed" === info.args.Mode)) {
				this.prepareLabelsAsync();
			}
		}, "AppPreferences");
	}

	ngOnDestroy() {
		AppEvents.off("App", "AppPreferences");
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
			profile: await this.configSvc.getResourceAsync("common.sidebar.profile"),
			flushCache: await this.configSvc.getResourceAsync("common.preferences.flushCache"),
			about: await this.configSvc.getResourceAsync("common.preferences.about"),
			ok: await this.configSvc.getResourceAsync("common.buttons.ok"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};
	}

	onLanguageChanged(event: any) {
		if (this.options.language !== event.detail.value) {
			this.configSvc.appConfig.options.i18n = this.options.language = event.detail.value;
			this.configSvc.changeLanguageAsync(this.options.language).then(() => this.configSvc.storeOptionsAsync());
		}
	}

	onThemeChanged(event: any) {
		this.options.darkTheme = AppUtility.isTrue(event.detail.checked);
		this.configSvc.appConfig.options.theme = this.options.darkTheme ? "dark" : "light";
		this.configSvc.storeOptionsAsync();
	}

	openProfile() {
		this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.users.profile + "/my");
	}

	async flushCacheAsync() {
		this.appFormsSvc.showAlertAsync(
			await this.appFormsSvc.getResourceAsync("common.alert.header.general"),
			`${await this.configSvc.getResourceAsync("common.preferences.flushCache")}?`,
			undefined,
			_ => this.configSvc.flushCachingStoragesAsync(async __ => this.appFormsSvc.showAlertAsync(await this.configSvc.getResourceAsync("common.preferences.flushCache"), await this.configSvc.getResourceAsync("common.buttons.done"))),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
