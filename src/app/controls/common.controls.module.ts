import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ImageCropperModule as HtmlImageCropper } from "ng2-img-cropper";
import { Crop as NativeImageCropper } from "@ionic-native/crop/ngx";
import { UsersSelectorModule } from "./common/user.selector.module";
import { DataSelectorControl } from "./common/data.selector";
import { ImageCropperControl } from "./common/image.cropper";
import { ObjectPrivilegesControl } from "./common/object.privileges";
import { ServicePrivilegesControl } from "./common/service.privileges";

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
