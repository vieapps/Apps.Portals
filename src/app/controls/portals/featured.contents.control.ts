import { Component, OnInit, OnDestroy, Input } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";

@Component({
	selector: "control-cms-featured-contents",
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

	contents = new Array<CmsBaseModel>();
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
		this.amount = this.amount !== undefined ? this.amount : (this._isPublished ? amounts.published : amounts.updated) || 5;

		if (this.configSvc.isReady) {
			this.prepareAsync();
			this.prepareContents();
		}

		AppEvents.on(this.portalsCmsSvc.name, async info => {
			if (AppUtility.isEquals(info.args.Type, "FeaturedContentsPrepared")) {
				await this.prepareAsync();
				this.prepareContents();
			}
			else if (AppUtility.isEquals(info.args.Object, "CMS.Content") || AppUtility.isEquals(info.args.Object, "CMS.Item")) {
				this.prepareContents();
			}
		}, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents`);
	}

	ngOnDestroy() {
		AppEvents.off(this.portalsCmsSvc.name, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents`);
	}

	private async prepareAsync() {
		if (this.label === undefined) {
			this.label = this._isPublished
				? await this.configSvc.getResourceAsync("portals.cms.common.featured.published")
				: await this.configSvc.getResourceAsync("portals.cms.common.featured.updated");
		}
		else if (this.label.startsWith("{") && this.label.endsWith("}")) {
			this.label = await this.configSvc.getResourceAsync(this.label.substr(1, this.label.length - 2).trim());
		}
	}

	private prepareContents() {
		const filterBy: (content: CmsBaseModel) => boolean = AppUtility.isNotEmpty(this.status)
			? content => content.Status === this.status
			: _ => true;
		const orderBy = [{ name: "LastModified", reverse: true }];
		if (this._isPublished) {
			orderBy.insert({ name: "StartDate", reverse: true }, 0);
			orderBy.insert({ name: "PublishedTime", reverse: true }, 1);
		}
		this.contents = this.portalsCmsSvc.featuredContents.filter(filterBy).orderBy(orderBy).take(this.amount);
	}

	track(index: number, content: CmsBaseModel) {
		return `${content.ID}@${index}`;
	}

	async viewAsync(event: any, object: CmsBaseModel) {
		event.stopPropagation();
		if (this.portalsCoreSvc.activeOrganization === undefined || this.portalsCoreSvc.activeOrganization.ID !== object.SystemID) {
			await this.portalsCoreSvc.getActiveOrganizationAsync(object.SystemID);
		}
		if (this.portalsCoreSvc.activeModule === undefined || this.portalsCoreSvc.activeModule.ID !== object.RepositoryID) {
			await this.portalsCoreSvc.getActiveModuleAsync(object.RepositoryID);
		}
		this.configSvc.navigateForwardAsync(this.portalsCoreSvc.getAppURL(object.contentType, "view", object["category"] ? object["category"].Title : undefined, { ID: object.ID }));
	}

}
