import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@components/forms.module";
import { PortalsContentTypesUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: PortalsContentTypesUpdatePage }])
	],
	exports: [],
	declarations: [PortalsContentTypesUpdatePage]
})

export class PortalsContentTypesUpdatePageModule {}
