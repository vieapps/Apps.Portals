import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { CmsItemsUpdatePage } from "./update.page";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		RouterModule.forChild([{ path: "", component: CmsItemsUpdatePage }])
	],
	exports: [],
	declarations: [CmsItemsUpdatePage]
})

export class CmsItemsUpdatePageModule {}
