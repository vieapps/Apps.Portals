import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { ConfigurationService } from "@app/services/configuration.service";

@Component({
	selector: "page-home",
	templateUrl: "./home.page.html",
	styleUrls: ["./home.page.scss"],
})

export class HomePage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService
	) {
	}

	title = "Home";
	titleResource = "common.sidebar.home";
	changes: number;

	get color() {
		return this.configSvc.color;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	get activeService() {
		return this.configSvc.appConfig.services.active;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.prepare();
		}

		AppEvents.on("App", info => {
			if ("Initialized" === info.args.Type) {
				this.prepare();
			}
			else if ("Language" === info.args.Type && "Changed" === info.args.Mode) {
				this.setTitleAsync();
			}
			else if ("Router" === info.args.Type && "Navigated" === info.args.Mode && this.configSvc.appConfig.URLs.home === info.args.URL) {
				AppUtility.invoke(() => {
					this.prepare("Return");
					AppEvents.broadcast("App", { Type: "HomePage", Mode: "Open", Source: "Return" });
				});
				this.changes = +new Date();
			}
			else if ("HomePage" === info.args.Type && "SetTitle" === info.args.Mode) {
				this.titleResource = info.args.ResourceID || "common.sidebar.home";
			}
		}, "HomePageEvents");
	}

	ngOnDestroy() {
		AppEvents.off("App", "HomePageEvents");
	}

	private prepare(action?: string) {
		this.setTitleAsync().then(() => TrackingUtility.trackAsync({ title: this.title, category: "Home", action: action || "Open" }));
	}

	private async setTitleAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(this.titleResource);
	}

}
