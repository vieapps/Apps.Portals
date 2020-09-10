import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { ConfigurationService } from "@services/configuration.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { PortalsCmsService } from "@services/portals.cms.service";
import { Base as BaseModel } from "@models/base";
import { Organization } from "@models/portals.core.organization";
import { Role } from "@models/portals.core.role";
import { Site } from "@models/portals.core.site";
import { Desktop } from "@models/portals.core.desktop";
import { Portlet } from "@models/portals.core.portlet";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Expression } from "@models/portals.core.expression";
import { Category } from "@models/portals.cms.category";
import { Content } from "@models/portals.cms.content";
import { Item } from "@models/portals.cms.item";
import { Link } from "@models/portals.cms.link";

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
		await TrackingUtility.trackAsync("Initialize and open a view of CMS Portals", "/portals/initializer");
		const organizationID = this.configSvc.requestParams["SystemID"];
		let url: string;
		if (AppUtility.isNotEmpty(organizationID)) {
			let organization = Organization.get(organizationID);
			if (organization === undefined) {
				await this.portalsCoreSvc.getOrganizationAsync(organizationID, _ => organization = Organization.get(organizationID), undefined, true);
			}
			if (organization !== undefined) {
				await this.portalsCoreSvc.setActiveOrganizationAsync(organization.ID);
				const objectName = this.configSvc.requestParams["ObjectName"] as string;
				const objectID = this.configSvc.requestParams["ObjectID"] as string;
				if (AppUtility.isNotEmpty(objectName) && AppUtility.isNotEmpty(objectID)) {
					let object: BaseModel;
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
							object = Content.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getContentAsync(objectID, _ => object = Content.get(objectID), undefined, true);
							}
							break;
						case "item":
						case "cms.item":
							object = Item.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getItemAsync(objectID, _ => object = Item.get(objectID), undefined, true);
							}
							break;
						case "link":
						case "cms.link":
							object = Link.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getLinkAsync(objectID, _ => object = Link.get(objectID), undefined, true);
							}
							break;
					}
					url = object !== undefined ? object.routerLink : undefined;
				}
			}
		}
		await this.navigateAsync(url);
	}

	private async navigateAsync(url?: string) {
		await this.configSvc.navigateHomeAsync(url);
	}

}
