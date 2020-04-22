import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService, AppFormsLookupValue } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { UsersService } from "@services/users.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { Desktop } from "@models/portals.core.desktop";
import { DesktopsSelectorModalPage } from "@controls/portals/desktop.selector.modal.page";

@Component({
	selector: "page-portals-core-desktops-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class DesktopsUpdatePage implements OnInit {
	constructor(
		public configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private usersSvc: UsersService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private desktop: Desktop;
	private organization: Organization;
	private canManageOrganizations = false;
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.desktop = Desktop.get(this.configSvc.requestParams["ID"]);

		this.organization = this.desktop !== undefined
			? Organization.get(this.desktop.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.desktop.SystemID, _ => this.organization = Organization.get(this.desktop.SystemID), undefined, true);
		}

		this.canManageOrganizations = this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (this.canManageOrganizations) {
			await this.initializeFormAsync();
		}
		else {
			await this.appFormsSvc.showToastAsync("Hmmmmmm....");
			await this.configSvc.navigateBackAsync();
		}
	}

	private async initializeFormAsync() {
		this.desktop = this.desktop || new Desktop(this.organization.ID);
		if (this.organization === undefined || this.organization.ID === "" || this.organization.ID !== this.desktop.SystemID) {
			await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.desktops.title.${(this.desktop.ID === "" ? "create" : "update")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(this.desktop.ID === "" ? "create" : "update")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		if (this.desktop.ID === "") {
			this.desktop.ParentID = this.configSvc.requestParams["ParentID"];
			this.desktop.SEOSettings = { SEOInfo: { Title: "" } };
		}

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onPreCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.desktops.update.segments.basic")),
			new AppFormsSegment("display", await this.configSvc.getResourceAsync("portals.desktops.update.segments.display")),
			new AppFormsSegment("seo", await this.configSvc.getResourceAsync("portals.desktops.update.segments.seo"))
		];
		if (this.desktop.ID !== "") {
			formSegments.push(new AppFormsSegment("attachments", await this.configSvc.getResourceAsync("portals.desktops.update.segments.attachments")));
		}
		if (onPreCompleted !== undefined) {
			onPreCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onPreCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "desktop", "form-controls");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.organization.Title },
				Options: {
					Label: "{{portals.desktops.controls.Organization}}",
					ReadOnly: true
				}
			},
			0
		);

		if (this.desktop.ID === "") {
			AppUtility.insertAt(
				formConfig,
				{
					Name: "CopyFromID",
					Type: "Lookup",
					Segment: "basic",
					Options: {
						Label: "{{portals.desktops.controls.CopyFromID.label}}",
						Description: "{{portals.desktops.controls.CopyFromID.description}}"
					}
				},
				1
			);
		}

		const parentDesktop = this.desktop.Parent;
		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID"));
		control.Type = "Lookup";
		control.Extras = { LookupDisplayValues: parentDesktop !== undefined ? [{ Value: parentDesktop.ID, Label: parentDesktop.FullTitle }] : undefined };
		control.Options.LookupOptions = {
			Multiple: false,
			OnDelete: (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			},
			ModalOptions: {
				Component: DesktopsSelectorModalPage,
				ComponentProps: {
					multiple: false,
					organizationID: this.organization.ID,
					excludedIDs: this.desktop.ID === "" ? undefined : [this.desktop.ID]
				},
				OnDismiss: (data, formControl) => {
					if (AppUtility.isArray(data, true) && data[0] !== formControl.value) {
						const desktop = Desktop.get(data[0]);
						formControl.setValue(desktop.ID);
						formControl.lookupDisplayValues = [{ Value: desktop.ID, Label: desktop.FullTitle }];
					}
				}
			}
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "CopyFromID"));
		if (control !== undefined) {
			control.Options.LookupOptions = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ParentID")).Options.LookupOptions;
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Language"));
		control.Options.SelectOptions.Interface = "popover";
		control.Options.SelectOptions.Values = this.configSvc.languages.map(language => {
			return { Value: language.Value, Label: language.Label };
		});
		AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: undefined, Label: await this.configSvc.getResourceAsync("portals.common.unspecified") }, 0);

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Template"));
		control.Options.Rows = 18;
		control.Options.Icon = {
			Name: "color-wand",
			OnClick: (event, formControl) => console.warn("Click icon to generate the template", event, formControl)
		};

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "UISettings"));
		control.Options.Label = control.Options.Label === undefined ? undefined : control.Options.Label.replace("portals.desktops", "portals.common");
		control.Options.Description = control.Options.Description === undefined ? undefined : control.Options.Description.replace("portals.desktops", "portals.common");
		control.Options.PlaceHolder = control.Options.PlaceHolder === undefined ? undefined : control.Options.PlaceHolder.replace("portals.desktops", "portals.common");
		control.SubControls.Controls.forEach(ctrl => {
			ctrl.Options.Label = ctrl.Options.Label === undefined ? undefined : ctrl.Options.Label.replace("portals.desktops", "portals.common");
			ctrl.Options.Description = ctrl.Options.Description === undefined ? undefined : ctrl.Options.Description.replace("portals.desktops", "portals.common");
			ctrl.Options.PlaceHolder = ctrl.Options.PlaceHolder === undefined ? undefined : ctrl.Options.PlaceHolder.replace("portals.desktops", "portals.common");
		});

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "MetaTags"));
		control.Options.Rows = 10;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Scripts"));
		control.Options.Rows = 15;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		if (this.desktop.ID !== "") {
			formConfig.push(
				await this.usersSvc.getAuditFormControlAsync(this.desktop.Created, this.desktop.CreatedID, this.desktop.LastModified, this.desktop.LastModifiedID, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.desktops.update.buttons.delete}}",
						OnClick: async () => await this.deleteAsync(),
						Options: {
							Fill: "clear",
							Color: "danger",
							Css: "ion-float-end",
							Icon: {
								Name: "trash",
								Slot: "start"
							}
						}
					}
				)
			);
		}
		else {
			control.Options.OnBlur = (_, formControl) => {
				this.form.controls.Alias.setValue(AppUtility.toANSI(formControl.value, true).replace(/\-/g, ""), { onlySelf: true });
				((this.form.controls.SEOSettings as FormGroup).controls.SEOInfo as FormGroup).controls.Title.setValue(formControl.value, { onlySelf: true });
			};
		}

		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Alias")).Options.OnBlur = (_, formControl) => formControl.setValue(AppUtility.toANSI(formControl.value, true), { onlySelf: true });
		formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Aliases")).Options.OnBlur = (_, formControl) => {
			const aliases = AppUtility.isNotEmpty(formControl.value)
				? AppUtility.toStr((AppUtility.toArray(formControl.value, ";") as string[]).map(alias => AppUtility.toANSI(alias, true)), ";")
				: undefined;
			formControl.setValue(aliases, { onlySelf: true });
		};

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (onPreCompleted !== undefined) {
			onPreCompleted(formConfig);
		}

		return formConfig;
	}

	onFormInitialized() {
		const desktop = AppUtility.clone(this.desktop, false);
		this.form.patchValue(desktop);
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync();
		console.warn("Form Controls", this.formControls);
		console.warn("Form Value", this.form.value);
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);
				const desktop = this.form.value;
				if (AppUtility.isNotEmpty(desktop.ID)) {
					await this.portalsCoreSvc.updateDesktopAsync(
						desktop,
						async () => await Promise.all([
							TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.desktops.update.messages.success.update")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
				else {
					await this.portalsCoreSvc.createDesktopAsync(
						desktop,
						async () => await Promise.all([
							TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.desktops.update.messages.success.new")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error));
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		const modes = [
			{
				label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete-all"),
				value: "delete"
			},
			{
				label: await this.configSvc.getResourceAsync("portals.desktops.update.buttons.set-null-all"),
				value: "set-null"
			}
		];
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.desktops.update.messages.confirm.delete"),
			this.desktop.childrenIDs === undefined || this.desktop.childrenIDs.length < 1 ? undefined : await this.configSvc.getResourceAsync("portals.desktops.update.messages.mode"),
			async mode => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete"));
				await this.portalsCoreSvc.deleteDesktopAsync(
					this.desktop.ID,
					async () => await Promise.all([
						TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.desktops.update.buttons.delete"), this.configSvc.currentUrl),
						this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.desktops.update.messages.success.delete")),
						this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
					]),
					async error => await this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showErrorAsync(error)),
					{ "x-children": mode }
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			this.desktop.childrenIDs === undefined || this.desktop.childrenIDs.length < 1 ? undefined : modes.map(mode => {
				return {
					type: "radio",
					label: mode.label,
					value: mode.value,
					checked: mode.value === "delete"
				};
			})
		);
	}

	async cancelAsync(message?: string) {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			message || await this.configSvc.getResourceAsync(`portals.desktops.update.messages.confirm.${AppUtility.isNotEmpty(this.desktop.ID) ? "cancel" : "new"}`),
			undefined,
			async () => await this.configSvc.navigateBackAsync(),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
