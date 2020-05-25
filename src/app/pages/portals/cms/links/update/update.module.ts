import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@components/forms.module";
import { CmsLinksUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: CmsLinksUpdatePage }])
	],
	exports: [],
	declarations: [CmsLinksUpdatePage]
})

export class CmsLinksUpdatePageModule {}
