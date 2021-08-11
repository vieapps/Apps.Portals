import { Component, OnInit, OnDestroy, Input } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility, AppShortcut } from "@app/components/app.utility";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
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
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	label = "Shortcuts";
	shortcuts = new Array<AppShortcut>();

	get color() {
		return this.configSvc.color;
	}

	get isAuthenticated() {
		return this.configSvc.isAuthenticated;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.prepareAsync();
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
				this.shortcuts[1].title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" });
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
		this.shortcuts = (shortcuts.items as Array<AppShortcut> || []).map(shortcut => shortcut);

		const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
		this.shortcuts.insert({
			title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? organization.Title : "N/A" }),
			icon: {
				name: "business"
			},
			editable: false,
			removable: true,
			onClick: async () => await this.changeOrganizationAsync(),
			onRemove: async () => await this.removeOrganizationAsync()
		}, 0);

		const module = await this.portalsCoreSvc.getActiveModuleAsync();
		this.shortcuts.insert({
			title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" }),
			icon: {
				name: "albums"
			},
			editable: false,
			removable: false,
			onClick: async () => await this.changeModuleAsync()
		}, 1);

		this.shortcuts.insert({
			title: shortcuts.contents as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.contents"),
			url: this.portalsCoreSvc.getRouterLink(undefined, "list", "all", "category"),
			icon: {
				name: "color-filter"
			},
			editable: false,
			removable: false
		}, 2);

		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfItem(module) || this.portalsCmsSvc.getDefaultContentTypeOfLink(module);
		this.shortcuts.insert({
			title: shortcuts.others as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.others"),
			url: this.portalsCoreSvc.getAppURL(contentType),
			icon: {
				name: "newspaper"
			},
			editable: false,
			removable: false
		}, 3);

		this.shortcuts.forEach((shortcut, order) => {
			if (shortcut.icon !== undefined && shortcut.icon.name !== undefined) {
				shortcut.icon.color = shortcut.icon.color || "medium";
			}
			shortcut.order = order;
			shortcut.editable = shortcut.editable !== undefined ? shortcut.editable : true;
			shortcut.removable = shortcut.removable !== undefined ? shortcut.removable : true;
			shortcut.onClick = typeof shortcut.onClick === "function" ? shortcut.onClick : undefined;
			shortcut.onRemove = typeof shortcut.onRemove === "function" ? shortcut.onRemove : undefined;
		});
	}

	track(index: number, shortcut: AppShortcut) {
		return `${shortcut.title}@${index}`;
	}

	async navigateAsync(event: Event, index: number, shortcut: AppShortcut) {
		event.stopPropagation();
		if (shortcut.onClick !== undefined) {
			shortcut.onClick(event, index, shortcut);
		}
		else {
			await this.configSvc.navigateAsync(shortcut.direction, shortcut.url);
		}
	}

	async changeOrganizationAsync() {
		const activeOrganizations = await this.portalsCoreSvc.getActiveOrganizationsAsync();
		if (this.authSvc.isSystemAdministrator() && activeOrganizations.length < 2) {
			await this.configSvc.navigateHomeAsync(this.portalsCoreSvc.getRouterLink(undefined, "list", "all", "organization", "core"));
		}
		else if (this.isAuthenticated && activeOrganizations.length > 1) {
			const activeOrganizationID = this.portalsCoreSvc.activeOrganization !== undefined ? this.portalsCoreSvc.activeOrganization.ID : undefined;
			await this.appFormsSvc.showAlertAsync(
				await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.select.organization"),
				undefined,
				undefined,
				async organizationID => await this.portalsCoreSvc.setActiveOrganizationAsync(this.portalsCoreSvc.getOrganization(organizationID, false)),
				await this.configSvc.getResourceAsync("common.buttons.select"),
				await this.configSvc.getResourceAsync("common.buttons.cancel"),
				activeOrganizations.sortBy("Alias").map(organization => ({
					name: "organizationID",
					type: "radio",
					label: organization.Alias + " - " + organization.Title,
					value: organization.ID,
					checked: organization.ID === activeOrganizationID
				})),
				true
			);
		}
	}

	async removeOrganizationAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.messages.removeOrganization", { name: this.portalsCoreSvc.activeOrganization.Title }),
			undefined,
			async () => await this.portalsCoreSvc.removeActiveOrganizationAsync(this.portalsCoreSvc.activeOrganization.ID),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async changeModuleAsync() {
		const activeOrganization = this.portalsCoreSvc.activeOrganization;
		if (this.isAuthenticated && activeOrganization !== undefined) {
			if (activeOrganization.modules.length > 1) {
				const activeModuleID = this.portalsCoreSvc.activeModule !== undefined ? this.portalsCoreSvc.activeModule.ID : undefined;
				await this.appFormsSvc.showAlertAsync(
					await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.select.module"),
					undefined,
					undefined,
					async moduleID => await this.portalsCoreSvc.setActiveModuleAsync(this.portalsCoreSvc.getModule(moduleID, false)),
					await this.configSvc.getResourceAsync("common.buttons.select"),
					await this.configSvc.getResourceAsync("common.buttons.cancel"),
					activeOrganization.modules.sortBy("Title").map(module => ({
						name: "moduleID",
						type: "radio",
						label: module.Title,
						value: module.ID,
						checked: module.ID === activeModuleID
					})),
					true
				);
			}
			else if (this.portalsCoreSvc.activeModule === undefined) {
				await this.portalsCoreSvc.setActiveModuleAsync(activeOrganization.defaultModule);
			}
		}
	}

	async createAsync(event: Event) {
		event.stopPropagation();
		console.log("Request to create shortcut");
	}

	async updateAsync(event: Event, index: number, shortcut: AppShortcut) {
		event.stopPropagation();
		console.log("Request to update shortcut");
	}

	async removeAsync(event: Event, index: number, shortcut: AppShortcut) {
		event.stopPropagation();
		if (shortcut.onRemove !== undefined) {
			shortcut.onRemove(event, index, shortcut);
		}
	}

}
