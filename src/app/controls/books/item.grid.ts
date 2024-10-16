import { Component, Input } from "@angular/core";
import { ConfigurationService } from "@app/services/configuration.service";
import { Book } from "@app/models/book";

@Component({
	selector: "control-books-grid-item",
	templateUrl: "./item.grid.html",
	styleUrls: ["./item.grid.scss"]
})

export class BookGridItemControl {

	constructor(
		private configSvc: ConfigurationService
	) {
	}

	@Input() book: Book;
	@Input() hideAuthor: boolean;
	@Input() hideCategory: boolean;

	get color() {
		return this.configSvc.color;
	}

	get coverBackground() {
		return `url(${this.book.Cover})`;
	}

	open() {
		this.configSvc.navigateForwardAsync(this.book.routerURI);
	}

}
