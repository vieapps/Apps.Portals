import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@components/forms.module";
import { ContentTypesUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: ContentTypesUpdatePage }])
	],
	exports: [],
	declarations: [ContentTypesUpdatePage]
})

export class ContentTypesUpdatePageModule {}
