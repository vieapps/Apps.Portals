import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { ImageCroppedEvent } from "ngx-image-cropper";
import { Crop as NativeImageCropper } from "@ionic-native/crop/ngx";
import { AppFormsControl } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";

@Component({
	selector: "control-image-cropper",
	templateUrl: "./image.cropper.control.html",
	styleUrls: ["./image.cropper.control.scss"]
})

export class ImageCropperControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private nativeImageCropper: NativeImageCropper
	) {
	}

	/** Settings of the image cropper */
	@Input() private settings: {
		currentImage?: string;
		selectorWidth?: number;
		selectorHeight?: number;
		croppedWidth?: number;
		croppedHeight?: number;
		canvasWidth?: number;
		canvasHeight?: number;
		limitSize?: number;
		limitExceedMessage?: string;
	};

	/** The form control that contains this control */
	@Input() private control: AppFormsControl;

	/** The event handler to run when the controls was initialized */
	@Output() init = new EventEmitter();

	/** The event handler to run when the control was changed */
	@Output() change = new EventEmitter();

	htmlCropper = {
		event: undefined as Event,
		cropped: undefined,
		current: undefined as string
	};

	get color() {
		return this.configSvc.color;
	}

	get isNativeApp() {
		return this.configSvc.isNativeApp;
	}

	get data() {
		return this.configSvc.isNativeApp ? undefined : this.htmlCropper.cropped;
	}

	ngOnInit() {
		this.settings = this.settings || {};
		if (this.configSvc.isNativeApp) {
			this.prepareNativeCropper();
		}
		else {
			this.prepareHtmlCropper();
		}
		this.init.emit(this);
	}

	ngOnDestroy() {
		this.init.unsubscribe();
		this.change.unsubscribe();
	}

	private prepareNativeCropper() {
	}

	private prepareHtmlCropper() {
		this.htmlCropper.current = this.settings.currentImage;
	}

	private emitChanges() {
		this.change.emit({
			detail: {
				value: this.data
			}
		});
	}

	prepareImage(event: any) {
		const file: File = event.target.files.length > 0 ? event.target.files[0] : undefined;
		if (file !== undefined && file.type.startsWith("image/")) {
			if (this.configSvc.isNativeApp) {
				this.prepareImageOfNativeCropper(event);
			}
			else {
				this.prepareImageOfHtmlCropper(event);
			}
		}
	}

	private prepareImageOfNativeCropper(event: any) {
	}

	private prepareImageOfHtmlCropper(event: any) {
		this.htmlCropper.event = event;
	}

	whenImageOfHtmlCropperWasCropped(event: ImageCroppedEvent) {
		this.htmlCropper.cropped = event.base64;
		this.emitChanges();
	}

}
