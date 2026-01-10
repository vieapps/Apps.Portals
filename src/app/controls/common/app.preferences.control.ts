import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { AppFormsService } from "@app/components/forms.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Notification } from "@app/models/notification";

@Component({
	selector: "control-app-preferences",
	templateUrl: "./app.preferences.control.html",
	styleUrls: ["./app.preferences.control.scss"]
})

export class AppPreferencesControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
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

	get isAdministrator() {
		return this.isSystemAdministrator || this.portalsCoreSvc.canManageOrganization(this.portalsCoreSvc.activeOrganization);
	}

	get showStatistics() {
		return this.isSystemAdministrator || this.configSvc.appConfig.options.showStatistics;
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
		return this.configSvc.isAuthenticated && this.configSvc.appConfig.app.shell !== "Electron" && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === "Portals") > -1;
	}

	get downloadURIs() {
		return this.configSvc.appConfig.downloadURIs;
	}

	get languages() {
		return this.configSvc.languages;
	}

	get unreadNotifications() {
		return Notification.unread.size;
	}

	labels = {
		options: {
			label: "Options",
			language: "Language",
			theme: "Use dark theme",
			thumbnails: "Use thumbnails on insert",
			preflight: "Preflight",
			xhr: "Prefer XHR",
			xhrToken: "Use XHR Query Token",
			debug: "Turn on debug logs"
		},
		apps: {
			desktop: "Desktop apps",
			mobile: "Mobile & Tablet apps"
		},
		notifications: "Notifications",
		profile: "Profile",
		logs: "Logs",
		trash: "Trash",
		flushCache: "Flush cache",
		sessions: "Sessions statistics",
		visits: "Visits statistics",
		about: "About",
		ok: "OK",
		cancel: "Cancel"
	};

	options = {
		language: "vi-VN",
		darkTheme: false,
		thumbnails: false,
		preflight: false,
		xhr: false,
		xhrToken: false,
		debug: false
	};

	ngOnInit() {
		this.prepareLabelsAsync();
		this.options = {
			language: this.configSvc.appConfig.language,
			darkTheme: "dark" === this.color,
			thumbnails: this.configSvc.appConfig.options.thumbnails.useWhenInsertWithLink,
			preflight: this.configSvc.appConfig.app.preflight.enable,
			xhr: this.configSvc.appConfig.app.query.preferXHR,
			xhrToken: this.configSvc.appConfig.app.query.includeToken,
			debug: this.configSvc.appConfig.app.debug
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
				thumbnails: await this.configSvc.getResourceAsync("common.preferences.options.thumbnails"),
				preflight: await this.configSvc.getResourceAsync("common.preferences.options.preflight"),
				xhr: await this.configSvc.getResourceAsync("common.preferences.options.xhr"),
				xhrToken: await this.configSvc.getResourceAsync("common.preferences.options.xhrToken"),
				debug: await this.configSvc.getResourceAsync("common.preferences.options.debug")
			},
			apps: {
				desktop: await this.configSvc.getResourceAsync("common.preferences.apps.desktop"),
				mobile: await this.configSvc.getResourceAsync("common.preferences.apps.mobile")
			},
			notifications: await this.configSvc.getResourceAsync("common.preferences.notifications"),
			profile: await this.configSvc.getResourceAsync("common.preferences.profile"),
			logs: await this.configSvc.getResourceAsync("common.preferences.logs"),
			trash: await this.configSvc.getResourceAsync("trash.list"),
			flushCache: await this.configSvc.getResourceAsync("common.preferences.flushCache"),
			sessions: "Sessions statistics",
			visits: "Visits statistics",
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

	onUseThumbnailsChanged(event: any) {
		this.options.thumbnails = this.configSvc.appConfig.options.thumbnails.useWhenInsertWithLink = AppUtility.isTrue(event.detail.checked);
	}

	onPreflightChanged(event: any) {
		this.options.preflight = this.configSvc.appConfig.app.preflight.enable = AppUtility.isTrue(event.detail.checked);
	}

	onPreferXHRChanged(event: any, isXHR: boolean) {
		if (isXHR) {
			this.options.xhr = this.configSvc.appConfig.app.query.preferXHR = AppUtility.isTrue(event.detail.checked);
		}
		else {
			this.options.xhrToken = this.configSvc.appConfig.app.query.includeToken = AppUtility.isTrue(event.detail.checked);
		}
	}

	onDebugChanged(event: any) {
		this.options.debug = this.configSvc.appConfig.app.debug = AppUtility.isTrue(event.detail.checked);
	}

	openNotifications() {
		this.configSvc.navigateForwardAsync("/notifications");
	}

	openLogs() {
		this.configSvc.navigateForwardAsync("/logs/services");
	}

	openTrash() {
		this.configSvc.navigateForwardAsync("/trash");
	}

	openProfile() {
		this.configSvc.navigateForwardAsync(this.configSvc.appConfig.URLs.users.profile + "/my");
	}

	openAPIs(path: string, query?: string) {
		PlatformUtility.openURL(`${this.configSvc.appConfig.URIs.apis}${path}?x-app-token=${this.configSvc.appConfig.jwt}&x-app-token-expires=123456789${query !== undefined ? `&${query}` : ""}`);
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
