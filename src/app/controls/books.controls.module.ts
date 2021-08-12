import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { AppFormsModule } from "@app/components/forms.module";
import { TimePipeModule } from "@app/components/time.pipe";
import { BookmarksControl } from "@app/controls/books/bookmarks";
import { BookFeaturedControl } from "@app/controls/books/featured";
import { BookLinearItemControl } from "@app/controls/books/item.linear";
import { BookGridItemControl } from "@app/controls/books/item.grid";

@NgModule({
	providers: [],
	imports: [
		CommonModule,
		IonicModule,
		AppFormsModule,
		TimePipeModule
	],
	exports: [
		BookFeaturedControl,
		BookLinearItemControl,
		BookGridItemControl,
		BookmarksControl
	],
	declarations: [
		BookFeaturedControl,
		BookLinearItemControl,
		BookGridItemControl,
		BookmarksControl
	]
})

export class BookControlsModule {}
