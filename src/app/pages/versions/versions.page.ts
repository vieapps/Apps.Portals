import { Component, OnInit } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { UsersService } from "@app/services/users.service";
import { VersionContent } from "@app/models/base";
import { UserProfile } from "@app/models/user";

@Component({
	selector: "page-versions-list",
	templateUrl: "./versions.page.html",
	styleUrls: ["./versions.page.scss"]
})

export class VersionsPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "Versions";
	versions = new Array<VersionContent>();
	private id = undefined as string;
	private name = undefined as string;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.id = this.configSvc.requestParams["id"];
		this.name = this.configSvc.requestParams["name"];
		const info = await this.portalsCmsSvc.getObjectAsync(this.id, this.name);
		if (info.gotRights) {
			this.versions.merge(info.object.Versions);
			this.versions.forEach(verison => {
				if (verison["Creator"] === undefined) {
					const profile = UserProfile.get(verison.CreatedID);
					if (profile === undefined) {
						this.usersSvc.getProfileAsync(verison.CreatedID, () => verison["Creator"] = UserProfile.contains(verison.CreatedID) ? UserProfile.get(verison.CreatedID).Name : "Unknown");
					}
					else {
						verison["Creator"] = profile.Name;
					}
				}
			});
			this.title = await this.configSvc.getResourceAsync("versions.list", { total: info.object.TotalVersions || this.versions.length, title: info.object["Title"] });
			await TrackingUtility.trackAsync({ title: this.title, category: "Versions", action: "List" });
		}
		else {
			await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmm..."),
				this.configSvc.navigateBackAsync()
			]);
		}
	}

	track(index: number, version: VersionContent) {
		return `${version.ID}@${index}`;
	}

	async rollbackAsync(version: VersionContent) {
		await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("versions.confirm", { version: version.VersionNumber }),
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("versions.processing"));
				await this.portalsCoreSvc.rollbackAsync(this.name, this.id, version.ID, () => this.rollbackSuccessAsync(version), error => {
					if ((error.Message || "").indexOf("Value cannot be null") > -1 ) {
						this.rollbackSuccessAsync(version);
					}
					else {
						this.appFormsSvc.showErrorAsync(error);
					}
				});
			},
			"{{default}}",
			"{{default}}"
		);
	}

	async rollbackSuccessAsync(version: VersionContent) {
		const message = await this.configSvc.getResourceAsync("versions.done", { version: version.VersionNumber });
		await Promise.all([
			TrackingUtility.trackAsync({ title: this.title, category: "Versions", action: "Rollback" }),
			this.appFormsSvc.showAlertAsync(undefined, message, undefined, () => this.configSvc.navigateBackAsync())
		]);
	}

}
