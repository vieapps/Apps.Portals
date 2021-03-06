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
	changes: any;

	get color() {
		return this.configSvc.color;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.prepareAsync();
		}
		else {
			AppEvents.on("App", info => {
				if (AppUtility.isEquals(info.args.Type, "Initialized")) {
					this.prepareAsync();
				}
			}, "Home:AppInitialized");
		}

		AppEvents.on("App", info => {
			if (AppUtility.isEquals(info.args.Type, "LanguageChanged")) {
				this.setTitleAsync();
			}
		}, "Home:LanguageChanged");

		AppEvents.on("Navigated", info => {
			if (this.configSvc.appConfig.url.home === info.args.Url) {
				this.prepareAsync("return").then(() => {
					AppEvents.broadcast("App", { Type: "HomePageIsOpened" });
					this.changes = new Date();
				});
			}
		}, "Home:Navigated");

		AppEvents.on("SetHomepageTitleResource", info => {
			this.titleResource = info.args.ResourceID || "common.sidebar.home";
		}, "Home:SetTitle");
	}

	ngOnDestroy() {
		AppEvents.off("App", "Home:AppInitialized");
		AppEvents.off("App", "Home:LanguageChanged");
		AppEvents.off("Navigated", "Home:Navigated");
		AppEvents.off("SetHomepageTitleResource", "Home:SetTitle");
	}

	private async prepareAsync(section?: string) {
		await this.setTitleAsync();
		await this.trackAsync(section);
	}

	private async setTitleAsync() {
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(this.titleResource);
	}

	private trackAsync(section?: string) {
		return TrackingUtility.trackAsync(this.title, `${this.configSvc.appConfig.url.home}/${section || "initialize"}`);
	}

}
