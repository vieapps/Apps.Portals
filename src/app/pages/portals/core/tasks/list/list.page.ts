import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonList, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, SchedulingTask } from "@app/models/portals.core.all";

@Component({
	selector: "page-portals-core-tasks-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class PortalsTasksListPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@ViewChild(IonList, { static: true }) private listCtrl: IonList;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	private isSystemAdministrator = false;
	private canModerateOrganization = false;
	private systemID: string;
	private organization: Organization;

	title = {
		track: "Tasks",
		page: "Tasks"
	};
	tasks = new Array<SchedulingTask>();
	labels = {
		open: "Update",
		versions: "Versions",
		refresh: "Refresh",
		run: "Run"
	};

	get locale() {
		return this.configSvc.locale;
	}

	get color() {
		return this.configSvc.color;
	}

	get screenWidth() {
		return this.configSvc.screenWidth;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
		AppEvents.off(this.portalsCoreSvc.name, "SchedulingTasks:Refresh");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.organization = this.portalsCoreSvc.getOrganization(this.configSvc.requestParams["SystemID"]);
		this.isSystemAdministrator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemAdministrator || this.portalsCoreSvc.canModerateOrganization(this.organization);

		this.title.track = await this.configSvc.getResourceAsync("portals.tasks.title.list", { info: "" });
		if (!this.isSystemAdministrator && this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			this.appFormsSvc.showConfirmAsync(
				await this.configSvc.getResourceAsync("portals.organizations.list.invalid"),
				() => this.configSvc.navigateRootAsync("/portals/core/organizations/list/all")
			);
			return;
		}

		if (!this.canModerateOrganization) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateRootAsync());
			return;
		}

		this.labels = {
			open: await this.configSvc.getResourceAsync("common.buttons.edit"),
			versions: await this.configSvc.getResourceAsync("versions.view"),
			refresh: await this.configSvc.getResourceAsync("common.buttons.refresh"),
			run: await this.configSvc.getResourceAsync("portals.tasks.title.run")
		};

		this.systemID = this.organization.ID;
		this.configSvc.appTitle = this.title.page = await this.configSvc.getResourceAsync("portals.tasks.title.list", { info: `[${this.organization.Title}]` });
		this.prepare(() => this.appFormsSvc.hideLoadingAsync());

		AppEvents.on(this.portalsCoreSvc.name, info => {
			if (info.args.Object === "SchedulingTask") {
				if (info.args.Type === "Deleted") {
					SchedulingTask.instances.remove(info.args.ID);
					this.tasks.removeAt(this.tasks.findIndex(task => task.ID === info.args.ID));
				}
				this.prepare();
			}
		}, "SchedulingTasks:Refresh");
	}

	track(index: number, task: SchedulingTask) {
		return `${task.ID}@${index}`;
	}

	private prepare(onNext?: () => void) {
		const tasks = SchedulingTask.instances.toArray(object => object.SystemID === this.systemID);
		this.tasks = tasks.filter(object => object.Status !== "Completed").sortBy({ name: "Time", reverse: false }, "Title").merge(tasks.filter(object => object.Status === "Completed").sortBy({ name: "Time", reverse: false }, "Title"));
		if (onNext !== undefined) {
			onNext();
		}
	}

	private do(action: () => void, event?: Event) {
		if (event !== undefined) {
			event.stopPropagation();
		}
		this.listCtrl.closeSlidingItems().then(() => action());
	}

	create() {
		this.do(() => this.configSvc.navigateForwardAsync("/portals/core/tasks/create"));
	}

	open(event: Event, task: SchedulingTask) {
		this.do(() => this.configSvc.navigateForwardAsync(task.routerURI), event);
	}

	run(event: Event, task: SchedulingTask) {
		this.do(task.Status !== "Awaiting" ? () => {} : () => this.portalsCoreSvc.runSchedulingTaskAsync(task.ID), event);
	}

	refresh(event: Event, task: SchedulingTask) {
		this.do(() => this.portalsCoreSvc.refreshSchedulingTaskAsync(task.ID, () => this.appFormsSvc.showToastAsync("The task was freshen-up")), event);
	}

	viewVersions(event: Event, task: SchedulingTask) {
		this.do(() => this.configSvc.navigateForwardAsync("/versions/" + AppUtility.toANSI(task.Title, true) + "?x-request=" + AppCrypto.jsonEncode({ name: "SchedulingTask", id: task.ID })), event);
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Task", action: action || "Browse" });
	}

}
