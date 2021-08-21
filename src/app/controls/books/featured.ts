import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, Input, Output, EventEmitter } from "@angular/core";
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

export class BookFeaturedControl implements OnInit, OnDestroy, OnChanges {

	constructor(
		private configSvc: ConfigurationService,
		private booksSvc: BooksService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	/** The flag to known the parent was changed */
	@Input() changes: any;

	/** The event handler to run when the controls was initialized */
	@Output() init: EventEmitter<any> = new EventEmitter();

	/** The event handler to run when the control was changed */
	@Output() change = new EventEmitter<any>();

	introduction = "";
	labels = {
		latest: "Latest",
		statistics: "Statistics:",
		authors: "Authors: ",
		books: "Articles & Books: "
	};
	books: Array<Book>;

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
		this.initialize();
		AppEvents.on("App", info => {
			if ("LanguageChanged" === info.args.Type) {
				this.prepareResourcesAsync();
				if (this.booksSvc.instructions[this.configSvc.appConfig.language] === undefined) {
					this.booksSvc.fetchInstructionsAsync(() => this.updateIntroduction());
				}
				else {
					this.updateIntroduction();
				}
			}
		}, "BookFeaturedEventHandlers");
		AppEvents.on("Books", info => {
			if ("InstructionsUpdated" === info.args.Type) {
				this.updateIntroduction();
			}
			else if ("BooksUpdated" === info.args.Type) {
				this.updateBooks();
			}
		}, "BookFeaturedEventHandlers");
	}

	ngOnChanges(_: SimpleChanges) {
		this.updateBooks();
	}

	ngOnDestroy() {
		this.init.unsubscribe();
		this.change.unsubscribe();
		AppEvents.off("App", "BookFeaturedEventHandlers");
		AppEvents.off("Books", "BookFeaturedEventHandlers");
	}

	private initialize() {
		this.prepareResourcesAsync();
		if (this.booksSvc.instructions[this.configSvc.appConfig.language] === undefined) {
			this.booksSvc.fetchInstructionsAsync(() => this.updateIntroduction());
		}
		else {
			this.updateIntroduction();
		}
		this.init.emit(this);
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
		this.change.emit(this);
	}

	private updateBooks() {
		this.books = AppUtility.getTopScores(Book.instances.toArray().sortBy({ name: "LastUpdated", reverse: true }).take(60), 12, book => Book.get(book.ID));
		this.change.emit(this);
	}

	trackBook(index: number, book: Book) {
		return `${book.ID}@${index}`;
	}

}
