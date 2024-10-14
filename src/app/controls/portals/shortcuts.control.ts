import { Component, OnInit, OnDestroy } from "@angular/core";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppShortcut } from "@app/components/app.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";
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

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.prepareLabelAsync().then(() => AppUtility.invoke(() => this.prepareShortcutsAsync(), 123, true));
		}
		else {
			AppEvents.on("App", info => {
				if ("Initialized" === info.args.Type) {
					this.prepareLabelAsync().then(() => AppUtility.invoke(() => this.prepareShortcutsAsync()));
				}
			}, "PortalsShortcutsEvents");
		}
		AppEvents.on("Session", info => {
			if ("LogIn" === info.args.Type) {
				this.prepareShortcutsAsync();
			}
		}, "PortalsShortcutsEvents");
		AppEvents.on(this.portalsCoreSvc.name, info => {
			if ("Changed" === info.args.Mode && ("Organization" === info.args.Type || "Module" === info.args.Type)) {
				this.updateShortcutsAsync();
			}
			else if ("FeaturedContents" === info.args.Type && "Prepared" === info.args.Mode) {
				this.updateShortcutsAsync();
			}
		}, "PortalsShortcutsEvents");
	}

	ngOnDestroy() {
		AppEvents.off("App", "PortalsShortcutsEvents");
		AppEvents.off("Session", "PortalsShortcutsEvents");
		AppEvents.off(this.portalsCoreSvc.name, "PortalsShortcutsEvents");
	}

	private async prepareLabelAsync() {
		this.label = await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.shortcuts");
	}

	private async prepareShortcutsAsync() {
		const shortcuts = this.configSvc.appConfig.options.extras["shortcuts"] || {};
		this.shortcuts = (shortcuts.items as Array<AppShortcut> || []).map(shortcut => shortcut);

		const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
		this.shortcuts.insert({
			Title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? organization.Title : "N/A" }),
			Icon: { Name: "business" },
			Editable: false,
			Removable: true,
			OnClick: () => this.changeOrganizationAsync(),
			OnRemove: () => this.removeOrganizationAsync(),
			OtherAction: this.portalsCoreSvc.allowSelectActiveOrganization || this.authSvc.isSystemAdministrator()
				? { Icon: "add-circle-outline", OnClick: () => this.selectOrganizationAsync(this.portalsCoreSvc.activeOrganization !== undefined ? this.portalsCoreSvc.activeOrganization.ID : undefined) }
				: undefined
		}, 0);

		const module = await this.portalsCoreSvc.getActiveModuleAsync();
		this.shortcuts.insert({
			Title: AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" }),
			Icon: { Name: "albums" },
			Editable: false,
			Removable: false,
			OnClick: () => this.changeModuleAsync()
		}, 1);

		this.shortcuts.insert({
			Title: shortcuts.contents as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.contents"),
			Link: this.configSvc.isAuthenticated ? this.portalsCoreSvc.getRouterLink(undefined, "list", "all", "category") : undefined,
			Icon: { Name: "logo-firebase" },
			Editable: false,
			Removable: false,
			OnClick: shortcut => this.configSvc.navigateForwardAsync(shortcut.Link).then(() => AppEvents.broadcast("OpenSidebar", { Name: "cms" }))
		}, 2);

		const contentType = this.portalsCmsSvc.getDefaultContentTypeOfForm(module) || this.portalsCmsSvc.getDefaultContentTypeOfItem(module) || this.portalsCmsSvc.getDefaultContentTypeOfLink(module);
		this.shortcuts.insert({
			Title: shortcuts.others as string || await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.labels.others"),
			Link: this.portalsCoreSvc.getAppURL(contentType),
			Icon: { Name: "newspaper" },
			Editable: false,
			Removable: false,
			OnClick: shortcut => this.configSvc.navigateForwardAsync(shortcut.Link).then(() => AppEvents.broadcast("OpenSidebar", { Name: "cms" }))
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

	private async updateShortcutsAsync() {
		if (this.shortcuts.length > 0) {
			const organization = await this.portalsCoreSvc.getActiveOrganizationAsync();
			this.shortcuts[0].Title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.organization"), { organization: organization !== undefined ? this.portalsCoreSvc.activeOrganization.Title : "N/A" });
			const module = await this.portalsCoreSvc.getActiveModuleAsync();
			this.shortcuts[1].Title = AppUtility.format(await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.active.module"), { module: module !== undefined ? module.Title : "N/A" });
			const contentType = this.portalsCmsSvc.getDefaultContentTypeOfForm(module) || this.portalsCmsSvc.getDefaultContentTypeOfItem(module) || this.portalsCmsSvc.getDefaultContentTypeOfLink(module);
			this.shortcuts[3].Link = this.portalsCoreSvc.getAppURL(contentType);
		}
	}

	async changeOrganizationAsync() {
		const activeOrganizations = await this.portalsCoreSvc.getActiveOrganizationsAsync();
		const activeOrganizationID = this.portalsCoreSvc.activeOrganization !== undefined ? this.portalsCoreSvc.activeOrganization.ID : undefined;
		if (this.authSvc.isSystemAdministrator() && activeOrganizations.length < 2) {
			await this.selectOrganizationAsync(activeOrganizationID);
		}
		else if (activeOrganizations.length > 1) {
			if (activeOrganizations.length > 3) {
				await this.selectOrganizationAsync(activeOrganizationID, activeOrganizations);
			}
			else {
				await this.appFormsSvc.showAlertAsync(
					await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.select.organization"),
					undefined,
					undefined,
					organizationID => this.portalsCoreSvc.setActiveOrganization(this.portalsCoreSvc.getOrganization(organizationID, false)),
					await this.configSvc.getResourceAsync("common.buttons.select"),
					await this.configSvc.getResourceAsync("common.buttons.cancel"),
					activeOrganizations.sortBy("Alias").map(organization => ({
						name: "organizationID",
						type: "radio",
						label: organization.Title,
						value: organization.ID,
						checked: organization.ID === activeOrganizationID
					})),
					true
				);
			}
		}
	}

	private async selectOrganizationAsync(selectedID: string, organizations?: Organization[]) {
		await this.appFormsSvc.showModalAsync(
			DataLookupModalPage,
			{
				organizationID: undefined,
				moduleID: undefined,
				contentTypeID: undefined,
				objectName: "Organization",
				nested: false,
				multiple: false,
				sortBy: { Title: "Ascending" },
				labels: { title: await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.select.organization") },
				preselectedID: selectedID,
				predefinedItems: organizations !== undefined && !!organizations.length ? organizations.map(organization => ({
					ID: organization.ID,
					Title: organization.Title
				})) : undefined
			},
			data => this.portalsCoreSvc.setActiveOrganization(this.portalsCoreSvc.getOrganization(data !== undefined && !!data.length ? data.first().ID : selectedID, false)),
			true,
			true
		);
	}

	async removeOrganizationAsync() {
		await this.appFormsSvc.showConfirmAsync(
			await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.messages.removeOrganization", { name: this.portalsCoreSvc.activeOrganization.Title }),
			() => this.portalsCoreSvc.removeActiveOrganization(this.portalsCoreSvc.activeOrganization.ID),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async changeModuleAsync() {
		const activeOrganization = this.portalsCoreSvc.activeOrganization;
		if (activeOrganization !== undefined) {
			if (activeOrganization.modules.length > 1) {
				const activeModuleID = this.portalsCoreSvc.activeModule !== undefined ? this.portalsCoreSvc.activeModule.ID : undefined;
				await this.appFormsSvc.showAlertAsync(
					await this.configSvc.getResourceAsync("portals.cms.common.shortcuts.select.module"),
					undefined,
					undefined,
					moduleID => this.portalsCoreSvc.setActiveModule(this.portalsCoreSvc.getModule(moduleID, false)),
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
				this.portalsCoreSvc.setActiveModule(activeOrganization.defaultModule);
			}
		}
	}

	create(event: Event) {
		event.stopPropagation();
		console.log("Request to create shortcut");
	}

	click(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		if (shortcut.OtherAction !== undefined && shortcut.OtherAction.OnClick !== undefined) {
			shortcut.OtherAction.OnClick(shortcut, index, event);
		}
	}

	update(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		console.log("Request to update shortcut", index, shortcut);
	}

	remove(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		if (shortcut.OnRemove !== undefined) {
			shortcut.OnRemove(shortcut, index, event);
		}
	}

	navigate(shortcut: AppShortcut, index: number, event: Event) {
		event.stopPropagation();
		if (typeof shortcut.OnClick === "function") {
			shortcut.OnClick(shortcut, index, event);
		}
		else {
			this.configSvc.navigateAsync(shortcut.Direction, shortcut.Link);
		}
	}

	track(index: number, shortcut: AppShortcut) {
		return `${shortcut.Title}@${index}`;
	}

}
