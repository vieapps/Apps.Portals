declare var FB: any;
import { ElementRef, InjectionToken } from "@angular/core";
import { Keyboard } from "@capacitor/keyboard";
import { Clipboard } from "@capacitor/clipboard";
import { InAppBrowser, DefaultWebViewOptions } from "@capacitor/inappbrowser";

type KeyboardAdapter = { show(): Promise<unknown> };
type ClipboardAdapter = { copy(value: string): Promise<unknown> };
type InAppBrowserAdapter = { create(url: string, target: string, options: any): unknown };
import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";

/** Angular-facing adapter for the Electron preload bridge */
export interface AppElectronService {
	readonly isElectronApp: boolean;
	readonly ipcRenderer?: {
		on(channel: string, listener: (event: any, info: any) => void): unknown;
		send(channel: string, args: any): unknown;
	};
	readonly shell: {
		openExternal(url: string): unknown;
	};
}

/** Browser/native builds receive null; Electron receives the preload-backed adapter */
export const APP_ELECTRON_SERVICE = new InjectionToken<AppElectronService>("AppElectronService");

/** Matches Electron desktop shell without exposing Node APIs */
export function createElectronService(): AppElectronService | null {
	type DesktopBridge = Pick<AppElectronService, "ipcRenderer" | "shell">;
	const names = ["vieapps", "vieappsngx", "vieappsDesktop", "ngxDesktop", "ngx"];
	const isBridge = (bridge: any): bridge is DesktopBridge => typeof bridge?.ipcRenderer?.on === "function" && typeof bridge?.ipcRenderer?.send === "function" && typeof bridge?.shell?.openExternal === "function";
	const app: DesktopBridge | undefined = typeof window === "undefined"
		? undefined
		: names.map(name => (window as any)[name]).find(bridge => isBridge(bridge));
	return app === undefined ? null : {
		isElectronApp: true,
		ipcRenderer: {
			on: (channel, listener) => app.ipcRenderer.on(channel, listener),
			send: (channel, args) => app.ipcRenderer.send(channel, args)
		},
		shell: { openExternal: url => app.shell.openExternal(url) }
	};
}

/** Servicing component for working with app on a specific platform */
export class PlatformUtility {

	private static _keyboard: KeyboardAdapter;
	private static _clipboard: ClipboardAdapter;
	private static _inappBrowser: InAppBrowserAdapter;
	private static _electronService: AppElectronService;

	/** Prepares Capacitor implementations behind the existing utility methods. */
	static prepareNative() {
		if (!AppConfig.isRunningOnIOS) {
			this.setKeyboard(Keyboard);
		}
		this.setClipboard({ copy: value => Clipboard.write({ string: value }) });
		this.setInAppBrowser({
			create: (url, target) => {
				if (target === "_system") {
					return InAppBrowser.openInExternalBrowser({ url });
				}
				if (target !== "_blank") {
					throw new Error(`Native URL target is not mapped yet: ${target}`);
				}
				return InAppBrowser.openInWebView({ url, options: {
					...DefaultWebViewOptions,
					showURL: true,
					clearCache: false,
					clearSessionCache: false,
					mediaPlaybackRequiresUserAction: false,
					android: { ...DefaultWebViewOptions.android, isIsolated: false },
					iOS: { ...DefaultWebViewOptions.iOS, allowInLineMediaPlayback: true }
				} });
			}
		});
	}

	/** Sets the instance of device keyboard */
	static setKeyboard(keyboard: KeyboardAdapter) {
		this._keyboard = keyboard;
	}

	/** Sets the instance of app clipboard */
	static setClipboard(clipboard: ClipboardAdapter) {
		this._clipboard = clipboard;
	}

	/** Sets the instance of in-app browser (native app) */
	static setInAppBrowser(inappBrowser: InAppBrowserAdapter) {
		this._inappBrowser = inappBrowser;
	}

	/** Sets the instance of Electron service (web app) */
	static setElectronService(electronService: AppElectronService) {
		this._electronService = electronService;
	}

	/**
	 * Sets focus into the control
	 * @param control The control to focus into
	 * @param defer The defer times (in miliseconds)
	 */
	static focus(control: any, defer?: number) {
		if (AppUtility.isNotNull(control)) {
			const ctrl = control instanceof ElementRef
				? (control as ElementRef).nativeElement
				: control;
			if (ctrl !== undefined) {
				AppUtility.invoke(() => {
					if (typeof ctrl.setFocus === "function") {
						ctrl.setFocus();
					}
					else if (typeof ctrl.focus === "function") {
						ctrl.focus();
					}
					if (this._keyboard !== undefined) {
						this._keyboard.show();
					}
				}, defer || (AppConfig.isRunningOnIOS ? 456 : 234));
			}
		}
	}

	/** Opens an URL in browser */
	static openURL(url?: string, target?: string) {
		if (AppUtility.isNotEmpty(url)) {
			if (this._electronService !== undefined) {
				this._electronService.shell.openExternal(url);
			}
			else if (AppConfig.isNativeApp && this._inappBrowser !== undefined) {
				AppUtility.invoke(() => this._inappBrowser.create(url, target || "_blank", {
					allowInlineMediaPlayback: "yes",
					location: "yes"
				}));
			}
			else {
				AppUtility.invoke(() => window.open(url, target || "_blank"));
			}
		}
	}

	/** Opens Google Maps by address or location via query */
	static openGoogleMaps(info: string) {
		this.openURL(`https://www.google.com/maps?q=${encodeURIComponent(info)}`);
	}

	/** Copies the value into clipboard */
	static copyToClipboardAsync(value: string, onNext?: () => void) {
		return AppConfig.isNativeApp ? this.copyToNativeAppClipboardAsync(value, onNext) : this.copyToWebAppClipboardAsync(value, onNext);
	}

	/** Copies the value into clipboard of the native app */
	static copyToNativeAppClipboardAsync(value: string, onNext?: () => void) {
		return this._clipboard.copy(value)
			.then(() => {
				if (AppConfig.isDebug) {
					console.log("Copied...", value);
				}
				if (onNext !== undefined) {
					onNext();
				}
			})
			.catch(error => console.error(`Copy error => ${AppUtility.getErrorMessage(error)}`, AppUtility.stringify(error)));
	}

	/** Copies the value into clipboard of the web app */
	static copyToWebAppClipboardAsync(value: string, onNext?: () => void) {
		return AppUtility.invoke(() => {
			const parentNode = window.document.body;
			const textarea = this.appendElement({ value: value }, "textarea", parentNode) as HTMLTextAreaElement;
			textarea.style.position = "fixed";
			textarea.style.left = "0";
			textarea.style.top = "0";
			textarea.style.opacity = "0";
			textarea.focus();
			textarea.select();
			window.document.execCommand("copy");
			parentNode.removeChild(textarea);
			if (onNext !== undefined) {
				onNext();
			}
		});
	}

	/** Prepares environments of the PWA */
	static preparePWAEnvironment(onFacebookInit?: () => void) {
		// Facebook SDKs
		if (AppUtility.isNotEmpty(AppConfig.facebook.id) && AppUtility.parseURI().Scheme !== "file") {
			this.appendElement({
				id: "facebook-jssdk",
				async: "true",
				src: `https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=${AppConfig.facebook.version}`
			}, "script");
			window["fbAsyncInit"] = function() {
				FB.init({
					appId: AppConfig.facebook.id,
					channelUrl: "/assets/facebook.html",
					status: true,
					cookie: true,
					xfbml: true,
					version: AppConfig.facebook.version
				});
				if (onFacebookInit !== undefined) {
					onFacebookInit();
				}
			};
		}

		// scrollbars (on Windows & Linux)
		if (AppConfig.app.os !== "macOS") {
			this.appendElement({
				type: "text/css",
				innerText: "::-webkit-scrollbar,.hydrated::-webkit-scrollbar{background:#eee}"
					+ "::-webkit-scrollbar:horizontal,.hydrated::-webkit-scrollbar:horizontal{height:14px}"
					+ "::-webkit-scrollbar:vertical,.hydrated::-webkit-scrollbar:vertical{width:10px}"
					+ "::-webkit-scrollbar-thumb,.hydrated::-webkit-scrollbar-thumb{background:#ddd;border-radius:20px}"
					+ "::-webkit-scrollbar-thumb:hover,.hydrated::-webkit-scrollbar-thumb:hover,"
					+ "::-webkit-scrollbar-thumb:active,.hydrated::-webkit-scrollbar-thumb:active{background:#b2b2b2}"
			}, "style");
		}
	}

	private static appendElement(options: { [key: string]: any }, tagName: string, parentNode: HTMLElement = window.document.head) {
		const element = window.document.createElement(tagName);
		Object.keys(options).forEach(name => element[name] = options[name]);
		parentNode.appendChild(element);
		return element;
	}

}
