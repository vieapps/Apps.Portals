import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@components/forms.module";
import { PortalsModulesUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: PortalsModulesUpdatePage }])
	],
	exports: [],
	declarations: [PortalsModulesUpdatePage]
})

export class PortalsModulesUpdatePageModule {}
