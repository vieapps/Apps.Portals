import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppAPIs } from "@app/components/app.apis";
import { AppEvents } from "@app/components/app.events";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";

@Component({
	selector: "page-home",
	templateUrl: "./home.page.html",
	styleUrls: ["./home.page.scss"],
})

export class HomePage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService
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

	get isSystemAdministrator() {
		return this.authSvc.isSystemAdministrator();
	}

	get isMetricsPage() {
		return location.href.indexOf("/metrics") > 0 || location.href.indexOf("/statistics") > 0;
	}

	get isHomePage() {
		return !this.isMetricsPage;
	}

	get showStatistics() {
		return this.isAuthenticated && (this.isSystemAdministrator || this.configSvc.appConfig.options.showStatistics);
	}

	get statistics() {
		return this.configSvc.statistics;
	}

	get metrics() {
		return {
			Router: this.configSvc.metrics.Router,
			Upstream: this.configSvc.metrics.Upstream,
			Downstream: this.configSvc.metrics.Downstream
		};
	}

	get states() {
		return this.configSvc.metrics.States;
	}

	get activeService() {
		return this.configSvc.appConfig.services.active.service;
	}

	ngOnInit() {
		this.titleResource = this.isMetricsPage ? "common.sidebar.metrics" : "common.sidebar.home";
		if (this.configSvc.isReady) {
			this.prepareAsync();
		}

		if (this.isHomePage) {
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
						this.titleResource = info.args.ResourceID || (this.isMetricsPage ? "common.sidebar.metrics" : "common.sidebar.home");
					}
				}
			}, "HomePageEvents");
		}
	}

	ngOnDestroy() {
		if (this.isHomePage) {
			AppEvents.off("App", "HomePageEvents");
		}
	}

	changeState(serviceName: string, nodeID: string, isUpstream: boolean = true) {
		if (isUpstream) {
			this.states.Upstream[serviceName][nodeID] = !this.states.Upstream[serviceName][nodeID];
		}
		else {
			this.states.Downstream[serviceName][nodeID] = !this.states.Downstream[serviceName][nodeID];
		}
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
