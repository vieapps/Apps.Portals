import { Injectable } from "@angular/core";
import { Dictionary } from "@app/components/app.collections";
import { AppStorage } from "@app/components/app.storage";
import { AppAPIs } from "@app/components/app.apis";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppPagination } from "@app/components/app.pagination";
import { AppSidebar, AppSidebarMenuItem, AppMessage, AppDataRequest } from "@app/components/app.objects";
import { CounterInfo } from "@app/models/counters";
import { StatisticBase, StatisticInfo } from "@app/models/statistics";
import { Book, Bookmark } from "@app/models/book";
import { Base as BaseService } from "@app/services/base.service";
import { ConfigurationService } from "@app/services/configuration.service";

@Injectable()
export class BooksService extends BaseService {

	constructor(
		private configSvc: ConfigurationService
	) {
		super("Books");
	}

	private _reading = {
		ID: undefined as string,
		Chapter: undefined as number
	};

	public get menuIndex() {
		if (this.configSvc.appConfig.services.all.length > 1) {
			const menuIndex = this.configSvc.appConfig.services.all.find(svc => svc.name === this.name).menuIndex;
			return menuIndex !== undefined ? menuIndex : 0;
		}
		return 0;
	}

	public initialize() {
		AppAPIs.registerAsServiceScopeProcessor("Scheduler", () => {
			if (this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				const profile = this.configSvc.getAccount().profile;
				if (profile !== undefined) {
					this.sendBookmarksAsync(() => profile.LastSync = new Date());
				}
			}
		});

		AppAPIs.registerAsObjectScopeProcessor(this.name, "Book", message => this.processUpdateBookMessage(message));
		AppAPIs.registerAsObjectScopeProcessor(this.name, "Statistic", message => this.processUpdateStatisticMessage(message));
		AppAPIs.registerAsObjectScopeProcessor(this.name, "Bookmarks", message => this.processUpdateBookmarkMessage(message));

		AppEvents.on(this.name, info => {
			const args = info.args;
			if ("Categories" === args.Type && "Updated" === args.Mode) {
				this.updateSidebarAsync();
			}
			else if (("Book" === args.Type && "Open" === args.Mode) || ("Chapter" === args.Type && "Open" === args.Mode)) {
				const book = Book.get(args.ID);
				if (book !== undefined && book.TotalChapters > 1) {
					this.updateTOCItem(book, args.Chapter || 1);
				}
			}
			else if ("Book" === args.Type && "Close" === args.Mode && this._reading.ID !== undefined) {
				this.updateSidebarAsync();
				this._reading.ID = undefined;
				this._reading.Chapter = undefined;
			}
		});

		AppEvents.on("App", info => {
			const args = info.args;
			if ("HomePage" === args.Type && "Open" === args.Mode && this._reading.ID !== undefined) {
				this.updateSidebarAsync();
				this._reading.ID = undefined;
			}
		});

		AppEvents.on("Session", info => {
			if ("LogOut" === info.args.Type) {
				this.bookmarks.clear();
				this.storeBookmarksAsync();
			}
		});

		AppEvents.on("Profile", info => {
			const args = info.args;
			if ("Updated" === args.Type && "APIs" === args.Mode) {
				this.getBookmarksAsync();
				if (this.configSvc.appConfig.services.active === this.name) {
					this.updateSidebarHeader();
				}
			}
		});
	}

	public async initializeAsync(onNext?: () => void) {
		this.prepareSidebarFooterItems();
		if (this.configSvc.isAuthenticated) {
			AppUtility.invoke(() => this.loadBookmarksAsync(() => this.fetchBookmarksAsync()), this.configSvc.appConfig.services.active === this.name ? 0 : 5678);
		}
		AppUtility.invoke(() => this.loadCategoriesAsync(() => this.fetchCategoriesAsync())
			.then(() => this.loadInstructionsAsync(() => this.fetchInstructionsAsync()))
			.then(() => this.searchBooksAsync({ FilterBy: { And: [{ Status: { NotEquals: "Inactive" } }] }, SortBy: { LastUpdated: "Descending" } }, () => AppEvents.broadcast(this.name, { Type: "Books", Mode: "Updated" })))
			.then(() => this.loadStatisticsAsync()), this.configSvc.appConfig.services.active === this.name ? 0 : 6789);
		if (this.configSvc.appConfig.services.active === this.name) {
			AppEvents.broadcast("ActiveSidebar", { Name: "books" });
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	private updateSidebarHeader() {
		const profile = this.configSvc.getAccount().profile;
		AppEvents.broadcast("UpdateSidebarHeader", {
			title: profile !== undefined ? profile.Name : this.configSvc.appConfig.app.name,
			onClick: profile !== undefined ? () => AppEvents.broadcast("Navigate", { Type: "Profile" }) : undefined
		});
	}

	private async updateSidebarAsync() {
		AppEvents.broadcast("UpdateSidebar", {
			name: "books",
			parent: { Title: await this.configSvc.getResourceAsync("books.home.statistics.categories") },
			items: this.categories.map(category => ({
				Title: category.Name,
				Link: `/books/category/${AppUtility.toANSI(category.Name, true)}`,
				Params: { "x-request": AppCrypto.jsonEncode({ Category: category.Name }) },
				Expanded: AppUtility.isGotData(category.Children),
				Direction: "root"
			})),
			index: this.menuIndex
		});
	}

	private prepareSidebarFooterItems(onNext?: () => void) {
		AppEvents.broadcast("UpdateSidebarFooter", { items: [{
			Name: "books",
			Icon: "library",
			Title: "eBooks",
			OnClick: (name: string, sidebar: AppSidebar) => {
				if (sidebar.Active !== name) {
					sidebar.Active = name;
					this.configSvc.appConfig.services.active = this.name;
					this.configSvc.appConfig.URLs.search = "/books/search";
					this.updateSidebarHeader();
					if (!sidebar.Visible) {
						sidebar.active(name, true);
					}
				}
			},
			Position: this.menuIndex
		}]});
		if (onNext !== undefined) {
			onNext();
		}
	}

	private getTOCItem(book: Book, index: number, isReading: boolean) {
		return {
			Title: book.TOCs[index],
			Icon: isReading ? { Name: "chevron-forward", Color: "primary", Slot: "end" } : undefined,
			OnClick: _ => AppEvents.broadcast(this.name, { Type: "Chapter", Mode: "Open", ID: book.ID, Chapter: index + 1 })
		} as AppSidebarMenuItem;
	}

	private updateTOCItem(book: Book, chapter: number) {
		if (book.ID !== this._reading.ID) {
			this._reading.ID = book.ID;
			this._reading.Chapter = chapter - 1;
			AppEvents.broadcast("UpdateSidebar", {
				name: "books",
				parent: {
					Title: book.Title,
					Thumbnail: book.Cover
				},
				items: book.TOCs.map((_, index) => this.getTOCItem(book, index, index === this._reading.Chapter)),
				index: this.menuIndex
			});
		}
		else {
			AppEvents.broadcast("UpdateSidebarItem", {
				menuIndex: this.menuIndex,
				itemIndex: this._reading.Chapter,
				itemInfo: this.getTOCItem(book, this._reading.Chapter, false)
			});
			this._reading.Chapter = chapter - 1;
			AppEvents.broadcast("UpdateSidebarItem", {
				menuIndex: this.menuIndex,
				itemIndex: this._reading.Chapter,
				itemInfo: this.getTOCItem(book, this._reading.Chapter, true)
			});
		}
	}

	public get completerDataSource() {
		const convertFn = (data: any) => {
			const book = data instanceof Book ? data as Book : Book.deserialize(data);
			return {
				title: book.Title,
				description: `${book.Author} - ${book.Category}`,
				image: book.Cover,
				originalObject: book
			};
		};
		return new AppCustomCompleter(
			term => AppUtility.format(this.getSearchingPath("book", this.configSvc.relatedQuery), { request: AppCrypto.jsonEncode(AppPagination.buildRequest({ Query: term })) }),
			data => (data.Objects as Array<any> || []).map(o => {
				Book.update(o);
				return convertFn(o);
			}),
			convertFn
		);
	}

	public searchBooks(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.search(
			this.getSearchingPath("book", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(o => Book.update(o));
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError)
		);
	}

	public searchBooksAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.searchAsync(
			this.getSearchingPath("book", this.configSvc.relatedQuery),
			request,
			data => {
				if (data !== undefined && AppUtility.isArray(data.Objects, true)) {
					(data.Objects as Array<any>).forEach(o => Book.update(o));
				}
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while searching", error, onError)
		);
	}

	public getBookAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontUpdateCounter: boolean = false) {
		const book = Book.get(id);
		return book !== undefined && (book.TOCs.length > 0 || AppUtility.isNotEmpty(book.Body))
			? AppUtility.invoke(onSuccess).then(dontUpdateCounter ? () => {} : () => this.updateBookCounterAsync(id))
			: this.readAsync(
					this.getPath("book", id),
					data => {
						Book.update(data);
						if (!dontUpdateCounter) {
							this.updateBookCounterAsync(id);
						}
						if (onSuccess !== undefined) {
							onSuccess(data);
						}
					},
					error => this.processError("Error occurred while reading", error, onError)
				);
	}

	public async getBookChapterAsync(id: string, chapter: number, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const book = Book.get(id);
		return book === undefined || book.TOCs.length < 1 || chapter < 1 || chapter > book.Chapters.length || book.Chapters[chapter - 1] !== ""
			? AppUtility.invoke(onSuccess)
			: this.readAsync(
					this.getPath("book", id, `chapter=${chapter}`),
					data => {
						this.updateBookChapter(data);
						this.updateBookCounterAsync(id, "view", onSuccess);
					},
					error => this.processError("Error occurred while reading a chapter", error, onError)
				);
	}

	private updateBookChapter(data: any) {
		const book = Book.get(data.ID);
		if (book !== undefined) {
			book.Chapters[data.Chapter - 1] = data.Content;
		}
	}

	public updateBookCounterAsync(id: string, action?: string, onSuccess?: (data?: any) => void) {
		return Book.instances.contains(id)
			? this.sendRequestAsync({
					ServiceName: this.name,
					ObjectName: "book",
					Verb: "GET",
					Query: {
						"object-identity": "counters",
						"id": id,
						"action": action || "view"
					}
				}, data => this.updateBookCounters(data, onSuccess))
			: AppUtility.invoke(onSuccess);
	}

	private updateBookCounters(data: any, onNext?: (data?: any) => void) {
		const book = AppUtility.isObject(data, true)
			? Book.get(data.ID)
			: undefined;
		if (book !== undefined && AppUtility.isArray(data.Counters, true)) {
			(data.Counters as Array<any>).forEach(counter => book.Counters.set(counter.Type, CounterInfo.deserialize(counter)));
			AppEvents.broadcast(this.name, { Type: "Statistics", Mode: "Updated", ID: book.ID });
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	public async generateEBookFilesAsync(id: string) {
		return Book.instances.contains(id)
			? this.sendRequestAsync({
					ServiceName: this.name,
					ObjectName: "book",
					Verb: "GET",
					Query: {
						"object-identity": "files",
						"id": id
					}
				}, data => this.updateEBookFiles(data))
			: AppUtility.promise;
	}

	private updateEBookFiles(data: any) {
		const book = data.ID !== undefined
			? Book.get(data.ID)
			: undefined;
		if (book !== undefined && AppUtility.isObject(data.Files, true)) {
			book.Files = data.Files;
			AppEvents.broadcast(this.name, { Type: "Files", Mode: "Updated", ID: book.ID });
		}
	}

	public requestUpdateBookAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.createAsync(
			this.getPath("book", body.ID),
			body,
			onSuccess,
			error => this.processError("Error occurred while requesting to update", error, onError)
		);
	}

	public updateBookAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.updateAsync(
			this.getPath("book", body.ID),
			body,
			onSuccess,
			error => this.processError("Error occurred while updating", error, onError)
	);
	}

	public deleteBookAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.deleteBookAsync(
			this.getPath("book", id),
			data => {
				Book.instances.remove(id);
				if (onSuccess !== undefined) {
					onSuccess(data);
				}
			},
			error => this.processError("Error occurred while deleting", error, onError)
		);
	}

	private processUpdateBookMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Counters":
				this.updateBookCounters(message.Data);
				break;
			case "Chapter":
				this.updateBookChapter(message.Data);
				break;
			case "Files":
				this.updateEBookFiles(message.Data);
				break;
			case "Delete":
				Book.instances.remove(message.Data.ID);
				AppEvents.broadcast(this.name, { Type: "Book", Mode: "Deleted", ID: message.Data.ID, Category: message.Data.Category, Author: message.Data.Author });
				break;
			default:
				if (AppUtility.isNotEmpty(message.Data.ID)) {
					Book.update(message.Data);
					AppEvents.broadcast(this.name, { Type: "Book", Mode: "Updated", ID: message.Data.ID });
				}
				else if (this.configSvc.isDebug) {
					console.warn(this.getMessage("Got an update"), message);
				}
				break;
		}
	}

	public get instructions(): { [key: string]: { [key: string]: string } } {
		return this.configSvc.appConfig.extras["Books-Instructions"] || {};
	}

	private updateInstructions(instructions: { [key: string]: string }) {
		const introductions = this.instructions;
		if (instructions !== undefined) {
			introductions[this.configSvc.appConfig.language] = instructions;
			AppEvents.broadcast(this.name, { Type: "Instructions", Mode: "Updated" });
		}
		this.configSvc.appConfig.extras["Books-Instructions"] = introductions;
	}

	private async loadInstructionsAsync(onNext?: () => void) {
		this.updateInstructions(await AppStorage.getAsync("Books-Instructions"));
		if (onNext !== undefined) {
			onNext();
		}
	}

	public fetchInstructionsAsync(onNext?: () => void) {
		return this.configSvc.getInstructionsAsync(
			this.name,
			this.configSvc.appConfig.language,
			async instructions => {
				this.updateInstructions(instructions);
				await this.storeInstructionsAsync(onNext);
			},
			error => this.showError("Error occurred while reading instructions", error)
		);
	}

	private async storeInstructionsAsync(onNext?: () => void) {
		await AppStorage.setAsync("Books-Instructions", this.instructions);
		if (onNext !== undefined) {
			onNext();
		}
	}

	public get categories(): Array<StatisticInfo> {
		return this.configSvc.appConfig.extras["Books-Categories"] || [];
	}

	public set categories(value: Array<StatisticInfo>) {
		if (value !== undefined && value.length > 0) {
			this.configSvc.appConfig.extras["Books-Categories"] = value;
		}
	}

	private async loadCategoriesAsync(onNext?: (categories?: Array<StatisticInfo>) => void) {
		this.categories = (await AppStorage.getAsync("Books-Categories") as Array<any> || []).map(category => StatisticInfo.deserialize(category));
		if (this.categories.length > 0) {
			AppEvents.broadcast(this.name, { Type: "Categories", Mode: "Loaded", Source: "Storage" });
		}
		if (onNext !== undefined) {
			onNext(this.categories);
		}
	}

	private fetchCategoriesAsync(onNext?: (categories?: Array<StatisticInfo>) => void) {
		return this.fetchAsync("statics/books.categories.json", async data => {
			this.categories = (data as Array<any>).map(category => StatisticInfo.deserialize(category));
			if (this.categories.length > 0) {
				AppEvents.broadcast(this.name, { Type: "Categories", Mode: "Updated", Source: "APIs" });
				await this.storeCategoriesAsync(onNext);
			}
			else if (onNext !== undefined) {
				onNext(this.categories);
			}
		});
	}

	private async storeCategoriesAsync(onNext?: (categories?: Array<StatisticInfo>) => void) {
		await AppStorage.setAsync("Books-Categories", this.categories);
		if (onNext !== undefined) {
			onNext(this.categories);
		}
	}

	public get authors(): Dictionary<string, Array<StatisticBase>> {
		return this.configSvc.appConfig.extras["Books-Authors"] || new Dictionary<string, Array<StatisticBase>>();
	}

	private async loadAuthorsAsync(onNext?: (authors?: Dictionary<string, Array<StatisticBase>>) => void) {
		const authors = new Dictionary<string, Array<StatisticBase>>();
		await Promise.all(AppUtility.getChars().map(async char => {
			const authours = (await AppStorage.getAsync(`Books-Authors-${char}`) as Array<any> || []).map(s => StatisticBase.deserialize(s));
			authors.set(char, authours);
		}));
		this.configSvc.appConfig.extras["Books-Authors"] = authors;
		if (this.authors.size > 0) {
			AppEvents.broadcast(this.name, { Type: "Authors", Mode: "Loaded", Data: authors });
		}
		if (onNext !== undefined) {
			onNext(this.authors);
		}
	}

	private async storeAuthorsAsync(onNext?: (authors?: Dictionary<string, Array<StatisticBase>>) => void) {
		const authors = this.authors;
		await Promise.all(AppUtility.getChars().map(char => AppStorage.setAsync(`Books-Authors-${char}`, authors.get(char) || [])));
		AppEvents.broadcast(this.name, { Type: "Authors", Mode: "Updated", Data: authors });
		if (onNext !== undefined) {
			onNext(this.authors);
		}
	}

	public get status() {
		const status = this.configSvc.appConfig.extras["Books-Status"] !== undefined
			? this.configSvc.appConfig.extras["Books-Status"] as Array<StatisticBase>
			: new Array<StatisticBase>();
		return {
			Books: (status.find(s => s.Name === "Books") || new StatisticBase()).Counters,
			Authors: (status.find(s => s.Name === "Authors") || new StatisticBase()).Counters
		};
	}

	private loadStatisticsAsync(onNext?: () => void) {
		return Promise.all([
			this.loadAuthorsAsync(),
			this.sendRequestAsync({
				ServiceName: this.name,
				ObjectName: "statistic",
				Query: {
					"object-identity": "all"
				}
			})
		]).then(() => AppUtility.invoke(onNext));
	}

	private processUpdateStatisticMessage(message: AppMessage) {
		switch (message.Type.Event) {
			case "Categories":
				this.categories = (message.Data.Objects as Array<any>).map(s => StatisticInfo.deserialize(s));
				this.storeCategoriesAsync();
				break;

			case "Authors":
				const authors = this.authors;
				authors.set(message.Data.Char, (message.Data.Objects as Array<any>).map(s => StatisticBase.deserialize(s)));
				this.configSvc.appConfig.extras["Books-Authors"] = authors;
				this.storeAuthorsAsync();
				break;

			case "Status":
				AppUtility.invoke(() => this.configSvc.appConfig.extras["Books-Status"] = (message.Data.Objects as Array<any>).map(s => StatisticBase.deserialize(s)));
				break;
		}
	}

	public get readingOptions() {
		this.configSvc.appConfig.options.extras[this.name] =
			this.configSvc.appConfig.options.extras[this.name] || {
				font: "default",
				size: "normal",
				color: "white",
				paragraph: "one",
				align: "align-left"
			};
		return this.configSvc.appConfig.options.extras[this.name] as { font: string, size: string, color: string, paragraph: string, align: string };
	}

	public get bookmarks() {
		this.configSvc.appConfig.extras["Books-Bookmarks"] = this.configSvc.appConfig.extras["Books-Bookmarks"] || new Dictionary<string, Bookmark>();
		return this.configSvc.appConfig.extras["Books-Bookmarks"] as Dictionary<string, Bookmark>;
	}

	private async loadBookmarksAsync(onNext?: () => void) {
		const bookmarks = new Dictionary<string, Bookmark>();
		(await AppStorage.getAsync("Books-Bookmarks") as Array<any> || []).forEach(data => {
			const bookmark = Bookmark.deserialize(data);
			bookmarks.set(bookmark.ID, bookmark);
			AppEvents.broadcast(this.name, { Type: "Bookmarks", Mode: "Loaded" });
		});
		this.configSvc.appConfig.extras["Books-Bookmarks"] = bookmarks;
		if (onNext !== undefined) {
			onNext();
		}
	}

	private async storeBookmarksAsync(onNext?: () => void) {
		await AppStorage.setAsync("Books-Bookmarks", this.bookmarks.toArray());
		AppEvents.broadcast(this.name, { Type: "Bookmarks", Mode: "Updated" });
		if (onNext !== undefined) {
			onNext();
		}
	}

	private fetchBookmarksAsync(onNext?: () => void) {
		return Promise.all(this.bookmarks.toArray(bookmark => !Book.instances.contains(bookmark.ID)).map(bookmark => this.getBookAsync(bookmark.ID))).then(() => AppUtility.invoke(onNext));
	}

	private getBookmarksAsync(onNext?: () => void) {
		return this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "bookmarks"
		}, data => this.updateBookmarksAsync(data, onNext));
	}

	private updateBookmarksAsync(data: any, onNext?: () => void) {
		const bookmarks = this.bookmarks;
		if (AppUtility.isTrue(data.Sync)) {
			bookmarks.clear();
		}
		(data.Objects as Array<any> || []).forEach(b => {
			const bookmark = Bookmark.deserialize(b);
			if (!bookmarks.contains(bookmark.ID)) {
				bookmarks.set(bookmark.ID, bookmark);
			}
			else if (bookmark.Time > bookmarks.get(bookmark.ID).Time) {
				bookmarks.set(bookmark.ID, bookmark);
			}
		});
		return this.storeBookmarksAsync(() => this.fetchBookmarksAsync(onNext));
	}

	public updateBookmarkAsync(id: string, chapter: number, position: number, onNext?: () => void) {
		const bookmarks = this.bookmarks;
		const bookmark = bookmarks.get(id) || new Bookmark();
		bookmark.ID = id;
		bookmark.Chapter = chapter;
		bookmark.Position = position;
		bookmark.Time = new Date();
		bookmarks.set(bookmark.ID, bookmark);
		return this.storeBookmarksAsync(onNext);
	}

	public sendBookmarksAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		return this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "bookmarks",
			Verb: "POST",
			Body: this.bookmarks.toArray().sortBy({ name: "Time", reverse: true }).take(30)
		}, onSuccess, onError);
	}

	public deleteBookmarkAsync(id: string, onNext?: () => void) {
		return this.sendRequestAsync(
			{
				ServiceName: this.name,
				ObjectName: "bookmarks",
				Verb: "DELETE",
				Query: {
					"object-identity": id
				}
			},
			() => {
				this.bookmarks.remove(id);
				this.storeBookmarksAsync(onNext);
			}
		);
	}

	private processUpdateBookmarkMessage(message: AppMessage) {
		const account = this.configSvc.getAccount();
		if (this.configSvc.isAuthenticated && account.id === message.Data.ID) {
			const profile = account.profile;
			if (profile !== undefined) {
				profile.LastSync = new Date();
			}
			if ("Delete" === message.Type.Event) {
				this.bookmarks.remove(message.Data.ID);
				this.storeBookmarksAsync();
			}
			else {
				this.updateBookmarksAsync(message.Data);
			}
		}
	}

	public sendRequestToCrawlAsync(url: string, onNext?: () => void) {
		return this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "crawl",
			Query: {
				url: url
			}
		}, onNext);
	}

	public sendRequestToReCrawlAsync(id: string, url: string, mode: string) {
		return this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "book",
			Query: {
				"object-identity": "recrawl",
				"id": id,
				"url": url,
				"full": `${"full" === mode}`
			}
		});
	}

}
