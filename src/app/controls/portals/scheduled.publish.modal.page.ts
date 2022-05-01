import { Component, OnInit, Input } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsControlConfig, AppFormsControl } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, SchedulingTask } from "@app/models/portals.core.all";
import { PortalCmsBase as CmsBaseModel } from "@app/models/portals.cms.base";

@Component({
	selector: "page-scheduled-publish",
	templateUrl: "./scheduled.publish.modal.page.html",
	styleUrls: ["./scheduled.publish.modal.page.scss"]
})

export class ScheduledPublishModalPage implements OnInit {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private task: SchedulingTask;

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		save: "Save",
		cancel: "Cancel"
	};

	@Input() private taskID: string;
	@Input() private object: CmsBaseModel;

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.task = SchedulingTask.get(this.taskID);
		this.title = await this.configSvc.getResourceAsync("portals.tasks.scheduled.publish.title.modal");
		this.task = this.task || new SchedulingTask({
			Title: await this.configSvc.getResourceAsync("portals.tasks.scheduled.publish.title.object", { title: this.object.Title }),
			SystemID: this.object.SystemID,
			EntityInfo: this.object.RepositoryEntityID,
			ObjectID: this.object.ID,
			UserID: this.configSvc.getAccount().id
		}, (task, data) => task.Time = !!data.Time ? new Date(data.Time) : AppUtility.setTime(new Date().getHours() < 15 ? new Date() : AppUtility.addTime(new Date(), 1, "days"), 15, 0, 0, 0));
		this.button = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${AppUtility.isNotEmpty(this.task.ID) ? "save" : "create"}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};
		this.formConfig = [
			{
				Name: "Time",
				Type: "DatePicker",
				Options: {
					Type: "date",
					Label: await this.appFormsSvc.getResourceAsync("portals.tasks.scheduled.publish.time"),
					DatePickerOptions: {
						AllowTimes: true
					}
				}
			},
			{
				Name: "Status",
				Type: "Select",
				Options: {
					Type: "text",
					Label: await this.appFormsSvc.getResourceAsync("portals.tasks.scheduled.publish.status"),
					SelectOptions: {
						Values: "Draft#;Pending#;Rejected#;Approved#;Published#;Archieved",
						Multiple: false,
						AsBoxes: false,
						Interface: "alert"
					}
				}
			},
			{
				Name: "Start",
				Type: "DatePicker",
				Options: {
					Type: "date",
					Label: await this.appFormsSvc.getResourceAsync("portals.tasks.scheduled.publish.start"),
					DatePickerOptions: {
						AllowTimes: false
					}
				}
			},
			{
				Name: "End",
				Type: "DatePicker",
				Options: {
					Type: "date",
					Label: await this.appFormsSvc.getResourceAsync("portals.tasks.scheduled.publish.end"),
					DatePickerOptions: {
						AllowTimes: false
					}
				}
			}
		];
		this.portalsCoreSvc.prepareApprovalStatusControl(this.formConfig.find(ctrl => ctrl.Name === "Status"));
	}

	onFormInitialized() {
		this.form.patchValue({
			Time: AppUtility.toIsoDateTime(this.task.Time),
			Status: this.task.updatingStatus || "Published",
			Start: AppUtility.toIsoDate(this.object["StartDate"]),
			End: AppUtility.toIsoDate(this.object["EndDate"])
		});
	}

	async cancelAsync(showToast: boolean = false) {
		await this.appFormsSvc.hideLoadingAsync(async () => {
			await this.appFormsSvc.hideModalAsync();
			if (showToast) {
				await this.appFormsSvc.showToastAsync(await this.appFormsSvc.getResourceAsync("portals.tasks.scheduled.publish.message"));
			}
		});
	}

	async saveAsync() {
		const form = this.form.value;
		const task = AppUtility.clone(this.task);
		task.Time = form.Time !== undefined ? AppUtility.toStrDateTime(form.Time) : undefined;
		if (task.Time !== undefined) {
			this.processing = true;
			await this.appFormsSvc.showLoadingAsync(this.title);
			const data = AppUtility.parse(this.task.Data);
			const start = AppUtility.toStrDate(form.Start);
			const end = AppUtility.toStrDate(form.End);
			if (AppUtility.isObject(data.Object, true)) {
				data.Object.PublishedTime = task.Time;
				data.Object.Status = form.Status;
				data.Object.StartDate = start;
				data.Object.EndDate = end;
			}
			else {
				data.PublishedTime = task.Time;
				data.Status = form.Status;
				data.StartDate = start;
				data.EndDate = end;
			}
			task.Data = AppUtility.stringify(data);
			if (AppUtility.isNotEmpty(task.ID)) {
				await this.portalsCoreSvc.updateSchedulingTaskAsync(
					task,
					async _ => await this.cancelAsync(true),
					async error => {
						this.processing = false;
						await this.appFormsSvc.showErrorAsync(error);
					}
				);
			}
			else {
				await this.portalsCoreSvc.createSchedulingTaskAsync(
					task,
					async _ => await this.cancelAsync(true),
					async error => {
						this.processing = false;
						await this.appFormsSvc.showErrorAsync(error);
					}
				);
			}
		}
	}

}
