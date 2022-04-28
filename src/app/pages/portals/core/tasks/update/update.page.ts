import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, SchedulingTask } from "@app/models/portals.core.all";

@Component({
	selector: "page-portals-core-tasks-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsTasksUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private task: SchedulingTask;
	private organization: Organization;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private hash = "";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		save: "Save",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

	get canUpdate() {
		return this.task !== undefined
			? this.task.Persistance
				? this.task.Status === "Awaiting"
				: this.task.SchedulingType !== "Refresh"
			: true;
	}

	get canDelete() {
		return this.task !== undefined
			? this.task.Persistance && this.task.Status === "Completed"
			: false;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.task = SchedulingTask.get(this.configSvc.requestParams["ID"]);

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.tasks.title.${(this.task !== undefined ? "update" : "create")}`);
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.organization = this.task !== undefined
			? Organization.get(this.task.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.task.SystemID, _ => this.organization = Organization.get(this.task.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await Promise.all([
				this.trackAsync(`${this.title} | No Permission`, "Check"),
				this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync("Hmmmmmm....")),
				this.configSvc.navigateBackAsync()
			]);
			return;
		}

		this.task = this.task || new SchedulingTask(this.configSvc.requestParams, (task, _) => task.SystemID = this.organization.ID);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.task.SystemID) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check"),
			this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.task.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formConfig = await this.getFormControlsAsync();
		await this.trackAsync(this.title);
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "task");
		this.portalsCoreSvc.addOrganizationControl(formConfig, "{{portals.tasks.controls.Organization}}", this.organization);

		let control = formConfig.find(ctrl => ctrl.Name === "Title");
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => ctrl.Name === "Description");
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => ctrl.Name === "Data");
		control.Options.Rows = 10;

		control = formConfig.find(ctrl => ctrl.Name === "Time");
		control.Options.DatePickerOptions.AllowTimes = true;
		control.Options.ReadOnly = !this.canUpdate;

		control = formConfig.find(ctrl => ctrl.Name === "SchedulingType");
		control.Options.SelectOptions.Values = (control.Options.SelectOptions.Values as string).split("#;").map(value => ({ Value: value, Label: `{{portals.tasks.schedulingType.${value}}}` }));
		if (AppUtility.isNotEmpty(this.task.ID)) {
			control.Options.Disabled = true;
		}
		else if (!!this.configSvc.requestParams["SchedulingType"]) {
			control.Options.Disabled = true;
		}

		control = formConfig.find(ctrl => ctrl.Name === "RecurringType");
		control.Options.SelectOptions.Values = (control.Options.SelectOptions.Values as string).split("#;").map(value => ({ Value: value, Label: `{{portals.tasks.recurringType.${value}}}` }));

		control = formConfig.find(ctrl => ctrl.Name === "Status");
		control.Options.SelectOptions.Values = (control.Options.SelectOptions.Values as string).split("#;").map(value => ({ Value: value, Label: `{{portals.tasks.status.${value}}}` }));
		control.Options.Disabled = true;

		formConfig.find(ctrl => ctrl.Name === "EntityInfo").Hidden = formConfig.find(ctrl => ctrl.Name === "ObjectID").Hidden = this.task.SchedulingType !== "Update" && this.task.SchedulingType !== "SendNotification";
		formConfig.find(ctrl => ctrl.Name === "UserID").Hidden = this.task.SchedulingType !== "Update";

		if (AppUtility.isNotEmpty(this.task.ID)) {
			if (this.canUpdate || this.canDelete) {
				formConfig.push(this.portalsCoreSvc.getAuditFormControl(this.task));
			}
			if (this.canDelete) {
				formConfig.push(this.appFormsSvc.getButtonControls("basic", {
					Name: "Delete",
					Label: "{{portals.tasks.update.buttons.delete}}",
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
				}));
			}
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.task.ID)) {
			control = formConfig.find(ctrl => ctrl.Name === "ID");
			control.Order = this.canUpdate ? formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1 : control.Order;
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	onFormInitialized() {
		this.form.patchValue(AppUtility.clone(this.task, false, undefined, task => task.Time = AppUtility.toIsoDateTime(this.task.Time)));
		this.hash = AppCrypto.hash(this.form.value);
		if (AppUtility.isEmpty(this.task.ID) && !!this.configSvc.requestParams["SchedulingType"]) {
			this.form.controls.Data.setValue(this.task.Data + "\n");
		}
		this.appFormsSvc.hideLoadingAsync();
	}

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				const task = this.form.value;
				try {
					task.Data = AppUtility.stringify(AppUtility.parse(task.Data));
				}
				catch (error) {
					console.log(task.Data);
					console.error(error);
					await this.appFormsSvc.showAlertAsync(await this.appFormsSvc.getResourceAsync("common.alert.header.error"), await this.appFormsSvc.getResourceAsync("portals.tasks.update.messages.json"), undefined, () => this.formControls.find(ctrl => ctrl.Name === "Data").focus());
					return;
				}
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);
				if (AppUtility.isNotEmpty(task.ID)) {
					await this.portalsCoreSvc.updateSchedulingTaskAsync(
						task,
						async _ => await Promise.all([
							this.trackAsync(this.title, "Update"),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.tasks.update.messages.success.update")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title, "Update"),
								this.appFormsSvc.showErrorAsync(error)
							]);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createSchedulingTaskAsync(
						task,
						async _ => await Promise.all([
							this.trackAsync(this.title),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.tasks.update.messages.success.new")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]),
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title),
								this.appFormsSvc.showErrorAsync(error)
							]);
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		const button = await this.configSvc.getResourceAsync("portals.tasks.update.buttons.delete");
		await this.trackAsync(button, "Delete");
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.tasks.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(button);
				await this.portalsCoreSvc.deleteSchedulingTaskAsync(
					this.task.ID,
					async _ => await Promise.all([
						this.trackAsync(button, "Delete"),
						this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.tasks.update.messages.success.delete")),
						this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
					]),
					async error => await Promise.all([
						this.appFormsSvc.showErrorAsync(error),
						this.trackAsync(button, "Delete")
					])
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
		if (!this.canUpdate || (message === undefined && this.hash === AppCrypto.hash(this.form.value))) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				message || await this.configSvc.getResourceAsync(`portals.tasks.update.messages.confirm.${AppUtility.isNotEmpty(this.task.ID) ? "cancel" : "new"}`),
				undefined,
				async () => await this.configSvc.navigateBackAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
	}

	private async trackAsync(title: string, action?: string, category?: string) {
		await TrackingUtility.trackAsync({ title: title, category: category || "SchedulingTask", action: action || (this.task !== undefined && AppUtility.isNotEmpty(this.task.ID) ? "Edit" : "Create") });
	}

}
