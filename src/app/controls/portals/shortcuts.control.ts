import { Component, OnInit, OnDestroy, Input } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { ConfigurationService, Shortcut } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";

@Component({
	selector: "control-cms-portals-shortcuts",
	templateUrl: "./shortcuts.control.html",
	styleUrls: ["./shortcuts.control.scss"]
})

export class ShortcutsControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	label = "Shortcuts";
	shortcuts = new Array<Shortcut>();

	get color() {
		return this.configSvc.color;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			PlatformUtility.invoke(() => {
				this.prepareAsync();
			}, 234);
		}
		else {
			AppEvents.on("App", info => {
				if (AppUtility.isEquals(info.args.Type, "Initialized")) {
					this.prepareAsync();
				}
			}, "Shortcuts:AppInitialized");
		}
		AppEvents.on(this.portalsCoreSvc.name, async info => {
			if (this.shortcuts.length > 0 && (AppUtility.isEquals(info.args.Type, "Changed") || AppUtility.isEquals(info.args.Type, "PortalsInitialized") || AppUtility.isEquals(info.args.Type, "CMSPortalsInitialized"))) {
				const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
				const module = await this.portalsCoreSvc.getActiveModuleAsync();
				const contentType = this.portalsCmsSvc.getDefaultContentTypeOfLink(module) || this.portalsCmsSvc.getDefaultContentTypeOfItem(module);
				if (AppUtility.isEquals(info.args.Object, "Organization")) {
					this.shortcuts[0].title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? this.portalsCoreSvc.activeOrganization.Title : "N/A" });
				}
				else {
					this.shortcuts[1].title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" });
				}
				this.shortcuts[3].url = this.portalsCoreSvc.getAppURL(contentType);
			}
		}, "Shortcuts:ActiveOrganizationModule");
	}

	ngOnDestroy() {
		AppEvents.off("App", "Shortcuts:AppInitialized");
		AppEvents.off(this.portalsCoreSvc.name, "Shortcuts:ActiveOrganizationModule");
	}

	private async prepareAsync() {
		this.label = await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.shortcuts");

		const shortcuts = this.configSvc.appConfig.options.extras["shortcuts"] || {};
		this.shortcuts = (shortcuts.items as Array<Shortcut> || []).map(shortcut => shortcut);

		const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
		this.shortcuts.insert({
			title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? organization.Title : "N/A" }),
			icon: {
				name: "business"
			},
			removable: false,
			onClick: async () => await this.changeOrganizationAsync()
		}, 0);

		const module = await this.portalsCoreSvc.getActiveModuleAsync();
		this.shortcuts.insert({
			title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" }),
			icon: {
				name: "albums"
			},
			removable: false,
			onClick: async () => await this.changeModuleAsync()
		}, 1);

		this.shortcuts.insert({
			title: shortcuts.contents as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.contents"),
			url: this.portalsCoreSvc.getRouterLink(undefined, "list", "all", "category"),
			icon: {
				name: "color-filter"
			},
			removable: false
		}, 2);

		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfItem(module) || this.portalsCmsSvc.getDefaultContentTypeOfLink(module);
		this.shortcuts.insert({
			title: shortcuts.others as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.others"),
			url: this.portalsCoreSvc.getAppURL(contentType),
			icon: {
				name: "newspaper"
			},
			removable: false
		}, 3);

		this.shortcuts.forEach((shortcut, order) => {
			if (shortcut.icon !== undefined && shortcut.icon.name !== undefined) {
				shortcut.icon.color = shortcut.icon.color || "medium";
			}
			shortcut.order = order;
			shortcut.editable = shortcut.editable !== undefined ? shortcut.editable : true;
			shortcut.removable = shortcut.removable !== undefined ? shortcut.removable : true;
			shortcut.onClick = shortcut.onClick !== undefined ? shortcut.onClick : async (e, i, s) => await this.navigateAsync(e, i, s);
		});
	}

	track(index: number, shortcut: Shortcut) {
		return `${shortcut.title}@${index}`;
	}

	async navigateAsync(event: Event, index: number, shortcut: Shortcut) {
		event.stopPropagation();
		await this.configSvc.navigateAsync(shortcut.direction, shortcut.url);
	}

	async changeOrganizationAsync() {
		console.log("Request to change organization");
	}

	async changeModuleAsync() {
		console.log("Request to change module");
	}

	async createAsync(event: Event) {
		event.stopPropagation();
		console.log("Request to create shortcut");
	}

	async updateAsync(event: Event, index: number, shortcut: Shortcut) {
		event.stopPropagation();
		console.log("Request to update shortcut");
	}

	async removeAsync(event: Event, index: number, shortcut: Shortcut) {
		event.stopPropagation();
		console.log("Request to remove shortcut");
	}

}
