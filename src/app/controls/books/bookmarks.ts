import { Component, OnInit, OnDestroy, Input, ViewChild } from "@angular/core";
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

	@Input() profile: UserProfile;
	@ViewChild("list", { static: true }) private list: IonList;

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

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	ngOnInit() {
		this.profile = this.profile || this.configSvc.getAccount().profile;
		this.prepareLabelsAsync().then(() => this.prepareBookmarks());

		AppEvents.on("App", info => {
			if ("Language" === info.args.Type && "Changed" === info.args.Mode) {
				this.prepareLabelsAsync();
			}
		}, "BookmarkEvents");

		AppEvents.on(this.booksSvc.name, info => {
			if ("Bookmarks" === info.args.Type && "Updated" === info.args.Mode) {
				this.prepareBookmarks();
			}
		}, "BookmarkEvents");
	}

	ngOnDestroy() {
		this.list.closeSlidingItems();
		AppEvents.off("App", "BookmarkEvents");
		AppEvents.off(this.booksSvc.name, "BookmarkEvents");
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
		AppUtility.invokeWorker(() => this.bookmarks = this.booksSvc.bookmarks.toArray().sortBy({ name: "Time", reverse: true }));
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

	open(bookmark: Bookmark) {
		this.list.closeSlidingItems().then(() => this.configSvc.navigateForwardAsync(Book.get(bookmark.ID).routerURI));
	}

	delete(bookmark: Bookmark) {
		this.list.closeSlidingItems().then(() => this.booksSvc.deleteBookmarkAsync(bookmark.ID, () => this.prepareBookmarks()));
	}

	send() {
		this.booksSvc.sendBookmarksAsync(async () => {
			this.configSvc.getAccount().profile.LastSync = new Date();
			this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.update.messages.sync"));
		});
	}

}
