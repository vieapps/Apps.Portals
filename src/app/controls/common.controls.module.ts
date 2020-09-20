import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ImageCropperModule as HtmlImageCropper } from "ng2-img-cropper";
import { Crop as NativeImageCropper } from "@ionic-native/crop/ngx";
import { DataSelectorControl } from "@app/controls/common/data.selector.control";
import { FilesSelectorControl } from "@app/controls/common/file.selector.control";
import { ImageCropperControl } from "@app/controls/common/image.cropper.control";
import { ObjectPrivilegesControl } from "@app/controls/common/object.privileges.control";
import { ServicePrivilegesControl } from "@app/controls/common/service.privileges.control";
import { FilesProcessorModalPageModule } from "@app/controls/common/file.processor.modal.module";
import { UsersSelectorModalPageModule } from "@app/controls/common/user.selector.modal.module";

@NgModule({
	providers: [NativeImageCropper],
	imports: [
		CommonModule,
		IonicModule,
		HtmlImageCropper,
		UsersSelectorModalPageModule,
		FilesProcessorModalPageModule
	],
	exports: [
		DataSelectorControl,
		FilesSelectorControl,
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl
	],
	declarations: [
		DataSelectorControl,
		FilesSelectorControl,
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl
	]
})

export class CommonControlsModule {}
