import { ServicePrivilegesControl } from "./common/service.privileges.control";
import { ObjectPrivilegesControl } from "./common/object.privileges.control";
import { ImageCropperControl } from "./common/image.cropper.control";
import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonButtons, IonCheckbox, IonCol, IonGrid, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonRow, IonSelect, IonSelectOption, IonThumbnail, IonToggle } from "@ionic/angular";
import { DataItemControl } from "./common/data.item.control";
import { FilesSelectorControl } from "./common/file.selector.control";
import { addIcons } from "ionicons";
import { add, close, trash, create, open, download, link, image, shareSocial, analytics, document, documentAttach } from "ionicons/icons";

addIcons({ add, close, trash, create, open, download, link, image, shareSocial, analytics, document, documentAttach });

@NgModule({
	imports: [CommonModule, IonButton, IonButtons, IonCheckbox, IonCol, IonGrid, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonRow, IonSelect, IonSelectOption, IonThumbnail, IonToggle],
	declarations: [ServicePrivilegesControl, ObjectPrivilegesControl, ImageCropperControl, DataItemControl, FilesSelectorControl],
	exports: [ServicePrivilegesControl, ObjectPrivilegesControl, ImageCropperControl, DataItemControl, FilesSelectorControl]
})
export class CommonControlsModule {}
