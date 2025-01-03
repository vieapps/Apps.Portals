import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Base as BaseModel } from "@app/models/base";
import { Organization, Role, Site, Desktop, Portlet, Module, ContentType, Expression } from "@app/models/portals.core.all";
import { Category, Content, Item, Link, Form } from "@app/models/portals.cms.all";

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
		TrackingUtility.trackAsync({ title: "Initialize and open a view of CMS Portals", campaignUrl: "/portals/initializer", category: "Home", action: "Initialize" }).then(() => console.log("<Initializer>: Initialize CMS Portals", this.configSvc.requestParams));
		const organizationID = this.configSvc.requestParams["SystemID"];
		let url: string;
		if (AppUtility.isNotEmpty(organizationID)) {
			let organization = await this.setActiveOrganizationAsync(organizationID);
			if (organization !== undefined) {
				const objectID = this.configSvc.requestParams["ObjectID"] as string;
				const contentTypeID = this.configSvc.requestParams["RepositoryEntityID"] as string;
				let contentType = ContentType.get(contentTypeID);
				if (contentType === undefined && contentTypeID !== undefined && contentTypeID.length == 32) {
					await this.portalsCoreSvc.getContentTypeAsync(contentTypeID, async _ => {
						contentType = ContentType.get(contentTypeID);
						if (contentType !== undefined && contentType.SystemID !== organization.ID) {
							organization = await this.setActiveOrganizationAsync(contentType.SystemID);
						}
					}, undefined, true);
				}
				const objectName = contentType !== undefined ? contentType.getObjectName(true) : this.configSvc.requestParams["ObjectName"] as string;
				let object: BaseModel;

				if (AppUtility.isNotEmpty(objectName) && AppUtility.isNotEmpty(objectID)) {
					switch (objectName.toLowerCase()) {
						case "organization":
						case "core.organization":
							object = Organization.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getOrganizationAsync(objectID, async _ => {
									object = Organization.get(objectID);
									if (object !== undefined && object.ID !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object.ID);
									}
								}, undefined, true);
							}
							else if (object.ID !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object.ID);
							}
							break;
						case "role":
						case "core.role":
							object = Role.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getRoleAsync(objectID, async _ => {
									object = Role.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "site":
						case "core.site":
							object = Site.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getSiteAsync(objectID, async _ => {
									object = Site.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "desktop":
						case "core.desktop":
							object = Desktop.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getDesktopAsync(objectID, async _ => {
									object = Desktop.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "portlet":
						case "core.portlet":
							object = Portlet.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getPortletAsync(objectID, async _ => {
									object = Portlet.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "module":
						case "core.module":
							object = Module.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getModuleAsync(objectID, async _ => {
									object = Module.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "contenttype":
						case "content.type":
						case "content-type":
						case "core.contenttype":
						case "core.content.type":
							object = ContentType.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getContentTypeAsync(objectID, async _ => {
									object = ContentType.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "expression":
						case "core.expression":
							object = Expression.get(objectID);
							if (object === undefined) {
								await this.portalsCoreSvc.getExpressionAsync(objectID, async _ => {
									object = Expression.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "category":
						case "cms.category":
							object = Category.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getCategoryAsync(objectID, async _ => {
									object = Category.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "content":
						case "cms.content":
							object = Content.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getContentAsync(objectID, async _ => {
									object = Content.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "item":
						case "cms.item":
							object = Item.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getItemAsync(objectID, async _ => {
									object = Item.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "link":
						case "cms.link":
							object = Link.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getLinkAsync(objectID, async _ => {
									object = Link.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
						case "form":
						case "cms.form":
							object = Form.get(objectID);
							if (object === undefined) {
								await this.portalsCmsSvc.getFormAsync(objectID, async _ => {
									object = Form.get(objectID);
									if (object !== undefined && object["SystemID"] !== organization.ID) {
										organization = await this.setActiveOrganizationAsync(object["SystemID"]);
									}
								}, undefined, true);
							}
							else if (object["SystemID"] !== organization.ID) {
								organization = await this.setActiveOrganizationAsync(object["SystemID"]);
							}
							break;
					}
					url = object !== undefined ? object.getRouterURI({ ID: object.ID }) : undefined;
					console.log("<Initializer>: Prepare the requested object" + "\nObject: " + objectName + "\nID: " + objectID + "\nURL: " + url, object);
				}

				if (this.portalsCoreSvc.activeModule === undefined) {
					console.log("<Initializer>: Prepare modules when got no active");
					if (object !== undefined && object instanceof Module) {
						this.portalsCoreSvc.setActiveModule(object as Module);
					}
					else {
						await this.portalsCoreSvc.getActiveModuleAsync();
					}
				}
			}
		}
		this.configSvc.navigateRootAsync(url || "/home");
	}

	private async setActiveOrganizationAsync(organizationID: string, additional?: string) {
		let organization = Organization.get(organizationID);
		if (organization === undefined) {
			console.log(`<Initializer>: Prepare active organization ${additional || ""}`, organizationID);
			await this.portalsCoreSvc.getOrganizationAsync(organizationID, _ => organization = Organization.get(organizationID), undefined, true);
		}
		if (organization !== undefined) {
			console.log(`<Initializer>: Set active organization ${additional || ""}`, organization);
			this.portalsCoreSvc.setActiveOrganization(organization);
		}
		return organization;
	}

}
