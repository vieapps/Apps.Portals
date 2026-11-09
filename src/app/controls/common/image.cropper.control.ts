import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectionStrategy } from "@angular/core";
import { AppFormsControl } from "@app/components/forms.objects";

/** Retains the avatar control contract; the approved fallback uploads the original image. */
@Component({ selector: "control-image-cropper", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<input type="file" accept="image/*" aria-label="Avatar image" (change)="prepareImage($event)" />
		<img *ngIf="preview || settings?.currentImage" [src]="preview || settings.currentImage" style="max-width:100%;max-height:320px" />
		<p *ngIf="error">{{ error }}</p>` })
export class ImageCropperControl implements OnInit {
	@Input() settings: any = {};
	@Input() control: AppFormsControl;
	@Output() init = new EventEmitter();
	@Output() change = new EventEmitter();
	data: string;
	preview: string;
	error: string;
	ngOnInit() { this.init.emit(this); }
	prepareImage(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file || !file.type.startsWith("image/")) return;
		if (this.settings?.limitSize && file.size > this.settings.limitSize) { this.error = this.settings.limitExceedMessage || "Image exceeds the allowed size"; return; }
		this.error = undefined;
		const reader = new FileReader();
		reader.onload = () => { this.data = this.preview = reader.result as string; this.change.emit({ detail: { value: this.data } }); };
		reader.readAsDataURL(file);
	}
}
