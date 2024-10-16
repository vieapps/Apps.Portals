import { Subject } from "rxjs";
import { ElectronService } from "ngx-electron";
import { AppUtility } from "@app/components/app.utility";

/** Servicing component for working with app events */
export class AppEvents {

	private static _handlers: { [key: string]: Array<{ func: (info: { event: string, args: any }) => void, identity: string }> } = {};
	private static _subject: Subject<{ event: string, args: any }>;
	private static _electronService: ElectronService;

	private static getHandlers(event: string) {
		this._handlers[event] = this._handlers[event] || [];
		return this._handlers[event];
	}

	/** Initializes the subject */
	static initialize() {
		this._subject = new Subject<{ event: string, args: any }>();
		this._subject.subscribe(({ event, args }) => this.getHandlers(event).forEach(handler => {
			try {
				handler.func({ event: event, args: args || {} });
			}
			catch (error) {
				console.error("[AppEvents]: Error occurred while running a handler", error);
			}
		}));
	}

	/**
	  * Registers a handler for processing data when a specified event has been raised/broadcasted
	  * @param event The string that presents the name of an event
	  * @param handler The function to handler data when an event was raised
	  * @param identity The string that presents identity of the handler for unregistering later
	*/
	static on(event: string, handler: (info: { event: string, args: any }) => void, identity?: string) {
		if (AppUtility.isNotEmpty(event) && handler !== undefined) {
			this.getHandlers(event).push({
				func: handler,
				identity: AppUtility.isNotEmpty(identity) ? identity : ""
			});
		}
	}

	/**
	  * Unregisters a handler
	  * @param event The string that presents the name of an event
	  * @param identity The string that presents the identity of the handler for unregistering
	*/
	static off(event: string, identity: string) {
		if (AppUtility.isNotEmpty(event) && AppUtility.isNotEmpty(identity)) {
			const handlers = this.getHandlers(event);
			let index = handlers.findIndex(handler => AppUtility.isEquals(identity, handler.identity));
			while (index > -1) {
				index = handlers.removeAt(index).findIndex(handler => AppUtility.isEquals(identity, handler.identity));
			}
		}
	}

	/**
	  * Broadcasts an event message through the app scope
	  * @param event The string that presents the name of an event
	  * @param args The JSON object that presents the arguments of an event
	*/
	static broadcast(event: string, args?: any) {
		this._subject.next({ event, args });
	}

	/** Initializes the service of Electron for sending messages */
	static initializeElectronService(electronService: ElectronService) {
		if (this._electronService === undefined && electronService !== undefined) {
			this._electronService = electronService;
		}
	}

	/**
	  * Sends an event message to Electron
	  * @param event The string that presents the name of an event
	  * @param args The JSON object that presents the arguments of an event
	*/
	static sendToElectron(event: string, args?: any) {
		if (this._electronService !== undefined) {
			try {
				this._electronService.ipcRenderer.send(event, AppUtility.clone(args || {}));
			}
			catch (error) {
				console.error("[AppEvents]: Error occurred while sending an IPC message to Electron", error, event, args);
			}
		}
	}

}
