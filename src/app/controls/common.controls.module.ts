import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ImageCropperModule as HtmlImageCropper } from "ng2-img-cropper";
import { Crop as NativeImageCropper } from "@ionic-native/crop/ngx";
import { ImageCropperControl } from "./common/image.cropper";
import { ObjectPrivilegesControl } from "./common/object.privileges";
import { ServicePrivilegesControl } from "./common/service.privileges";
import { SelectorControl } from "./common/selector";
import { UsersSelectorModule } from "./common/user.selector.module";

@NgModule({
	providers: [NativeImageCropper],
	imports: [
		CommonModule,
		IonicModule,
		HtmlImageCropper,
		UsersSelectorModule
	],
	exports: [
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl,
		SelectorControl
	],
	declarations: [
		ImageCropperControl,
		ObjectPrivilegesControl,
		ServicePrivilegesControl,
		SelectorControl
	]
})

export class CommonControlsModule {}
