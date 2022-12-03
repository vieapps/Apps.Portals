import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef, NgZone } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";
import { Category } from "@app/models/portals.cms.category";

@Component({
	selector: "control-cms-portals-featured-contents",
	templateUrl: "./featured.contents.control.html",
	styleUrls: ["./featured.contents.control.scss"]
})

export class FeaturedContentsControl implements OnInit, OnDestroy {

	constructor(
		private changeDetector: ChangeDetectorRef,
		private zone: NgZone,
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
			this.prepareLabelsAsync().then(() => AppUtility.invoke(() => this.prepareContents(), 123));
		}
		else {
			AppEvents.on("App", info => {
				if ("Initialized" === info.args.Type) {
					this.prepareLabelsAsync().then(() => AppUtility.invoke(() => this.prepareContents(), 123));
				}
			}, `FeaturedContents:AppInitialized:${this._isPublished}`);
		}

		AppEvents.on(this.portalsCmsSvc.name, info => {
			const args = info.args;
			const organization = this.portalsCoreSvc.activeOrganization;
			if (organization !== undefined) {
				if ("Organization" === args.Type && "Changed" === args.Mode) {
					AppUtility.invoke(() => this.prepareContents(true), 234);
				}
				else if ("FeaturedContents" === args.Type && "Prepared" === args.Mode && organization.ID === args.ID) {
					AppUtility.invoke(() => this.prepareContents(true), 345, true);
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
		if (this.configSvc.isAuthenticated) {
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
				this.zone.run(() => this.changeDetector.detectChanges());
			}
			if (this.contents.length < 1) {
				AppEvents.broadcast(this.portalsCoreSvc.name, { Type: "FeaturedContents", Mode: "Request" });
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

interface FeaturedContent {
	ID: string;
	Title: string;
	Status: string;
	ThumbnailURI: string;
	Created: Date;
	LastModified: Date;
	StartDate: Date;
	PublishedTime: Date;
	SystemID: string;
	Category: string;
	CategoryTitle: string;
	ContentType: string;
	OriginalObject: CmsBaseModel;
}
