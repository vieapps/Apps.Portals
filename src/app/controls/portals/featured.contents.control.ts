import { Subscription, interval } from "rxjs";
import { Component, OnInit, OnDestroy, Input, NgZone, ChangeDetectorRef } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { PortalBase as BaseModel } from "@app/models/portals.base";
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
	private _preparer: Subscription;
	private _timer: Subscription;

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
			if (info.args.Type === "Initialized") {
				this.prepareLabelsAsync().then(() => this.prepareContents());
			}
			else if ("HomePage" === info.args.Type && "Open" === info.args.Mode && "Sidebar" === info.args.Source && this.configSvc.appConfig.URLs.home !== info.args.PreviousURL) {
				this.reprepareContents(this.configSvc.isDebug ? `Force to re-prepare (when navigated to homepage from sidebar) [${this.contents.length}]` : undefined);
			}
		}, `FeaturedContents:AppInitialized:${this._isPublished}`);

		AppEvents.on(this.portalsCmsSvc.name, info => {
			if (this.configSvc.isAuthenticated) {
				if ("Organization" === info.args.Type && "Changed" === info.args.Mode) {
					this.reprepareContents(this.configSvc.isDebug ? "Force to re-prepare (when change organization)" : undefined);
				}
				else if ("FeaturedContents" === info.args.Type && "Prepared" === info.args.Mode && this.portalsCoreSvc.activeOrganization.ID === info.args.ID) {
					this.reprepareContents(this.configSvc.isDebug ? `Force to re-prepare (when got update) [${this.contents.length}]` : undefined);
				}
				else if ("ThumbnailURI" === info.args.Type && info.args.ID !== undefined) {
					const content = this.contents.find(object => object.ID === info.args.ID);
					if (content !== undefined) {
						AppUtility.invoke(() => this.zone.run(() => {
							content.ThumbnailURI = AppUtility.isNotEmpty(info.args.ThumbnailURI) ? info.args.ThumbnailURI : BaseModel.noThumbnailURI;
							this.changeDetector.detectChanges();
							if (this.configSvc.isDebug) {
								const objectName = content.OriginalObject !== undefined && content.OriginalObject.contentType !== undefined ? content.OriginalObject.contentType.getObjectName(true) : "Unknown";
								console.log(`<FeaturedContents/ThumbnailURI/${this._isPublished}>: ${content.Title} [${objectName}#${content.ID}]`, info.args.ThumbnailURI, content.ThumbnailURI);
							}
						}), this.configSvc.isElectronApp ? 234 : 567);
					}
				}
			}
		}, `${(AppUtility.isNotEmpty(this.name) ? this.name + ":" : "")}FeaturedContents:${this._isPublished}`);
		this._timer = interval((this.configSvc.isElectronApp || this.configSvc.isDebug ? 30 : 180) * 1000).subscribe(_ => this.prepareContents(true, this.configSvc.isDebug ? `<FeaturedContents/Timer/${this._isPublished}>: Force to re-prepare [${this.contents.length}]` : undefined));
	}

	ngOnDestroy() {
		if (this._timer !== undefined) {
			this._timer.unsubscribe();
		}
		if (this._preparer !== undefined) {
			this._preparer.unsubscribe();
		}
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

	private prepareContents(force: boolean = false, message?: string) {
		if (this.configSvc.isAuthenticated && !this._preparing) {
			this._preparing = true;
			if (message !== undefined) {
				console.log(message);
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
			this.zone.run(() => {
				this.changeDetector.detectChanges();
				this._preparing = false;
			});
			if (this.contents.length < 1 && this._isPublished) {
				AppUtility.invoke(() => {
					if (this.contents.length < 1 && !this._preparing) {
						if (this.configSvc.isDebug) {
							console.log(`<FeaturedContents/${this._isPublished}>: Send request to prepare`);
						}
						AppEvents.broadcast(this.portalsCoreSvc.name, { Type: "FeaturedContents", Mode: "Request" });
					}
				}, 2345 * Math.random());
			}
		}
	}

	private reprepareContents(message: string) {
		this._preparer = this._preparer || interval(this.configSvc.isElectronApp || this.configSvc.isDebug ? 345 : 678).subscribe(_ => {
			this.prepareContents(true, message !== undefined ? `<FeaturedContents/${this._isPublished}>: ${message}` : undefined);
			AppUtility.invoke(() => {
				if (this._preparer !== undefined) {
					this._preparer.unsubscribe();
					this._preparer = undefined;
				}
			}, this.configSvc.isElectronApp || this.configSvc.isDebug ? 234 : 567);
		});
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
