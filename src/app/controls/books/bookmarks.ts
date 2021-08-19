import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild } from "@angular/core";
import { IonList } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { BooksService } from "@app/services/books.service";
import { UserProfile } from "@app/models/user";
import { Book, Bookmark } from "@app/models/book";

@Component({
	selector: "control-books-bookmarks",
	templateUrl: "./bookmarks.html",
	styleUrls: ["./bookmarks.scss"]
})

export class BookmarksControl implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private booksSvc: BooksService
	) {
	}

	/** The user profile that contains the bookmarks */
	@Input() profile: UserProfile;

	/** The event handler to run when the controls was initialized */
	@Output() init: EventEmitter<any> = new EventEmitter();

	/** The event handler to run when the control was changed */
	@Output() change = new EventEmitter<any>();

	bookmarks = new Array<Bookmark>();

	labels = {
		header: "Readings",
		footer: "Sync time:",
		chapter: "Chapter: ",
		position: "Position: ",
		buttons: {
			read: "Read",
			delete: "Delete"
		}
	};

	@ViewChild("list", { static: true }) private list: IonList;

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	ngOnInit() {
		this.profile = this.profile || this.configSvc.getAccount().profile;
		Promise.all([this.initializeAsync()]).then(() => this.init.emit(this));

		AppEvents.on("App", info => {
			if ("LanguageChanged" === info.args.Type) {
				this.prepareLabelsAsync();
			}
		}, "LanguageChangedEventHandlerOfBookmarksControl");

		AppEvents.on("Books", info => {
			if ("BookmarksUpdated" === info.args.Type) {
				this.prepareBookmarks();
				this.emitChanges();
			}
		}, "BookmarksUpdatedEventHandlerOfBookmarksControl");
	}

	ngOnDestroy() {
		this.list.closeSlidingItems();
		this.init.unsubscribe();
		this.change.unsubscribe();
		AppEvents.off("App", "LanguageChangedEventHandlerOfBookmarksControl");
		AppEvents.off("Session", "SessionEventHandlerOfBookmarksControl");
		AppEvents.off("Books", "BookmarksUpdatedEventHandlerOfBookmarksControl");
	}

	private async initializeAsync() {
		AppUtility.invoke(() => this.prepareBookmarks(), 123);
		await this.prepareLabelsAsync();
	}

	private async prepareLabelsAsync() {
		this.labels = {
			header: await this.configSvc.getResourceAsync("books.bookmarks.header"),
			footer: await this.configSvc.getResourceAsync("books.bookmarks.footer"),
			chapter: await this.configSvc.getResourceAsync("books.bookmarks.chapter"),
			position: await this.configSvc.getResourceAsync("books.bookmarks.position"),
			buttons: {
				read: await this.configSvc.getResourceAsync("books.bookmarks.buttons.read"),
				delete: await this.configSvc.getResourceAsync("books.bookmarks.buttons.delete")
			}
		};
	}

	private prepareBookmarks() {
		this.bookmarks = this.booksSvc.bookmarks.toArray().sortBy({ name: "Time", reverse: true });
	}

	private emitChanges() {
		this.change.emit({
			id: this.profile.ID,
			bookmarks: this.bookmarks,
			detail: {
				value: this.bookmarks
			}
		});
	}

	trackBookmark(index: number, bookmark: Bookmark) {
		return `${bookmark.ID}@${index}`;
	}

	getTitle(bookmark: Bookmark) {
		const book = Book.get(bookmark.ID);
		return book !== undefined
			? book.Title + (book.Author !== "" ? " - " + book.Author : "")
			: `${bookmark.ID}@${bookmark.Chapter}#${bookmark.Position}`;
	}

	getPosition(bookmark: Bookmark) {
		const book = Book.get(bookmark.ID);
		return book !== undefined
			? (bookmark.Chapter > 0 ? this.labels.chapter + bookmark.Chapter : "") + (bookmark.Position > 0 ?  (bookmark.Chapter > 0 ? " - " : "") + this.labels.position + bookmark.Position : "")
			: `${bookmark.Chapter}#${bookmark.Position}`;
	}

	async openAsync(bookmark: Bookmark) {
		const book = Book.get(bookmark.ID);
		if (book !== undefined) {
			await this.list.closeSlidingItems();
			await this.configSvc.navigateForwardAsync(book.routerURI);
		}
	}

	async deleteAsync(bookmark: Bookmark) {
		await this.list.closeSlidingItems();
		await this.booksSvc.deleteBookmarkAsync(bookmark.ID, () => {
			this.prepareBookmarks();
			this.emitChanges();
		});
	}

	async sendAsync() {
		await this.booksSvc.sendBookmarksAsync(async () => {
			this.configSvc.getAccount().profile.LastSync = new Date();
			await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.update.messages.sync"));
		});
	}

}
