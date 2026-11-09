import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonBadge, IonIcon, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonToggle } from "@ionic/angular";
import { AppPreferencesControl } from "@app/controls/common/app.preferences.control";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonBadge, IonIcon, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonToggle
	],
	exports: [AppPreferencesControl],
	declarations: [AppPreferencesControl]
})

export class AppPreferencesControlModule {}
