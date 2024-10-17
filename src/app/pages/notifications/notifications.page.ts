import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonInfiniteScroll } from "@ionic/angular";
import { HashSet } from "@app/components/app.collections";
import { AppDataFilter } from "@app/components/app.objects";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { NotificationsService } from "@app/services/notifications.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization } from "@app/models/portals.core.all";
import { Notification } from "@app/models/notification";

@Component({
	selector: "page-notifications-list",
	templateUrl: "./notifications.page.html",
	styleUrls: ["./notifications.page.scss"]
})

export class NotificationsPage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private notificationsSvc: NotificationsService,
		private portalsCoreSvc: PortalsCoreService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	notifications = new Array<Notification>();
	filterBy: AppDataFilter = {
		Query: undefined as string,
		And: new Array<{ [key: string]: any }>()
	};
	sortBy: { [key: string]: any } = { Time: "Descending" };
	pagination = AppPagination.getDefault();

	title = "Notifications";
	private label = "";
	private actions = {
		Create: "Create",
		Update: "Update",
		Delete: "Update",
		Approve: "Phê duyệt",
		Reject: "Từ chối"
	};
	private status = {
		Draft: "Draft",
		Pending: "Pending",
		Rejected: "Rejected",
		Approved: "Approved",
		Published: "Published",
		Archieved: "Archieved"
	};
	private counter = 0;
	private fetching = new HashSet<string>();

	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get paginationPrefix() {
		return "notifications";
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pagination.PageNumber, this.pagination);
	}

	ngOnInit() {
		this.initializeAsync();
		AppEvents.on("UpdateUnreadNotifications", _ => this.getNotifications(), "Notifications:UpdateUnread");
	}

	ngOnDestroy() {
		AppEvents.off("UpdateUnreadNotifications", "Notifications:UpdateUnread");
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.title = await this.appFormsSvc.getResourceAsync("notifications.title");
		this.label = await this.appFormsSvc.getResourceAsync("notifications.label");
		await Promise.all(Object.keys(this.actions).map(async name => this.actions[name] = (await this.appFormsSvc.getResourceAsync("events." + name)).toLowerCase()));
		await Promise.all(Object.keys(this.status).map(async name => this.status[name] = await this.appFormsSvc.getResourceAsync("status.approval." + name)));
		this.getNotifications(() => this.appFormsSvc.hideLoadingAsync(() => this.searchNotificationsAsync(() => this.searchNotificationsAsync())));
	}

	async onInfiniteScrollAsync() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
			await this.searchNotificationsAsync(async () => await (this.infiniteScrollCtrl !== undefined ? this.infiniteScrollCtrl.complete() : AppUtility.promise));
		}
		else if (this.infiniteScrollCtrl !== undefined) {
			await this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.disabled = true;
		}
	}

	private async searchNotificationsAsync(onNext?: () => void) {
		const request = AppPagination.buildRequest(this.filterBy, this.sortBy, this.pagination);
		await this.notificationsSvc.searchNotificationsAsync(request, data => {
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(request, this.paginationPrefix);
			this.getNotifications(onNext);
		});
	}

	private getNotifications(onNext?: () => void) {
		this.notifications = Notification.instances.toArray().sortBy({ name: "Time", reverse: true });
		if (onNext !== undefined) {
			onNext();
		}
	}

	track(index: number, notification: Notification) {
		return `${notification.ID}@${index}`;
	}

	info(notification: Notification) {
		const organization = Organization.get(notification.SystemID);
		if (organization === undefined && AppUtility.isNotEmpty(notification.SystemID) && !this.fetching.contains(notification.SystemID)) {
			this.counter = this.counter < 0 ? 0 : this.counter + 1;
			this.fetching.add(notification.SystemID);
			AppUtility.invoke(() => {
				if (!Organization.contains(notification.SystemID)) {
					this.portalsCoreSvc.getOrganizationAsync(notification.SystemID, _ => {
						this.counter--;
						this.fetching.remove(notification.SystemID);
					});
				}
			}, 678 + (this.counter * 50), true);
		}
		return (organization !== undefined ? "[" + organization.Alias + "] " : "") + AppUtility.format(this.label, {
			user: notification.SenderName,
			action: this.actions[notification.Action],
			title: notification.Title,
			status: this.status[notification.Status]
		});
	}

	indicatorCss(notification: Notification) {
		return "ion-color ion-color-" + (notification.Read ? "light" : "danger");
	}

	open(notification: Notification) {
		this.notificationsSvc.updateNotificationAsync(notification);
		AppEvents.broadcast("OpenNotification", notification);
	}

	markAllAsRead() {
		this.notifications.filter(notification => !notification.Read).forEach(notification => this.notificationsSvc.updateNotificationAsync(notification));
	}

}
