import { Component, OnInit } from "@angular/core";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { ServiceLog } from "@app/models/base";

@Component({
	selector: "page-logs-view",
	templateUrl: "./view.page.html",
	styleUrls: ["./view.page.scss"]
})

export class LogsViewPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	title = "View Logs";
	logs = new Array<ServiceLog>();

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		const account = this.configSvc.getAccount();
		if (this.authSvc.isSystemAdministrator(account) || this.portalsCoreSvc.canManageOrganization(this.portalsCoreSvc.activeOrganization, account)) {
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
		this.logs = this.configSvc.serviceLogs.filter(log => ids.contains(log.ID)).sortBy({ name: "Time", reverse: true });
		await TrackingUtility.trackAsync({ title: this.title, category: "ServiceLog", action: "View" });
	}

	detailLogs(log: ServiceLog) {
		return log.Logs.replace(/;/g, "; ").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "").replace(/\n/g, "<br/>");
	}

	track(index: number, log: ServiceLog) {
		return `${log.ID}@${index}`;
	}

}
