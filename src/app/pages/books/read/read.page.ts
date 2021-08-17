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
		this.initializeAsync();

		AppEvents.on("App", info => {
			if ("OptionsUpdated" === info.args.Type) {
				this.getReadingOptions();
			}
			else if ("LanguageChanged" === info.args.Type) {
				Promise.all([
					this.prepareLabelsAsync(),
					this.prepareActionsAsync()
				]);
			}
		}, "AppEventHandlersOfReadBookPage");

		AppEvents.on("Session", info => {
			if ("Updated" === info.args.Type) {
				this.prepareActionsAsync();
			}
		}, "AppEventHandlersOfReadBookPage");

		AppEvents.on("Books", info => {
			if ("OpenChapter" === info.args.Type && this.chapter !== info.args.Chapter) {
				this.scrollOffset = 0;
				this.chapter = info.args.Chapter || 0;
				this.goChapterAsync();
			}
			else if ("Deleted" === info.args.Type && this.book.ID === info.args.ID) {
				this.onClose();
				this.configSvc.navigateBackAsync();
			}
		}, "BookEventHandlersOfReadBookPage");
	}

	ngOnDestroy() {
		AppEvents.off("App", "AppEventHandlersOfReadBookPage");
		AppEvents.off("Session", "AppEventHandlersOfReadBookPage");
		AppEvents.off("Books", "BookEventHandlersOfReadBookPage");
	}

	getReadingOptions() {
		this.options = {
			color: this.booksSvc.readingOptions.color,
			style: this.booksSvc.readingOptions.font + " " + this.booksSvc.readingOptions.size + " " + this.booksSvc.readingOptions.paragraph + " " + this.booksSvc.readingOptions.align
		};
	}

	onClose() {
		if (this.book !== undefined && this.book.TotalChapters > 1) {
			AppEvents.broadcast("Books", { Type: "CloseBook", ID: this.book.ID });
		}
	}

	onScrollEnd() {
		this.contentCtrl.getScrollElement().then(async element => {
			this.scrollOffset = element.scrollTop;
			await this.booksSvc.updateBookmarkAsync(this.book.ID, this.chapter, this.scrollOffset);
		});
	}

	onSwipeLeft() {
		this.goNextAsync();
	}

	onSwipeRight() {
		this.openTOCs();
	}

	async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const id = this.configSvc.requestParams["ID"];
		await this.booksSvc.getBookAsync(
			id,
			async _ => {
				this.book = Book.get(id);
				if (this.book !== undefined) {
					this.title = this.configSvc.appTitle = `${this.book.Title} - ${this.book.Author}`;
					await this.prepareAsync();
				}
				else {
					await this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync());
				}
			},
			async error => await this.appFormsSvc.showErrorAsync(error)
		);
	}

	async prepareAsync() {
		await Promise.all([
			this.prepareLabelsAsync(),
			this.prepareActionsAsync()
		]);

		if (this.chapter === 0) {
			const bookmark = this.booksSvc.bookmarks.get(this.book.ID);
			if (bookmark !== undefined) {
				this.chapter = bookmark.Chapter;
				this.scrollOffset = bookmark.Position;
			}
		}

		AppEvents.broadcast("Books", { Type: "OpenBook", ID: this.book.ID, Chapter: this.chapter });

		if (this.chapter > 0) {
			await this.goChapterAsync();
		}
		else {
			this.scrollOffset = 0;
			await this.scrollAsync(async () => {
				if (this.book.TotalChapters > 1 && this.chapter < this.book.TotalChapters) {
					await this.booksSvc.getBookChapterAsync(this.book.ID, this.chapter + 1);
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
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.author"), "bookmarks", async () => await this.openAuthorAsync()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.info"), "information-circle", async () => await this.openInfoAsync()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.toc"), "list", () => this.openTOCs()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.options"), "options", async () => await this.openOptionsAsync())
		];

		if (true !== this.configSvc.appConfig.extras["Books-ShowTOCs"]) {
			if (this.screen > 1199 || this.book === undefined || this.book.TotalChapters < 2) {
				this.actions.removeAt(2);
			}
		}

		if (this.authSvc.isServiceModerator(this.booksSvc.name)) {
			[
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.update"), "create", async () => await this.openUpdateAsync()),
				this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("common.buttons.delete"), "trash", async () => await this.deleteAsync())
			].forEach(action => this.actions.push(action));
			if (this.book !== undefined && this.book.SourceUrl !== "") {
				this.actions.insert(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.read.actions.crawl"), "build", async () => await this.openRecrawlAsync()), this.actions.length - 2);
			}
		}
	}

	showActionsAsync() {
		return this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	async goChapterAsync(direction: string = "next") {
		if (this.book.Chapters[this.chapter - 1] === "") {
			await this.appFormsSvc.showLoadingAsync();
			await this.booksSvc.getBookChapterAsync(
				this.book.ID,
				this.chapter,
				async () => {
					await this.scrollAsync();
					await this.appFormsSvc.hideLoadingAsync(async () => await this.booksSvc.getBookChapterAsync(this.book.ID, direction === "previous" ? this.chapter - 1 : this.chapter + 1));
				},
				async error => await Promise.all([
					this.trackAsync(this.title + " | Error"),
					this.appFormsSvc.showErrorAsync(error)
				])
			);
		}
		else {
			await this.scrollAsync(async () => await this.booksSvc.getBookChapterAsync(this.book.ID, this.chapter + 1));
		}
	}

	async goPreviousAsync() {
		if (this.book.TotalChapters < 2) {
			const books = Book.instances.toArray(book => book.Category === this.book.Category);
			const index = books.findIndex(book => book.ID === this.book.ID);
			if (index > -1) {
				await this.configSvc.navigateForwardAsync(books[index - 1].routerURI);
			}
		}
		else if (this.chapter > 0) {
			this.chapter--;
			this.scrollOffset = 0;
			await this.goChapterAsync("previous");
		}
	}

	async goNextAsync() {
		if (this.book.TotalChapters < 2) {
			const books = Book.instances.toArray(book => book.Category === this.book.Category);
			const index = books.findIndex(book => book.ID === this.book.ID);
			if (index > -1 && index < books.length - 2) {
				await this.configSvc.navigateForwardAsync(books[index + 1].routerURI);
			}
		}
		else if (this.chapter < this.book.TotalChapters) {
			this.chapter++;
			this.scrollOffset = 0;
			await this.goChapterAsync();
		}
	}

	async scrollAsync(onNext?: () => void) {
		if (this.book.TotalChapters > 1) {
			AppEvents.broadcast("Books", { Type: "OpenBook", ID: this.book.ID, Chapter: this.chapter });
		}
		if (this.contentCtrl !== undefined) {
			if (this.scrollOffset > 0) {
				await this.contentCtrl.scrollByPoint(0, this.scrollOffset, 567);
			}
			else {
				await this.contentCtrl.scrollToTop(567);
			}
		}
		await Promise.all([
			this.trackAsync(this.title + ` | Read ${this.book.TotalChapters > 1 && this.chapter > 0 ? ` - Chapter: ${this.chapter}` : ""}`),
			this.appFormsSvc.hideLoadingAsync(onNext)
		]);
	}

	async openAuthorAsync() {
		await this.configSvc.navigateForwardAsync(`/books/author/${AppUtility.toANSI(this.book.Author, true)}?x-request=${AppCrypto.jsonEncode({ Author: this.book.Author })}`);
	}

	async openInfoAsync() {
		await this.configSvc.navigateForwardAsync(this.book.routerURI.replace("/read/", "/info/"));
	}

	openTOCs() {
		AppEvents.broadcast("OpenSidebar");
	}

	async openOptionsAsync() {
		await this.configSvc.navigateForwardAsync("/books/options");
	}

	async openRecrawlAsync() {
		await this.trackAsync(this.title + " | ReCrawl | Open", "ReCrawl");
		await this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("books.crawl.header"),
			undefined,
			undefined,
			async mode => {
				await this.booksSvc.sendRequestToReCrawlAsync(this.book.ID, this.book.SourceUrl, mode);
				await Promise.all([
					this.trackAsync(this.title + " | ReCrawl | Sent", "ReCrawl"),
					this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.crawl.message"), 2000)
				]);
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
		);
	}

	async openUpdateAsync() {
		await this.configSvc.navigateForwardAsync(this.book.routerURI.replace("/read/", "/update/"));
	}

	async deleteAsync() {
		await this.trackAsync(this.title + " | Delete | Open", "Delete");
		await this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			undefined,
			await this.configSvc.getResourceAsync("books.read.delete.confirm"),
			async () => await this.booksSvc.deleteBookAsync(
				this.book.ID,
				async () => {
					await this.booksSvc.deleteBookmarkAsync(this.book.ID);
					await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.read.delete.message", { title: this.book.Title }));
					await Promise.all([
						this.trackAsync(this.title + " | Delete | Success", "Delete"),
						this.configSvc.navigateBackAsync()
					]);
				},
				async error => await Promise.all([
					this.trackAsync(this.title + " | Delete | Error", "Delete"),
					this.appFormsSvc.showErrorAsync(error)
				])
			),
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	private async trackAsync(title: string, action?: string) {
		await TrackingUtility.trackAsync({ title: title, category: "Book", action: action || "Read" });
	}

}
