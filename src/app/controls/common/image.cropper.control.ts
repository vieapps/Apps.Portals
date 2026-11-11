import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { ImageCroppedEvent } from "ngx-image-cropper";
import { AppFormsControl } from "@app/components/forms.objects";

@Component({
	selector: "control-image-cropper",
	standalone: false,
	changeDetection: ChangeDetectionStrategy.Eager,
	template: `<input type="file" accept="image/*" aria-label="Image" (change)="prepareImage($event)" />
		@for (file of cropFiles; track file.name) {
			<image-cropper [imageFile]="file" format="png" output="base64"
				[maintainAspectRatio]="true" [aspectRatio]="1"
				(imageCropped)="onImageCropped(file, $event)"
				(loadImageFailed)="onCropImageFailed(file)"></image-cropper>
		}
		@if (preview || settings?.currentImage) {
			<img [src]="preview || settings.currentImage" style="max-width:100%;max-height:320px" />
		}
		@if (error) {
			<p role="alert">{{ error }}</p>
		}`
	})
export class ImageCropperControl implements OnInit {
	@Input() settings: any = {};
	@Input() control: AppFormsControl;
	@Input() cropAvatar = false;
	@Output() init = new EventEmitter();
	@Output() change = new EventEmitter();
	data: string;
	preview: string;
	error: string;
	// A new file gets its own cropper instance so pending work belongs to that selection.
	cropFiles: File[] = [];

	get gotData() {
		return !this.error && (this.cropFiles.length === 0 || !!this.data);
	}

	ngOnInit() {
		this.init.emit(this);
	}

	prepareImage(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (this.cropAvatar) {
			input.value = "";
			this.cropFiles = [];
			this.data = this.preview = undefined;
		}
		if (!file.type.startsWith("image/")) {
			if (this.cropAvatar) this.error = "Unable to load the selected image";
			return;
		}
		if (this.settings?.limitSize && file.size > this.settings.limitSize) {
			this.error = this.settings.limitExceedMessage || "Image exceeds the allowed size";
			return;
		}
		this.error = undefined;
		if (this.cropAvatar) {
			this.cropFiles = [file];
			return;
		}
		const reader = new FileReader();
		reader.onload = () => this.setImage(reader.result as string);
		reader.readAsDataURL(file);
	}

	onImageCropped(file: File, event: ImageCroppedEvent) {
		if (this.cropFiles[0] === file && event.base64) this.setImage(event.base64);
	}

	onCropImageFailed(file: File) {
		if (this.cropFiles[0] !== file) {
			return;
		}
		this.cropFiles = [];
		this.data = this.preview = undefined;
		this.error = "Unable to load the selected image";
	}

	private setImage(data: string) {
		this.data = this.preview = data;
		this.change.emit({ detail: { value: data } });
	}
}