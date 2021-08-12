import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { HomePage } from "@app/pages/home.page";
import { PortalsControlsModule } from "@app/controls/portals.controls.module";
import { BookControlsModule } from "@app/controls/books.controls.module";
import { AppPreferencesControlModule } from "@app/controls/common/app.preferences.module";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		PortalsControlsModule,
		BookControlsModule,
		AppPreferencesControlModule,
		RouterModule.forChild([{ path: "", component: HomePage }])
	],
	exports: [],
	declarations: [HomePage]
})

export class HomePageModule {}
