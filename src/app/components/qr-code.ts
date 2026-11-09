import { AfterViewInit, Component, ElementRef, Input, NgModule, OnChanges, ViewChild } from "@angular/core";
import QRCode from "qrcode";

@Component({ selector: "qr-code", standalone: false, template: '<canvas #canvas aria-label="QR code"></canvas>' })
export class QRCodeControl implements AfterViewInit, OnChanges {
	@Input() value = "";
	@Input() size = 290;
	@ViewChild("canvas", { static: true }) canvas: ElementRef<HTMLCanvasElement>;

	ngAfterViewInit() {
		this.render();
	}

	ngOnChanges() {
		this.render();
	}

	private render() {
		if (this.canvas && this.value) {
			QRCode.toCanvas(this.canvas.nativeElement, this.value, { width: this.size }).catch(error => console.error("QR code rendering failed", error));
		}
	}
}

@NgModule({ declarations: [QRCodeControl], exports: [QRCodeControl] })
export class QRCodeModule {}
