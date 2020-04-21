import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ImageCropperModule as HtmlImageCropper } from "ng2-img-cropper";
import { Crop as NativeImageCropper } from "@ionic-native/crop/ngx";
import { UsersSelectorModule } from "@controls/common/user.selector.module";
import { DataSelectorControl } from "@controls/common/data.selector";
import { ImageCropperControl } from "@controls/common/image.cropper";
import { ObjectPrivilegesControl } from "@controls/common/object.privileges";
import { ServicePrivilegesControl } from "@controls/common/service.privileges";

@NgModule({
	providers: [NativeImageCropper],
	imports: [
		CommonModule,
		IonicModule,
		HtmlImageCropper,
		UsersSelectorModule
	],
	exports: [
		DataSelectorControl,
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl
	],
	declarations: [
		DataSelectorControl,
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl
	]
})

export class CommonControlsModule {}
