import { Component, OnInit } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { UsersService } from "@app/services/users.service";
import { Base as BaseModel, VersionContent } from "@app/models/base";
import { Organization, Role, Module, ContentType, Expression, Site, Desktop, Portlet, SchedulingTask } from "@app/models/portals.core.all";
import { Category, Content, Item, Link, Form, Crawler } from "@app/models/portals.cms.all";
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
		private authSvc: AuthenticationService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService
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
		const account = this.configSvc.getAccount();
		this.id = this.configSvc.requestParams["id"];
		this.name = this.configSvc.requestParams["name"];
		let object: BaseModel;
		let gotRights = this.authSvc.isSystemAdministrator(account);
		switch (this.name) {
			case "Organization":
			case "Core.Organization":
				object = Organization.get(this.id);
				gotRights = gotRights || this.portalsCoreSvc.canManageOrganization(object as Organization, account);
				break;
			case "Role":
			case "Core.Role":
				object = Role.get(this.id) || new Role(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Role).organization, account);
				break;
			case "Module":
			case "Core.Module":
				object = Module.get(this.id) || new Module(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization(Organization.get((object as Module).SystemID), account);
				break;
			case "ContentType":
			case "Core.ContentType":
				object = ContentType.get(this.id) || new ContentType(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization(Organization.get((object as ContentType).SystemID), account);
				break;
			case "Expression":
			case "Core.Expression":
				object = Expression.get(this.id) || new Expression(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Expression).organization, account);
				break;
			case "Site":
			case "Core.Site":
				object = Site.get(this.id) || new Site(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Site).organization, account);
				break;
			case "Desktop":
			case "Core.Desktop":
				object = Desktop.get(this.id) || new Desktop(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Desktop).organization, account);
				break;
			case "Portlet":
			case "Core.Portlet":
				object = Portlet.get(this.id) || new Portlet(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canManageOrganization((object as Portlet).organization, account);
				break;
			case "SchedulingTask":
			case "Core.SchedulingTask":
				object = SchedulingTask.get(this.id) || new SchedulingTask({ SystemIDSystemID: this.portalsCoreSvc.activeOrganization.ID });
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as SchedulingTask).organization, account);
				break;
			case "Category":
			case "CMS.Category":
				object = Category.get(this.id) || new Category(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Category).organization, account) || this.authSvc.isModerator(this.portalsCoreSvc.name, "Category", (object as Category).Privileges);
				break;
			case "Content":
			case "CMS.Content":
				object = Content.get(this.id) || new Content(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Content).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Category", (object as Content).category.Privileges);
				if (!gotRights && ((object as Content).Status === "Draft" || (object as Content).Status === "Pending")) {
					gotRights = (object as Content).CreatedID === account.id;
				}
				break;
			case "Item":
			case "CMS.Item":
				object = Item.get(this.id) || new Item(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Item).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Item", (object as Item).contentType.Privileges);
				if (!gotRights && ((object as Item).Status === "Draft" || (object as Item).Status === "Pending")) {
					gotRights = (object as Item).CreatedID === account.id;
				}
				break;
			case "Link":
			case "CMS.Link":
				object = Link.get(this.id) || new Link(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Link).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Link", (object as Link).contentType.Privileges);
				if (!gotRights && ((object as Link).Status === "Draft" || (object as Link).Status === "Pending")) {
					gotRights = (object as Link).CreatedID === account.id;
				}
				break;
			case "Form":
			case "CMS.Form":
				object = Form.get(this.id) || new Form(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Form).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Form", (object as Form).contentType.Privileges);
				break;
			case "Crawler":
			case "CMS.Crawler":
				object = Crawler.get(this.id) || new Crawler(this.portalsCoreSvc.activeOrganization.ID);
				gotRights = gotRights || this.portalsCoreSvc.canModerateOrganization((object as Crawler).organization, account) || this.authSvc.isEditor(this.portalsCoreSvc.name, "Crawler", (object as Crawler).contentType.Privileges);
				break;
		}
		if (gotRights) {
			this.versions.merge(object.Versions);
			this.versions.forEach(verison => {
				if (verison["Creator"] === undefined) {
					const profile = UserProfile.get(verison.CreatedID);
					if (profile === undefined) {
						this.usersSvc.getProfileAsync(verison.CreatedID, () => {
							verison["Creator"] = UserProfile.contains(verison.CreatedID) ? UserProfile.get(verison.CreatedID).Name : "Unknown";
						});
					}
					else {
						verison["Creator"] = profile.Name;
					}
				}
			});
			this.title = await this.configSvc.getResourceAsync("versions.list", { total: object.TotalVersions || this.versions.length, title: object["Title"] });
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
			async () => this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("versions.processing")).then(() => this.portalsCoreSvc.rollbackAsync(this.name, this.id, version.ID, () => Promise.all([
				TrackingUtility.trackAsync({ title: this.title, category: "Versions", action: "Rollback" }),
				this.appFormsSvc.hideLoadingAsync(),
				this.configSvc.navigateBackAsync()
			]))),
			"{{default}}",
			"{{default}}"
		);
	}

}
