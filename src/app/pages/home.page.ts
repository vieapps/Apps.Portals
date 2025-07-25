import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@app/components/app.events";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AuthenticationService } from "@app/services/authentication.service";
import { ConfigurationService } from "@app/services/configuration.service";

@Component({
	selector: "page-home",
	templateUrl: "./home.page.html",
	styleUrls: ["./home.page.scss"],
})

export class HomePage implements OnInit, OnDestroy {

	constructor(
		private authSvc: AuthenticationService,
		private configSvc: ConfigurationService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "Home";
	titleResource = "common.sidebar.home";

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	get showStatistics() {
		return this.isAuthenticated && this.configSvc.appConfig.options.showStatistics;
	}

	get statistics() {
		return this.configSvc.statistics;
	}

	get activeService() {
		return this.configSvc.appConfig.services.active.service;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.prepareAsync();
		}

		AppEvents.on("App", info => {
			if ("Initialized" === info.args.Type) {
				this.prepareAsync();
			}
			else if ("Language" === info.args.Type && "Changed" === info.args.Mode) {
				this.setTitleAsync();
			}
			else if ("HomePage" === info.args.Type) {
				if ("Open" === info.args.Mode) {
					this.prepareAsync("Return");
				}
				else if ("SetTitle" === info.args.Mode) {
					this.titleResource = info.args.ResourceID || "common.sidebar.home";
				}
			}
		}, "HomePageEvents");
	}

	ngOnDestroy() {
		AppEvents.off("App", "HomePageEvents");
	}

	private async prepareAsync(action?: string) {
		await this.setTitleAsync().then(() => TrackingUtility.trackAsync({ title: this.title, category: "Home", action: action || "Open" }));
	}

	private async setTitleAsync() {
		const title = await this.configSvc.getResourceAsync(this.titleResource);
		if (this.titleResource !== title) {
			this.title = this.configSvc.appTitle = title;
		}
	}

}
