import { GoogleAnalytics } from "@ionic-native/google-analytics/ngx";
import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";

/** Servicing component for tracking use of app */
export class TrackingUtility {

	private static _googleAnalytics: GoogleAnalytics = undefined;

	/** Initializes the tracking objects (Google Analytics, Facebook, ...) */
	public static initializeAsync(googleAnalytics?: GoogleAnalytics) {
		const promises = new Array<Promise<void>>();
		if (this._googleAnalytics === undefined && googleAnalytics !== undefined && AppConfig.tracking.google.length > 0) {
			this._googleAnalytics = googleAnalytics;
			AppConfig.tracking.google.forEach(googleID => {
				promises.push(this._googleAnalytics.startTrackerWithId(googleID, 13)
					.then(() => this._googleAnalytics.setAppVersion(AppConfig.app.version))
					.then(() => this._googleAnalytics.setUserId(AppConfig.session.device))
					.then(() => this._googleAnalytics.setVar("checkProtocolTask", null))
					.then(() => this._googleAnalytics.setVar("checkStorageTask", null))
					.then(() => this._googleAnalytics.setVar("historyImportTask", null))
					.then(() => console.log(`[AppTracking]: Google Analytics [${googleID}] is ready now...`))
					.catch(error => console.error(`[AppTracking]: Error occurred while initializing Google Analytics [${googleID}]`, error))
				);
			});
		}
		return Promise.all(promises);
	}

	/** Tracks a screen */
	public static async trackScreenAsync(title?: string, campaignUrl?: string, addPrefix: boolean = true) {
		title = title || AppConfig.app.name;
		campaignUrl = campaignUrl || AppUtility.getURI(AppConfig.URLs.stack.last(), AppConfig.URLs.home);
		const promises = new Array<Promise<void>>();
		if (this._googleAnalytics !== undefined) {
			promises.push(this._googleAnalytics.trackView(`${addPrefix ? `${AppConfig.services.active} - ` : ""}${title}`, campaignUrl).catch(error => console.error("[AppTracking]: Error occurred while tracking a screen", error)));
		}
		await Promise.all(promises);
	}

	/** Tracks an event */
	public static async trackEventAsync(category: string, action: string, label?: string, addPrefix: boolean = true) {
		const promises = new Array<Promise<void>>();
		if (this._googleAnalytics !== undefined) {
			promises.push(this._googleAnalytics.trackEvent(`${addPrefix ? `${AppConfig.services.active}:` : ""}${category}`, action, label).catch(error => console.error("[AppTracking]: Error occurred while tracking an event", error)));
		}
		await Promise.all(promises);
	}

	/** Tracks a screen with an event */
	public static async trackAsync(options?: { title?: string; campaignUrl?: string; category?: string; action?: string; label?: string; }, addPrefix: boolean = true) {
		options = options || {};
		await Promise.all([
			this.trackScreenAsync(options.title, options.campaignUrl, addPrefix),
			AppUtility.isNotNull(options.category) && AppUtility.isNotNull(options.action) ? this.trackEventAsync(options.category, options.action, options.label, addPrefix) : new Promise<void>(() => {})
		]);
	}

}
