import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonContent } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppCrypto } from "@app/components/app.crypto";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { BooksService } from "@app/services/books.service";
import { Book } from "@app/models/book";

@Component({
	selector: "page-books-read",
	templateUrl: "./read.page.html",
	styleUrls: ["./read.page.scss"]
})

export class BooksReadPage implements OnInit, OnDestroy {
	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private booksSvc: BooksService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "";
	book: Book;
	chapter = 0;
	scrollOffset = 0;
	options = {
		color: "",
		style: ""
	};
	actions: Array<{
		text: string,
		role: string,
		icon: string,
		handler: () => void
	}>;
	labels = {
		previous: "Previous",
		next: "Next",
		category: "Category",
		original: "Original",
		author: "Author",
		translator: "Translator",
		publisher: "Publisher",
		producer: "Producer",
		source: "Source",
		chapters: "Number of chapters"
	};

	@ViewChild(IonContent, { static: true }) contentCtrl: IonContent;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get screen() {
		return this.configSvc.screenWidth;
	}

	ngOnInit() {
		this.getReadingOptions();
		this.initialize();

		AppEvents.on("App", info => {
			if ("Options" === info.args.Type && "Changed" === info.args.Mode) {
				this.getReadingOptions();
			}
			else if ("Language" === info.args.Type && "Changed" === info.args.Mode) {
				Promise.all([
					this.prepareLabelsAsync(),
					this.prepareActionsAsync()
				]);
			}
		}, "ReadBookEvents");

		AppEvents.on("Session", info => {
			if ("Updated" === info.args.Type) {
				this.prepareActionsAsync();
			}
		}, "ReadBookEvents");

		AppEvents.on(this.booksSvc.name, info => {
			if ("Book" === info.args.Type && "Deleted" === info.args.Mode && this.book.ID === info.args.ID) {
				this.onClose();
				this.configSvc.navigateBackAsync();
			}
			else if ("Chapter" === info.args.Type && "Open" === info.args.Mode && this.chapter !== info.args.Chapter) {
				this.scrollOffset = 0;
				this.chapter = info.args.Chapter || 0;
				this.goChapter();
			}
		}, "ReadBookEvents");
	}

	ngOnDestroy() {
		AppEvents.off("App", "ReadBookEvents");
		AppEvents.off("Session", "ReadBookEvents");
		AppEvents.off(this.booksSvc.name, "ReadBookEvents");
	}

	getReadingOptions() {
		this.options = {
			color: this.booksSvc.readingOptions.color,
			style: this.booksSvc.readingOptions.font + " " + this.booksSvc.readingOptions.size + " " + this.booksSvc.readingOptions.paragraph + " " + this.booksSvc.readingOptions.align
		};
	}

	onClose() {
		if (this.book !== undefined && this.book.TotalChapters > 1) {
			AppEvents.broadcast(this.booksSvc.name, { Type: "Book", Mode: "Close", ID: this.book.ID });
		}
	}

	onScrollEnd() {
		this.contentCtrl.getScrollElement().then(element => {
			this.scrollOffset = element.scrollTop;
			this.booksSvc.updateBookmarkAsync(this.book.ID, this.chapter, this.scrollOffset);
		});
	}

	onSwipeLeft() {
		this.goNext();
	}

	onSwipeRight() {
		this.openTOCs();
	}

	initialize() {
		const id = this.configSvc.requestParams["ID"];
		this.appFormsSvc.showLoadingAsync().then(() => this.booksSvc.getBookAsync(
			id,
			() => {
				this.book = Book.get(id);
				if (this.book !== undefined) {
					this.title = this.configSvc.appTitle = `${this.book.Title} - ${this.book.Author}`;
					this.prepare();
				}
				else {
					this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
				}
			},
			error => this.appFormsSvc.showErrorAsync(error)
		));
	}

	prepare() {
		this.prepareLabelsAsync().then(() => this.prepareActionsAsync());
		if (this.chapter === 0) {
			const bookmark = this.booksSvc.bookmarks.get(this.book.ID);
			if (bookmark !== undefined) {
				this.chapter = bookmark.Chapter;
				this.scrollOffset = bookmark.Position;
			}
		}
		AppEvents.broadcast(this.booksSvc.name, { Type: "Book", Mode: "Open", ID: this.book.ID, Chapter: this.chapter });
		if (this.chapter > 0) {
			this.goChapter();
		}
		else {
			this.scrollOffset = 0;
			this.scroll(() => {
				if (this.book.TotalChapters > 1 && this.chapter < this.book.TotalChapters) {
					this.booksSvc.getBookChapterAsync(this.book.ID, this.chapter + 1);
				}
			});
		}
	}

	async prepareLabelsAsync() {
		this.labels = {
			previous: await this.configSvc.getResourceAsync("books.read.navigate.previous"),
			next: await this.configSvc.getResourceAsync("books.read.navigate.next"),
			category: await this.configSvc.getResourceAsync("books.info.controls.Category"),
			original: await this.configSvc.getResourceAsync("books.info.controls.Original"),
			author: await this.configSvc.getResourceAsync("books.info.controls.Author"),
			translator: await this.configSvc.getResourceAsync("books.info.controls.Translator"),
			publisher: await this.configSvc.getResourceAsync("books.info.controls.Publisher"),
			producer: await this.configSvc.getResourceAsync("books.info.controls.Producer"),
			source: await this.configSvc.getResourceAsync("books.info.controls.Source"),
			chapters: await this.configSvc.getResourceAsync("books.info.chapters")
		};
	}

	async prepareActionsAsync() {
		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.author"), "bookmarks", () => this.openAuthor()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.info"), "information-circle", () => this.openInfo()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.toc"), "list", () => this.openTOCs()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.options"), "options", () => this.openOptions())
		];

		if (true !== this.configSvc.appConfig.extras["Books-ShowTOCs"]) {
			if (this.screen > 1199 || this.book === undefined || this.book.TotalChapters < 2) {
				this.actions.removeAt(2);
			}
		}

		if (this.authSvc.isServiceModerator(this.booksSvc.name)) {
			[
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.update"), "create", () => this.openUpdate()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.delete"), "trash", () => this.delete())
			].forEach(action => this.actions.push(action));
			if (this.book !== undefined && this.book.SourceUrl !== "") {
				this.actions.insert(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.crawl"), "build", () => this.openRecrawl()), this.actions.length - 2);
			}
		}
	}

	showActions() {
		this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	goChapter(direction: string = "next") {
		if (this.book.Chapters[this.chapter - 1] === "") {
			this.appFormsSvc.showLoadingAsync().then(() => this.booksSvc.getBookChapterAsync(
				this.book.ID,
				this.chapter,
				() => {
					this.scroll();
					this.appFormsSvc.hideLoadingAsync(() => this.booksSvc.getBookChapterAsync(this.book.ID, direction === "previous" ? this.chapter - 1 : this.chapter + 1));
				},
				error => this.trackAsync(this.title).then(() => this.appFormsSvc.showErrorAsync(error))
			));
		}
		else {
			this.scroll(() => this.booksSvc.getBookChapterAsync(this.book.ID, this.chapter + 1));
		}
	}

	goPrevious() {
		if (this.book.TotalChapters < 2) {
			const books = Book.instances.toArray(book => book.Category === this.book.Category);
			const index = books.findIndex(book => book.ID === this.book.ID);
			if (index > -1) {
				this.configSvc.navigateForwardAsync(books[index - 1].routerURI);
			}
		}
		else if (this.chapter > 0) {
			this.chapter--;
			this.scrollOffset = 0;
			this.goChapter("previous");
		}
	}

	goNext() {
		if (this.book.TotalChapters < 2) {
			const books = Book.instances.toArray(book => book.Category === this.book.Category);
			const index = books.findIndex(book => book.ID === this.book.ID);
			if (index > -1 && index < books.length - 2) {
				this.configSvc.navigateForwardAsync(books[index + 1].routerURI);
			}
		}
		else if (this.chapter < this.book.TotalChapters) {
			this.chapter++;
			this.scrollOffset = 0;
			this.goChapter();
		}
	}

	scroll(onNext?: () => void) {
		if (this.book.TotalChapters > 1) {
			AppEvents.broadcast(this.booksSvc.name, { Type: "Book", Mode: "Open", ID: this.book.ID, Chapter: this.chapter });
		}
		if (this.contentCtrl !== undefined) {
			if (this.scrollOffset > 0) {
				this.contentCtrl.scrollByPoint(0, this.scrollOffset, 567);
			}
			else {
				this.contentCtrl.scrollToTop(567);
			}
		}
		this.trackAsync(this.title).then(() => this.appFormsSvc.hideLoadingAsync(onNext));
	}

	openAuthor() {
		this.configSvc.navigateForwardAsync(`/books/author/${AppUtility.toANSI(this.book.Author, true)}?x-request=${AppCrypto.jsonEncode({ Author: this.book.Author })}`);
	}

	openInfo() {
		this.configSvc.navigateForwardAsync(this.book.routerURI.replace("/read/", "/info/"));
	}

	openTOCs() {
		AppEvents.broadcast("OpenSidebar");
	}

	openOptions() {
		this.configSvc.navigateForwardAsync("/books/options");
	}

	openRecrawl() {
		this.trackAsync(this.title, "ReCrawl").then(async () => this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("books.crawl.header"),
			undefined,
			undefined,
			mode => {
				this.booksSvc.sendRequestToReCrawlAsync(this.book.ID, this.book.SourceUrl, mode);
				this.trackAsync(this.title, "ReCrawl").then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.crawl.message"), 2000));
			},
			await this.configSvc.getResourceAsync("books.crawl.button"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			[
				{
					type: "radio",
					label: await this.configSvc.getResourceAsync("books.crawl.mode.full"),
					value: "full",
					checked: false
				},
				{
					type: "radio",
					label: await this.configSvc.getResourceAsync("books.crawl.mode.missing"),
					value: "missing",
					checked: true
				}
			]
		));
	}

	openUpdate() {
		this.configSvc.navigateForwardAsync(this.book.routerURI.replace("/read/", "/update/"));
	}

	delete() {
		this.trackAsync(this.title, "Delete").then(async () => await this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			undefined,
			await this.configSvc.getResourceAsync("books.read.delete.confirm"),
			() => this.booksSvc.deleteBookAsync(
				this.book.ID,
				() => {
					this.booksSvc.deleteBookmarkAsync(this.book.ID).then(async () => this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.read.delete.message", { title: this.book.Title })));
					this.trackAsync(this.title, "Delete").then(() => this.configSvc.navigateBackAsync());
				},
				error => this.trackAsync(this.title, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
			)
		));
	}

	private trackAsync(title: string, action?: string) {
		return TrackingUtility.trackAsync({ title: title, category: "Book", action: action || "Read" });
	}

}
