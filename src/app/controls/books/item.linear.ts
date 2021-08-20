import { Component, Input } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { ConfigurationService } from "@app/services/configuration.service";
import { Book } from "@app/models/book";

@Component({
	selector: "control-books-linear-item",
	templateUrl: "./item.linear.html",
	styleUrls: ["./item.linear.scss"]
})

export class BookLinearItemControl {

	constructor(
		private configSvc: ConfigurationService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	@Input() book: Book;
	@Input() hideAuthor: boolean;
	@Input() hideCategory: boolean;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	open() {
		this.configSvc.navigateForwardAsync(this.book.routerURI);
	}

}
