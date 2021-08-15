import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppShortcut } from "@app/components/app.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Organization } from "@app/models/portals.core.organization";

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
			AppEvents.on("App", async info => {
				if ("Initialized" === info.args.Type) {
					await this.prepareAsync();
				}
			}, "Shortcuts:AppInitialized");
		}
		AppEvents.on(this.portalsCoreSvc.name, async info => {
			if (("Changed" === info.args.Type && "Organization" === info.args.Object) && this.shortcuts.length > 0) {
				const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
				const module = await this.portalsCoreSvc.getActiveModuleAsync();
				const contentType = this.portalsCmsSvc.getDefaultContentTypeOfLink(module) || this.portalsCmsSvc.getDefaultContentTypeOfItem(module);
				this.shortcuts[0].Title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? this.portalsCoreSvc.activeOrganization.Title : "N/A" });
				this.shortcuts[1].Title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" });
				this.shortcuts[3].Link = this.portalsCoreSvc.getAppURL(contentType);
			}
		}, "Shortcuts:ActiveOrganizationModule");
	}

	ngOnDestroy() {
		AppEvents.off("App", "Shortcuts:AppInitialized");
		AppEvents.off(this.portalsCoreSvc.name, "Shortcuts:ActiveOrganizationModule");
	}

	private async prepareAsync() {
		await Promise.all(this.portalsCoreSvc.activeOrganizations.map(id => this.portalsCoreSvc.getOrganizationAsync(id)));
		this.label = await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.shortcuts");

		const shortcuts = this.configSvc.appConfig.options.extras["shortcuts"] || {};
		this.shortcuts = (shortcuts.items as Array<AppShortcut> || []).map(shortcut => shortcut);

		const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
		this.shortcuts.insert({
			Title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? organization.Title : "N/A" }),
			Icon: {
				Name: "business"
			},
			Editable: false,
			Removable: true,
			OnClick: async _ => await this.changeOrganizationAsync(),
			OnRemove: async _ => await this.removeOrganizationAsync()
		}, 0);

		const module = await this.portalsCoreSvc.getActiveModuleAsync();
		this.shortcuts.insert({
			Title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" }),
			Icon: {
				Name: "albums"
			},
			Editable: false,
			Removable: false,
			OnClick: async () => await this.changeModuleAsync()
		}, 1);

		this.shortcuts.insert({
			Title: shortcuts.contents as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.contents"),
			Link: this.portalsCoreSvc.getRouterLink(undefined, "list", "all", "category"),
			Icon: {
				Name: "color-filter"
			},
			Editable: false,
			Removable: false
		}, 2);

		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfItem(module) || this.portalsCmsSvc.getDefaultContentTypeOfLink(module);
		this.shortcuts.insert({
			Title: shortcuts.others as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.others"),
			Link: this.portalsCoreSvc.getAppURL(contentType),
			Icon: {
				Name: "newspaper"
			},
			Editable: false,
			Removable: false
		}, 3);

		this.shortcuts.forEach((shortcut, order) => {
			if (shortcut.Icon !== undefined && shortcut.Icon.Name !== undefined) {
				shortcut.Icon.Color = shortcut.Icon.Color || "medium";
			}
			shortcut.Order = order;
			shortcut.Editable = shortcut.Editable !== undefined ? shortcut.Editable : true;
			shortcut.Removable = shortcut.Removable !== undefined ? shortcut.Removable : true;
			shortcut.OnClick = typeof shortcut.OnClick === "function" ? shortcut.OnClick : undefined;
			shortcut.OnRemove = typeof shortcut.OnRemove === "function" ? shortcut.OnRemove : undefined;
		});
	}

	track(index: number, shortcut: AppShortcut) {
		return `${shortcut.Title}@${index}`;
	}

	async navigateAsync(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		if (typeof shortcut.OnClick === "function") {
			shortcut.OnClick(shortcut, index, event);
		}
		else {
			await this.configSvc.navigateAsync(shortcut.Direction, shortcut.Link);
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

	async updateAsync(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		console.log("Request to update shortcut", index, shortcut);
	}

	async removeAsync(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		if (shortcut.OnRemove !== undefined) {
			shortcut.OnRemove(shortcut, index, event);
		}
	}

}
