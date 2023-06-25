import { Injectable } from "@angular/core";
import { AppAPIs } from "@app/components/app.apis";
import { AppUtility } from "@app/components/app.utility";
import { AppEvents } from "@app/components/app.events";
import { AppDataRequest } from "@app/components/app.objects";
import { Base as BaseService } from "@app/services/base.service";
import { Notification } from "@app/models/notification";

@Injectable()
export class NotificationsService extends BaseService {

	constructor() {
		super("Notifications");
	}

	initialize() {
		AppAPIs.registerAsServiceScopeProcessor(this.name, message => {
			if (!!message.Data && !!message.Data.ID) {
				const notification = Notification.update(message.Data);
				if (notification.Read) {
					Notification.unread.remove(notification.ID);
				}
				else {
					Notification.unread.add(notification.ID);
				}
				AppEvents.broadcast("UpdateUnreadNotifications");
			}
		});
	}

	fetchNotificationsAsync() {
		return AppAPIs.sendRequestAsync({ ServiceName: this.name, ObjectName: "Notification", Verb: "GET", Query: { "object-identity": "fetch" } });
	}

	private updateNotifications(objects: Array<any>) {
		let broadcast = false;
		objects.forEach(obj => {
			const read = Notification.contains(obj.ID) ? Notification.get(obj.ID).Read : undefined;
			const notification = Notification.update(obj);
			if (read === undefined || read !== notification.Read) {
				broadcast = true;
				if (notification.Read) {
					Notification.unread.remove(notification.ID);
				}
				else {
					Notification.unread.add(notification.ID);
				}
			}
		});
		if (broadcast) {
			AppEvents.broadcast("UpdateUnreadNotifications");
		}
	}

	searchNotifications(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("notification"),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.updateNotifications(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError)
		);
	}

	searchNotificationsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("notification"),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					this.updateNotifications(data.Objects as Array<any>);
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError)
		);
	}

	updateNotificationAsync(notification: Notification, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		notification.Read = true;
		return this.readAsync(
			this.getPath("notification", notification.ID),
			data => {
				Notification.update(data);
				Notification.unread.remove(notification.ID);
				AppEvents.broadcast("UpdateUnreadNotifications");
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while updating", error, onError)
		);
	}

}
