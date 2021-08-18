import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter } from "@angular/core";
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

export class FeaturedContentsControl implements OnInit, OnDestroy, OnChanges {

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

	/** The event handler to run when the control was changed */
	@Output() change = new EventEmitter<any>();

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
			AppUtility.invoke(async () => await this.prepareLabelsAsync(), 13);
		}
		else {
			AppEvents.on("App", info => {
				if ("Initialized" === info.args.Type) {
					AppUtility.invoke(async () => await this.prepareLabelsAsync(), 13);
				}
			}, `FeaturedContents:AppInitialized:${this._isPublished}`);
		}

		AppEvents.on(this.portalsCmsSvc.name, info => {
			if ("FeaturedContentsPrepared" === info.args.Type || ("Changed" === info.args.Type && "Organization" === info.args.Object)) {
				AppUtility.invoke(async () => await this.prepareContentsAsync(true), 13);
			}
		}, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);
	}

	ngOnDestroy() {
		this.change.unsubscribe();
		AppEvents.off("App", `FeaturedContents:AppInitialized:${this._isPublished}`);
		AppEvents.off(this.portalsCmsSvc.name, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);
	}

	ngOnChanges(_: SimpleChanges) {
		AppUtility.invoke(async () => await this.prepareContentsAsync(), 13);
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

	private async prepareContentsAsync(force: boolean = false) {
		if (!this.configSvc.isAuthenticated) {
			return;
		}

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
			this.contents = this.portalsCmsSvc.featuredContents.map(content => ({
				ID: content.ID,
				Title: content.Title,
				Status: content.Status,
				ThumbnailURI: content.thumbnailURI,
				Created: new Date(content.Created),
				LastModified: new Date(content.LastModified),
				StartDate: new Date(content["StartDate"] || content.Created),
				PublishedTime: new Date(content["PublishedTime"] || content.Created),
				SystemID: content.SystemID,
				Category: content["category"],
				OriginalObject: content
			} as FeaturedContent)).filter(filterBy).orderBy(orderBy).take(this.amount);
		}

		if (this.contents.length < 1) {
			AppEvents.broadcast(this.portalsCoreSvc.name, { Mode: "RequestFeaturedContents" });
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
	Category: Category;
	OriginalObject: CmsBaseModel;
}
