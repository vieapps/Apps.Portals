import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { AppPreferencesControl } from "@app/controls/common/app.preferences.control";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule
	],
	exports: [AppPreferencesControl],
	declarations: [AppPreferencesControl]
})

export class AppPreferencesControlModule {}
