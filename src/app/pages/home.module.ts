import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { HomePage } from "@app/pages/home.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		RouterModule.forChild([{ path: "", component: HomePage }])
	],
	exports: [],
	declarations: [HomePage]
})

export class HomePageModule {}
