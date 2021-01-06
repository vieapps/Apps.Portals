import { Component, OnInit, OnDestroy, Input } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
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
		this.amount = this.amount !== undefined ? this.amount : (this._isPublished ? amounts.published : amounts.updated) || 5;

		if (this.configSvc.isReady) {
			PlatformUtility.invoke(() => this.prepareAsync(), 1234);
		}
		else {
			AppEvents.on("App", info => {
				if (AppUtility.isEquals(info.args.Type, "Initialized")) {
					PlatformUtility.invoke(() => this.prepareAsync(), 1234);
				}
			}, `FeaturedContents:AppInitialized:${this._isPublished}`);
		}

		AppEvents.on(this.portalsCmsSvc.name, info => {
			if (AppUtility.isEquals(info.args.Type, "FeaturedContentsPrepared") || (AppUtility.isEquals(info.args.Type, "Changed") && (AppUtility.isEquals(info.args.Object, "Organization") || AppUtility.isEquals(info.args.Object, "Module")))) {
				PlatformUtility.invoke(() => {
					if (this.configSvc.isDebug) {
						console.log(`<Featured Contents>: fire event to update featured contents - Published: ${this._isPublished}`, info.args);
					}
					this.prepareAsync(true);
				}, 1234);
			}
		}, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);

		if (this.configSvc.isDebug) {
			console.log(`<Featured Contents>: control was initialized - Published: ${this._isPublished}`);
		}
	}

	ngOnDestroy() {
		AppEvents.off("App", `FeaturedContents:AppInitialized:${this._isPublished}`);
		AppEvents.off(this.portalsCmsSvc.name, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);
	}

	private async prepareAsync(force: boolean = false, prepareLabels: boolean = true) {
		if (!this._preparing) {
			this._preparing = true;
			if (prepareLabels) {
				await this.prepareLabelsAsync();
			}
			this.prepareContents(force);
			this._preparing = false;
		}
	}

	private async prepareLabelsAsync() {
		if (this.label === undefined) {
			this.label = this._isPublished
				? await this.configSvc.getResourceAsync("portals.cms.common.featured.published")
				: await this.configSvc.getResourceAsync("portals.cms.common.featured.updated");
		}
		else if (this.label.startsWith("{") && this.label.endsWith("}")) {
			this.label = await this.configSvc.getResourceAsync(this.label.substr(1, this.label.length - 2).trim());
		}
	}

	private prepareContents(force: boolean = false) {
		if (!this.contents.length || force) {
			const organizationID = this.portalsCoreSvc.activeOrganization !== undefined ? this.portalsCoreSvc.activeOrganization.ID : undefined;
			const filterBy: (content: FeaturedContent) => boolean = AppUtility.isNotEmpty(this.status)
				? content => content.OriginalObject.SystemID === organizationID && content.Status === this.status
				: content => content.OriginalObject.SystemID === organizationID;
			const orderBy = this._isPublished
				? [{ name: "StartDate", reverse: true }, { name: "PublishedTime", reverse: true }]
				: [];
			orderBy.push({ name: "LastModified", reverse: true });
			this.contents = this.portalsCmsSvc.featuredContents.map(content => {
				const category = content["category"];
				return {
					ID: content.ID,
					Title: content.Title,
					Created: content.Created,
					LastModified: content.LastModified,
					PublishedTime: content["PublishedTime"] || content.Created,
					Status: content.Status,
					ThumbnailURI: content.thumbnailURI,
					StartDate: content["StartDate"] || content.Created,
					Category: category !== undefined && typeof category === "object" ? category : undefined,
					OriginalObject: content
				} as FeaturedContent;
			}).filter(filterBy).orderBy(orderBy).take(this.amount);
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
		await this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(object.OriginalObject.contentType, "view", object.Category ? object.Category.Title : undefined, { ID: object.ID }));
	}

}

export interface FeaturedContent {
	ID: string;
	Title: string;
	Status: string;
	ThumbnailURI: string;
	Created: Date;
	LastModified: Date;
	PublishedTime: Date;
	StartDate?: string;
	Category?: Category;
	OriginalObject: CmsBaseModel;
}
