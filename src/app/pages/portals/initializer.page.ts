import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Base as BaseModel } from "@app/models/base";
import { Organization, Role, Site, Desktop, Portlet, Module, ContentType, Expression } from "@app/models/portals.core.all";
import { Category, Content, Item, Link } from "@app/models/portals.cms.all";

@Component({
	selector: "page-portal-initializer",
	templateUrl: "./initializer.page.html",
	styleUrls: ["./initializer.page.scss"],
})

export class PortalInitializerPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.initializeAsync();
		}
		else {
			AppEvents.on("App", info => {
				if ("Initialized" === info.args.Type) {
					this.initializeAsync();
				}
			}, "Portal:Initialized");
		}
	}

	ngOnDestroy() {
		AppEvents.off("App", "Portal:Initialized");
	}

	private async initializeAsync() {
		if (this.configSvc.isDebug) {
			console.log("Initialize CMS Portals", this.configSvc.requestParams);
		}
		await TrackingUtility.trackScreenAsync("Initialize and open a view of CMS Portals", "/portals/initializer");
		const organizationID = this.configSvc.requestParams["SystemID"];
		let forward = false;
		let url: string;
		if (AppUtility.isNotEmpty(organizationID)) {
			let organization = Organization.get(organizationID);
			if (organization === undefined) {
				if (this.configSvc.isDebug) {
					console.log("<Portals Initializer>: prepare organization with a specified identity", organizationID);
				}
				await this.portalsCoreSvc.getOrganizationAsync(organizationID, _ => organization = Organization.get(organizationID), undefined, true);
			}
			if (organization !== undefined) {
				await this.portalsCoreSvc.setActiveOrganizationAsync(organization);
				const objectName = this.configSvc.requestParams["ObjectName"] as string;
				const objectID = this.configSvc.requestParams["ObjectID"] as string;
				let object: BaseModel;

				if (AppUtility.isNotEmpty(objectName) && AppUtility.isNotEmpty(objectID)) {
					switch (objectName.toLowerCase()) {
						case "organization":
						case "core.organization":
							object = Organization.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getOrganizationAsync(objectID, _ => object = Organization.get(objectID), undefined, true);
							}
							break;
						case "role":
						case "core.role":
							object = Role.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getRoleAsync(objectID, _ => object = Role.get(objectID), undefined, true);
							}
							break;
						case "site":
						case "core.site":
							object = Site.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getSiteAsync(objectID, _ => object = Site.get(objectID), undefined, true);
							}
							break;
						case "desktop":
						case "core.desktop":
							object = Desktop.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getDesktopAsync(objectID, _ => object = Desktop.get(objectID), undefined, true);
							}
							break;
						case "portlet":
						case "core.portlet":
							object = Portlet.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getPortletAsync(objectID, _ => object = Portlet.get(objectID), undefined, true);
							}
							break;
						case "module":
						case "core.module":
							object = Module.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getModuleAsync(objectID, _ => object = Module.get(objectID), undefined, true);
							}
							break;
						case "contenttype":
						case "content.type":
						case "content-type":
						case "core.contenttype":
						case "core.content.type":
							object = ContentType.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getContentTypeAsync(objectID, _ => object = ContentType.get(objectID), undefined, true);
							}
							break;
						case "expression":
						case "core.expression":
							object = Expression.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getExpressionAsync(objectID, _ => object = Expression.get(objectID), undefined, true);
							}
							break;
						case "category":
						case "cms.category":
							object = Category.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getCategoryAsync(objectID, _ => object = Category.get(objectID), undefined, true);
							}
							break;
						case "content":
						case "cms.content":
							forward = true;
							object = Content.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getContentAsync(objectID, _ => object = Content.get(objectID), undefined, true);
							}
							break;
						case "item":
						case "cms.item":
							forward = true;
							object = Item.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getItemAsync(objectID, _ => object = Item.get(objectID), undefined, true);
							}
							break;
						case "link":
						case "cms.link":
							forward = true;
							object = Link.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getLinkAsync(objectID, _ => object = Link.get(objectID), undefined, true);
							}
							break;
					}
					url = object !== undefined ? object.getRouterURI({ ID: object.ID }) : undefined;
					if (this.configSvc.isDebug) {
						console.log("<Portals Initializer>: prepare the requested object", objectName, objectID, object, url);
					}
				}

				if (this.portalsCoreSvc.activeModule === undefined) {
					if (this.configSvc.isDebug) {
						console.log("<Portals Initializer>: prepare module when no one was actived");
					}
					if (object !== undefined && object instanceof Module) {
						await this.portalsCoreSvc.setActiveModuleAsync(object as Module);
					}
					else {
						await this.portalsCoreSvc.getActiveModuleAsync();
					}
				}
			}
		}
		await this.navigateAsync(url, forward);
	}

	private async navigateAsync(url?: string, forward: boolean = true) {
		await (forward ? this.configSvc.navigateForwardAsync(url) : this.configSvc.navigateHomeAsync(url));
	}

}
