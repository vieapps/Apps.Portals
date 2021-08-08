declare var FB: any;
import { ElementRef } from "@angular/core";
import { Keyboard } from "@ionic-native/keyboard/ngx";
import { Clipboard } from "@ionic-native/clipboard/ngx";
import { InAppBrowser } from "@ionic-native/in-app-browser/ngx";
import { ElectronService } from "ngx-electron";
import { AppConfig } from "@app/app.config";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";

/** Servicing component for working with app on a specific platform */
export class PlatformUtility {

	private static _keyboard: Keyboard;
	private static _clipboard: Clipboard;
	private static _inappBrowser: InAppBrowser;
	private static _electronService: ElectronService;

	/** Sets the instance of device keyboard */
	public static setKeyboard(keyboard: Keyboard) {
		this._keyboard = keyboard;
	}

	/** Sets the instance of app clipboard */
	public static setClipboard(clipboard: Clipboard) {
		this._clipboard = clipboard;
	}

	/** Sets the instance of in-app browser (native app) */
	public static setInAppBrowser(inappBrowser: InAppBrowser) {
		this._inappBrowser = inappBrowser;
	}

	/** Sets the instance of Electron service (web app) */
	public static setElectronService(electronService: ElectronService) {
		this._electronService = electronService;
	}

	/**
	 * Sets focus into the control
	 * @param control The control to focus into
	 * @param defer The defer times (in miliseconds)
	 */
	public static focus(control: any, defer?: number) {
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
	public static openURL(url?: string, target?: string) {
		if (AppUtility.isNotEmpty(url)) {
			if (this._electronService !== undefined) {
				this._electronService.shell.openExternal(url);
			}
			else if (AppConfig.isNativeApp && this._inappBrowser !== undefined) {
				this._inappBrowser.create(url, target || "_blank", {
					allowInlineMediaPlayback: "yes",
					location: "yes"
				});
			}
			else {
				window.open(url, target || "_blank");
			}
		}
	}

	/** Opens Google Maps by address or location via query */
	public static openGoogleMaps(info: string) {
		this.openURL(`https://www.google.com/maps?q=${encodeURIComponent(info)}`);
	}

	/** Copies the value into clipboard */
	public static copyToClipboard(value: string, onNext?: () => void) {
		if (AppConfig.isNativeApp) {
			this.copyToNativeAppClipboard(value, onNext);
		}
		else {
			this.copyToWebAppClipboard(value, onNext);
		}
	}

	/** Copies the value into clipboard of the native app */
	public static copyToNativeAppClipboard(value: string, onNext?: () => void) {
		this._clipboard.copy(value).then(
			() => {
				if (AppConfig.isDebug) {
					console.log("Copied...", value);
				}
				if (onNext !== undefined) {
					onNext();
				}
			},
			error => {
				console.error(`Copy error => ${AppUtility.getErrorMessage(error)}`, AppCrypto.stringify(error));
			}
		);
	}

	/** Copies the value into clipboard of the web app */
	public static copyToWebAppClipboard(value: string, onNext?: () => void) {
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
	}

	/** Prepares environments of the PWA */
	public static preparePWAEnvironment(onFacebookInit?: () => void) {
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
