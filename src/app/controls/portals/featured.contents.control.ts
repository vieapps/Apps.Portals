import { Component, OnInit, OnDestroy, Input, NgZone, ChangeDetectorRef } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { FeaturedContent } from "@app/models/portals.cms.base";
import { Category } from "@app/models/portals.cms.category";

@Component({
	selector: "control-cms-portals-featured-contents",
	templateUrl: "./featured.contents.control.html",
	styleUrls: ["./featured.contents.control.scss"]
})

export class FeaturedContentsControl implements OnInit, OnDestroy {

	constructor(
		private zone: NgZone,
		private changeDetector: ChangeDetectorRef,
		private configSvc: ConfigurationService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	@Input() name: string;
	@Input() label: string;
	@Input() status: string;
	@Input() orderBy: string;
	@Input() amount: number;

	contents = new Array<FeaturedContent>();
	private _isPublished = false;
	private _preparing = false;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	get header() {
		return this.label === undefined || this.label.startsWith("{") && this.label.endsWith("}")
			? this._isPublished ? "Published" : "Updated"
			: this.label;
	}

	ngOnInit() {
		this.orderBy = AppUtility.isNotEmpty(this.orderBy) ? this.orderBy : "LastModified";
		this._isPublished = AppUtility.isNotEmpty(this.orderBy) && !AppUtility.isEquals(this.orderBy, "LastModified");

		const amounts = this.configSvc.appConfig.options.extras["featured"] || {};
		this.amount = this.amount !== undefined ? this.amount : (this._isPublished ? amounts.published : amounts.updated) || 7;

		if (this.configSvc.isReady) {
			this.prepareLabelsAsync();
		}
		
		AppEvents.on("App", info => {
			if ("Initialized" === info.args.Type || ("HomePage" === info.args.Type && "Open" === info.args.Mode)) {
				this.prepareLabelsAsync().then(() => this.prepareContents());
			}
		}, `FeaturedContents:AppInitialized:${this._isPublished}`);

		AppEvents.on(this.portalsCmsSvc.name, info => {
			const organization = this.portalsCoreSvc.activeOrganization;
			if (organization !== undefined) {
				if ("Organization" === info.args.Type && "Changed" === info.args.Mode) {
					AppUtility.invoke(() => {
						if (!this._preparing) {
							if (this.configSvc.isDebug) {
								console.log("<FeaturedContents>: Prepare when change active organization");
							}
							this.prepareContents(true);
						}
					}, 789 * Math.random());
				}
				else if ("FeaturedContents" === info.args.Type && "Prepared" === info.args.Mode && organization.ID === info.args.ID) {
					AppUtility.invoke(() => {
						if (!this._preparing) {
							if (this.configSvc.isDebug) {
								console.log("<FeaturedContents>: Prepare when got updated");
							}
							this.prepareContents(true);
						}
					}, 789 * Math.random());
				}
				else if (organization.ID === info.args.SystemID && !!info.args.ID && "Thumbnail" === info.args.Type && !!info.args.ThumbnailURI) {
					AppUtility.invoke(() => {
						const content = this.contents.find(object => object.ID === info.args.ID);
						if (content !== undefined) {
							content.ThumbnailURI = info.args.ThumbnailURI;
							if (this.configSvc.isDebug) {
								console.log(`<FeaturedContents/ThumbnailURI>: ${content.Title} (#${info.args.ID})`);
							}
						}
					}, 456);
				}
			}
		}, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);
	}

	ngOnDestroy() {
		AppEvents.off("App", `FeaturedContents:AppInitialized:${this._isPublished}`);
		AppEvents.off(this.portalsCmsSvc.name, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);
	}

	private async prepareLabelsAsync() {
		if (this.label === undefined) {
			this.label = this._isPublished
				? await this.configSvc.getResourceAsync("portals.cms.common.featured.published")
				: await this.configSvc.getResourceAsync("portals.cms.common.featured.updated");
		}
		else if (this.label.startsWith("{") && this.label.endsWith("}")) {
			this.label = await this.configSvc.getResourceAsync(this.label.substring(1, this.label.length - 2).trim());
		}
	}

	private prepareContents(force: boolean = false) {
		if (this.configSvc.isAuthenticated && !this._preparing) {
			this._preparing = true;
			if (this.contents.length < 1 || force) {
				const organization = this.portalsCoreSvc.activeOrganization;
				const organizationID = organization !== undefined ? organization.ID : undefined;
				const filterBy: (content: FeaturedContent) => boolean = AppUtility.isNotEmpty(this.status)
					? content => content.SystemID === organizationID && content.Status === this.status
					: content => content.SystemID === organizationID;
				const orderBy = this._isPublished
					? [{ name: "StartDate", reverse: true }, { name: "PublishedTime", reverse: true }]
					: [];
				orderBy.push({ name: "LastModified", reverse: true });
				const gotModules = organization !== undefined && organization.modules.length > 1;
				this.contents = this.portalsCmsSvc.featuredContents.map(content => {
					const module = gotModules && !!content.module ? `${content.module.Title} > ` : "";
					const contentType = content.contentType;
					const category = content["category"] as Category;
					return {
						ID: content.ID,
						Title: content.Title,
						Status: content.Status,
						ThumbnailURI: content.thumbnailURI,
						Created: new Date(content.Created),
						LastModified: new Date(content.LastModified),
						StartDate: new Date(content["StartDate"] || content.Created),
						PublishedTime: new Date(content["PublishedTime"] || content.LastModified),
						SystemID: content.SystemID,
						Category: !!category ? `${module}${category.FullTitle}` : undefined,
						CategoryTitle: !!category ? category.Title : undefined,
						ContentType: !!category || !!!contentType ? undefined : module + contentType.Title,
						OriginalObject: content
					} as FeaturedContent;
				}).filter(filterBy).orderBy(orderBy).take(this.amount);
			}
			this.zone.run(() => this.changeDetector.detectChanges());
			AppUtility.invoke(() => this._preparing = false, 789 * Math.random());
			if (this.contents.length < 1) {
				AppUtility.invoke(() => {
					if (this.contents.length < 1 && !this._preparing) {
						if (this.configSvc.isDebug) {
							console.log("<FeaturedContents>: Send request to prepare");
						}
						AppEvents.broadcast(this.portalsCoreSvc.name, { Type: "FeaturedContents", Mode: "Request" });
					}
				}, 2345 * Math.random());
			}
		}
	}

	track(index: number, content: FeaturedContent) {
		return `${content.ID}@${index}`;
	}

	async viewAsync(event: any, object: FeaturedContent) {
		event.stopPropagation();
		if (this.portalsCoreSvc.activeOrganization === undefined || this.portalsCoreSvc.activeOrganization.ID !== object.OriginalObject.SystemID) {
			await this.portalsCoreSvc.getActiveOrganizationAsync(object.OriginalObject.SystemID);
		}
		if (this.portalsCoreSvc.activeModule === undefined || this.portalsCoreSvc.activeModule.ID !== object.OriginalObject.RepositoryID) {
			await this.portalsCoreSvc.getActiveModuleAsync(object.OriginalObject.RepositoryID);
		}
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(object.OriginalObject.contentType, "view", object.Category ? object.CategoryTitle : undefined, { ID: object.ID }));
	}

}
