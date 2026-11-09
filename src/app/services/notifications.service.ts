import { Injectable } from "@angular/core";
import { AppAPIs } from "@app/components/app.apis";
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

	deinitialize() {
	}

	fetchNotificationsAsync() {
		return this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "Notification",
			Query: { "object-identity": "fetch" },
			Header: AppAPIs.isReady ? undefined : { "x-update-messagae": "false" }
		}, AppAPIs.isReady ? undefined : data => this.updateNotifications(data !== undefined ? data.Objects : []), undefined, false, true);
	}

	searchNotificationsAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("Notification"),
			request,
			data => {
				this.updateNotifications(data !== undefined ? data.Objects : []);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching notifications", error, onError),
			false,
			undefined,
			false,
			true,
			data => this.updateNotifications(data !== undefined ? data.Objects : []),
			"notifications"
		);
	}

	private updateNotifications(objects: Array<any>) {
		let broadcast = false;
		(objects || []).forEach(obj => {
			const notification = Notification.update(obj);
			const read = Notification.contains(obj.ID) ? Notification.get(obj.ID).Read : undefined;
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
