import { Component, OnInit } from "@angular/core";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService, Log } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";

@Component({
	selector: "page-logs-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class LogsViewPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService
	) {
	}

	title = "View Logs";
	logs = new Array<Log>();

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
				this.configSvc.navigateBackAsync()
			]);
		}
	}

	private async prepareAsync() {
		const ids = (this.configSvc.requestParams["ids"] as Array<string>).toHashSet();
		this.logs = this.configSvc.logs.filter(log => ids.contains(log.ID));
	}

	track(index: number, log: Log) {
		return `${log.ID}@${index}`;
	}

}
