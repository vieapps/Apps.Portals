import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppUtility } from "@app/components/app.utility";
import { AppEvents } from "@app/components/app.events";
import { ConfigurationService } from "@app/services/configuration.service";
import { BooksService } from "@app/services/books.service";
import { Book } from "@app/models/book";

@Component({
	selector: "control-books-featured",
	templateUrl: "./featured.html",
	styleUrls: ["./featured.scss"]
})

export class BookFeaturedControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private booksSvc: BooksService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	books: Array<Book>;
	introduction = "";
	labels = {
		latest: "Latest",
		statistics: "Statistics:",
		authors: "Authors: ",
		books: "Articles & Books: "
	};

	get color() {
		return this.configSvc.color;
	}

	get status() {
		return this.configSvc.isReady ? this.booksSvc.status : undefined;
	}

	get locale() {
		return this.configSvc.locale;
	}

	ngOnInit() {
		if (this.configSvc.isReady) {
			this.initialize();
			AppUtility.invoke(() => this.updateBooks());
		}

		AppEvents.on("App", info => {
			if ("Initialized" === info.args.Type) {
				this.initialize();
				AppUtility.invoke(() => this.updateBooks());
			}
			else if ("HomePage" === info.args.Type && "Open" === info.args.Mode && "Return" === info.args.Source) {
				AppUtility.invoke(() => this.updateBooks());
			}
			else if ("Language" === info.args.Type && "Changed" === info.args.Mode) {
				this.prepareResourcesAsync();
				if (this.booksSvc.instructions[this.configSvc.appConfig.language] === undefined) {
					this.booksSvc.fetchInstructionsAsync(() => this.updateIntroduction());
				}
				else {
					this.updateIntroduction();
				}
			}
		}, "FeaturedBooks");

		AppEvents.on(this.booksSvc.name, info => {
			if ("Instructions" === info.args.Type && "Updated" === info.args.Mode) {
				this.updateIntroduction();
			}
			else if ("Books" === info.args.Type && "Updated" === info.args.Mode) {
				AppUtility.invoke(() => this.updateBooks());
			}
		}, "FeaturedBooks");
	}

	ngOnDestroy() {
		AppEvents.off("App", "FeaturedBooks");
		AppEvents.off(this.booksSvc.name, "FeaturedBooks");
	}

	private initialize() {
		this.prepareResourcesAsync();
		if (this.booksSvc.instructions[this.configSvc.appConfig.language] === undefined) {
			this.booksSvc.fetchInstructionsAsync(() => this.updateIntroduction());
		}
		else {
			this.updateIntroduction();
		}
	}

	private async prepareResourcesAsync() {
		this.labels = {
			latest: await this.configSvc.getResourceAsync("books.home.latest"),
			statistics: await this.configSvc.getResourceAsync("books.home.statistics.label"),
			authors: await this.configSvc.getResourceAsync("books.home.statistics.authors"),
			books: await this.configSvc.getResourceAsync("books.home.statistics.books")
		};
	}

	private updateIntroduction() {
		this.introduction = (this.booksSvc.instructions[this.configSvc.appConfig.language] || {}).introduction;
	}

	private updateBooks() {
		this.books = AppUtility.getTopScores(Book.instances.toArray().sortBy({ name: "LastUpdated", reverse: true }).take(60), 12, book => Book.get(book.ID));
	}

	trackBook(index: number, book: Book) {
		return `${book.ID}@${index}`;
	}

}
