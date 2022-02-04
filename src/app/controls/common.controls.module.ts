import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ImageCropperModule as HtmlImageCropper } from "ngx-image-cropper";
import { Crop as NativeImageCropper } from "@ionic-native/crop/ngx";
import { DataItemControl } from "@app/controls/common/data.item.control";
import { FilesSelectorControl } from "@app/controls/common/file.selector.control";
import { ImageCropperControl } from "@app/controls/common/image.cropper.control";
import { ObjectPrivilegesControl } from "@app/controls/common/object.privileges.control";
import { ServicePrivilegesControl } from "@app/controls/common/service.privileges.control";

@NgModule({
	providers: [NativeImageCropper],
	imports: [
		CommonModule,
		IonicModule,
		HtmlImageCropper
	],
	exports: [
		DataItemControl,
		FilesSelectorControl,
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl
	],
	declarations: [
		DataItemControl,
		FilesSelectorControl,
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl
	]
})

export class CommonControlsModule {}
