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
		this.initialize();
	}

	private _reading = {
		ID: undefined as string,
		Chapter: undefined as number
	};

	private get menuIndex() {
		return this.configSvc.appConfig.services.all.length > 1 ? 4 : 0;
	}

	private initialize() {
		AppAPIs.registerAsServiceScopeProcessor("Scheduler", () => {
			if (this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				AppUtility.invoke(async () => {
					const profile = this.configSvc.getAccount().profile;
					if (profile !== undefined) {
						await this.sendBookmarksAsync(() => profile.LastSync = new Date());
					}
				}, 123);
			}
		});

		AppAPIs.registerAsObjectScopeProcessor(this.name, "Book", message => this.processUpdateBookMessage(message));
		AppAPIs.registerAsObjectScopeProcessor(this.name, "Statistic", async message => await this.processUpdateStatisticMessageAsync(message));
		AppAPIs.registerAsObjectScopeProcessor(this.name, "Bookmarks", async message => await this.processUpdateBookmarkMessageAsync(message));

		AppEvents.on("App", info => {
			if ("HomePageIsOpened" === info.args.Type && this._reading.ID !== undefined && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				AppUtility.invoke(async () => await this.updateSidebarAsync(), 13);
				this._reading.ID = undefined;
			}
		});

		AppEvents.on("Session", info => {
			if (("LogIn" === info.args.Type || "LogOut" === info.args.Type) && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				AppUtility.invoke(() => this.prepareSidebarFooterButtons(), this.configSvc.appConfig.services.active === this.name ? 456 : 789);
				if ("LogIn" === info.args.Type) {
					AppUtility.invoke(() => this.prepareSidebarFooterButtons(), 3456);
				}
				else if ("LogOut" === info.args.Type) {
					this.bookmarks.clear();
					AppUtility.invoke(async () => await this.storeBookmarksAsync(), 13);
				}
			}
		});

		AppEvents.on("Profile", info => {
			if ("Updated" === info.args.Type && "APIs" === info.args.Mode && this.configSvc.appConfig.services.all.findIndex(svc => svc.name === this.name) > -1) {
				AppUtility.invoke(async () => await this.getBookmarksAsync(), 123);
				if (this.configSvc.appConfig.services.active === this.name) {
					this.updateSidebarTitle();
				}
			}
		});

		AppEvents.on(this.name, info => {
			if ("CategoriesUpdated" === info.args.Type) {
				AppUtility.invoke(async () => await this.updateSidebarAsync(), 13);
			}
			else if ("OpenBook" === info.args.Type || "OpenChapter" === info.args.Type) {
				const book = Book.get(info.args.ID);
				if (book !== undefined && book.TotalChapters > 1) {
					this.updateReading(book, info.args.Chapter || 1);
				}
			}
			else if ("CloseBook" === info.args.Type && this._reading.ID !== undefined) {
				AppUtility.invoke(async () => await this.updateSidebarAsync(), 13);
				this._reading.ID = undefined;
				this._reading.Chapter = undefined;
			}
		});
	}

	public async initializeAsync(onNext?: () => void) {
		this.prepareSidebarFooterButtons();
		await this.searchBooksAsync({ FilterBy: { And: [{ Status: { NotEquals: "Inactive" } }] }, SortBy: { LastUpdated: "Descending" } }, () => AppEvents.broadcast("Books", { Type: "BooksUpdated" }));
		if (this.configSvc.isAuthenticated) {
			await this.loadBookmarksAsync(async () => await this.fetchBookmarksAsync());
		}
		await Promise.all([
			this.loadCategoriesAsync(async () => await this.fetchCategoriesAsync()),
			this.loadInstructionsAsync(async () => await this.fetchInstructionsAsync()),
			this.loadStatisticsAsync()
		]);
		if (this.configSvc.appConfig.services.active === this.name) {
			AppEvents.broadcast("ActiveSidebar", { Name: "books" });
		}
		AppUtility.invoke(() => this.prepareSidebarFooterButtons(), 3456);
		if (onNext !== undefined) {
			onNext();
		}
	}

	private updateSidebarTitle() {
		AppUtility.invoke(() => {
			const profile = this.configSvc.getAccount().profile;
			AppEvents.broadcast("UpdateSidebarTitle", {
				Title: profile !== undefined ? profile.Name : this.configSvc.appConfig.app.name,
				OnClick: profile !== undefined ? () => AppEvents.broadcast("Navigate", { Type: "Profile" }) : undefined
			});
		}, 13);
	}

	private async updateSidebarAsync() {
		AppEvents.broadcast("UpdateSidebar", {
			Index: this.menuIndex,
			Reset: true,
			Name: "books",
			Parent: { Title: await this.configSvc.getResourceAsync("books.home.statistics.categories") },
			Items: this.categories.map(category => ({
				Title: category.Name,
				Link: `/books/category/${AppUtility.toANSI(category.Name, true)}`,
				Params: { "x-request": AppCrypto.jsonEncode({ Category: category.Name }) },
				Expanded: AppUtility.isGotData(category.Children),
				Direction: "root"
			}))
		});
	}

	private prepareSidebarFooterButtons(onNext?: () => void) {
		AppEvents.broadcast("UpdateSidebarFooter", {
			Button: {
				Name: "books",
				Icon: "library",
				Title: "eBooks",
				OnClick: (name: string, sidebar: AppSidebar) => {
					if (sidebar.Active !== name) {
						sidebar.Active = name;
						this.configSvc.appConfig.services.active = this.name;
						this.configSvc.appConfig.URLs.search = "/books/search";
						this.updateSidebarTitle();
						if (!sidebar.Visible) {
							AppUtility.invoke(() => AppEvents.broadcast("OpenSidebar", { Name: name }), 13);
						}
					}
				}
			},
			Index: this.menuIndex,
			Predicate: (sidebar: AppSidebar) => sidebar.Footer.findIndex(btn => btn.Name === "books") < 0,
			OnCompleted: (sidebar: AppSidebar) => {
				const index = sidebar.Footer.length > 1 ? sidebar.Footer.findIndex(btn => btn.Name === "books") : 0;
				if (index > 0 && sidebar.Footer[index - 1].Name === "preferences") {
					sidebar.Footer.move(index, index - 1);
				}
			}
		});
		if (onNext !== undefined) {
			onNext();
		}
	}

	private getTOCItem(book: Book, index: number, isReading: boolean) {
		return {
			Title: book.TOCs[index],
			Detail: isReading,
			Icon: { Color: "primary" },
			OnClick: _ => AppEvents.broadcast("Books", { Type: "OpenChapter", ID: book.ID, Chapter: index + 1 })
		} as AppSidebarMenuItem;
	}

	private updateReading(book: Book, chapter: number) {
		if (book.ID !== this._reading.ID) {
			this._reading.ID = book.ID;
			this._reading.Chapter = chapter - 1;
			AppEvents.broadcast("UpdateSidebar", {
				Index: this.menuIndex,
				Reset: true,
				Name: "books",
				Parent: {
					Title: book.Title,
					Thumbnail: book.Cover
				},
				Items: book.TOCs.map((_, index) => this.getTOCItem(book, index, index === this._reading.Chapter))
			});
		}
		else {
			AppEvents.broadcast("UpdateSidebarItem", {
				MenuIndex: this.menuIndex,
				ItemIndex: this._reading.Chapter,
				ItemInfo: this.getTOCItem(book, this._reading.Chapter, false)
			});
			this._reading.Chapter = chapter - 1;
			AppEvents.broadcast("UpdateSidebarItem", {
				MenuIndex: this.menuIndex,
				ItemIndex: this._reading.Chapter,
				ItemInfo: this.getTOCItem(book, this._reading.Chapter, true)
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

	public async searchBooksAsync(request: AppDataRequest, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.searchAsync(
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

	public async getBookAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void, dontUpdateCounter: boolean = false) {
		const book = Book.get(id);
		if (book !== undefined && (book.TOCs.length > 0 || AppUtility.isNotEmpty(book.Body))) {
			if (!dontUpdateCounter) {
				await this.updateBookCounterAsync(id);
			}
			if (onSuccess !== undefined) {
				onSuccess();
			}
		}
		else {
			await this.readAsync(
				this.getPath("book", id),
				async data => {
					Book.update(data);
					if (!dontUpdateCounter) {
						await this.updateBookCounterAsync(id);
					}
					if (onSuccess !== undefined) {
						onSuccess(data);
					}
				},
				error => {
					console.error(this.getError("Error occurred while reading", error));
					if (onError !== undefined) {
						onError(error);
					}
				}
			);
		}
	}

	public async getBookChapterAsync(id: string, chapter: number, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		const book = Book.get(id);
		if (book === undefined || book.TOCs.length < 1 || chapter < 1 || chapter > book.Chapters.length || book.Chapters[chapter - 1] !== "") {
			if (onSuccess !== undefined) {
				onSuccess();
			}
		}
		else {
			await this.readAsync(
				this.getPath("book", id, `chapter=${chapter}`),
				async data => {
					this.updateBookChapter(data);
					await this.updateBookCounterAsync(id, "view", onSuccess);
				},
				error => this.processError("Error occurred while reading a chapter", error, onError)
			);
		}
	}

	private updateBookChapter(data: any) {
		const book = Book.get(data.ID);
		if (book !== undefined) {
			book.Chapters[data.Chapter - 1] = data.Content;
		}
	}

	public async updateBookCounterAsync(id: string, action?: string, onSuccess?: (data?: any) => void) {
		if (Book.instances.contains(id)) {
			await this.sendRequestAsync({
				ServiceName: this.name,
				ObjectName: "book",
				Verb: "GET",
				Query: {
					"object-identity": "counters",
					"id": id,
					"action": action || "view"
				}
			}, data => this.updateBookCounters(data, onSuccess));
		}
		else if (onSuccess !== undefined) {
			onSuccess();
		}
	}

	private updateBookCounters(data: any, onNext?: (data?: any) => void) {
		const book = AppUtility.isObject(data, true)
			? Book.get(data.ID)
			: undefined;
		if (book !== undefined && AppUtility.isArray(data.Counters, true)) {
			(data.Counters as Array<any>).forEach(counter => book.Counters.set(counter.Type, CounterInfo.deserialize(counter)));
			AppEvents.broadcast("Books", { Type: "StatisticsUpdated", ID: book.ID });
		}
		if (onNext !== undefined) {
			onNext(data);
		}
	}

	public async generateEBookFilesAsync(id: string) {
		if (Book.instances.contains(id)) {
			await this.sendRequestAsync({
				ServiceName: this.name,
				ObjectName: "book",
				Verb: "GET",
				Query: {
					"object-identity": "files",
					"id": id
				}
			}, data => this.updateEBookFiles(data));
		}
	}

	private updateEBookFiles(data: any) {
		const book = data.ID !== undefined
			? Book.get(data.ID)
			: undefined;
		if (book !== undefined && AppUtility.isObject(data.Files, true)) {
			book.Files = data.Files;
			AppEvents.broadcast("Books", { Type: "FilesUpdated", ID: book.ID });
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

	public async updateBookAsync(body: any, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await super.updateAsync(
			this.getPath("book", body.ID),
			body,
			onSuccess,
			error => this.processError("Error occurred while updating", error, onError)
	);
	}

	public async deleteBookAsync(id: string, onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.deleteBookAsync(
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
				AppEvents.broadcast("Books", { Type: "Deleted", ID: message.Data.ID, Category: message.Data.Category, Author: message.Data.Author });
				break;
			default:
				if (AppUtility.isNotEmpty(message.Data.ID)) {
					Book.update(message.Data);
					AppEvents.broadcast("Books", { Type: "Updated", ID: message.Data.ID });
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
			AppEvents.broadcast("Books", { Type: "InstructionsUpdated" });
		}
		this.configSvc.appConfig.extras["Books-Instructions"] = introductions;
	}

	private async loadInstructionsAsync(onNext?: () => void) {
		this.updateInstructions(await AppStorage.getAsync("Books-Instructions"));
		if (onNext !== undefined) {
			onNext();
		}
	}

	public async fetchInstructionsAsync(onNext?: () => void) {
		await this.configSvc.getInstructionsAsync(
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
			AppEvents.broadcast("Books", { Type: "CategoriesUpdated", Mode: "Storage" });
		}
		if (onNext !== undefined) {
			onNext(this.categories);
		}
	}

	private async fetchCategoriesAsync(onNext?: (categories?: Array<StatisticInfo>) => void) {
		await this.fetchAsync("statics/books.categories.json", async data => {
			this.categories = (data as Array<any>).map(category => StatisticInfo.deserialize(category));
			if (this.categories.length > 0) {
				AppEvents.broadcast("Books", { Type: "CategoriesUpdated", Mode: "APIs" });
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

	private async loadAuthorsAsync(onSuccess?: (authors?: Dictionary<string, Array<StatisticBase>>) => void) {
		const authors = new Dictionary<string, Array<StatisticBase>>();
		await Promise.all(AppUtility.getChars().map(async char => {
			const authours = (await AppStorage.getAsync(`Books-Authors-${char}`) as Array<any> || []).map(s => StatisticBase.deserialize(s));
			authors.set(char, authours);
		}));
		this.configSvc.appConfig.extras["Books-Authors"] = authors;
		if (this.authors.size > 0) {
			AppEvents.broadcast("Books", { Type: "AuthorsUpdated", Data: authors });
		}
		if (onSuccess !== undefined) {
			onSuccess(this.authors);
		}
	}

	private async storeAuthorsAsync(onSuccess?: (authors?: Dictionary<string, Array<StatisticBase>>) => void) {
		const authors = this.authors;
		await Promise.all(AppUtility.getChars().map(char => AppStorage.setAsync(`Books-Authors-${char}`, authors.get(char) || [])));
		AppEvents.broadcast("Books", { Type: "AuthorsUpdated", Data: authors });
		if (onSuccess !== undefined) {
			onSuccess(this.authors);
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

	private async loadStatisticsAsync(onSuccess?: () => void) {
		await Promise.all([
			this.loadAuthorsAsync(),
			this.sendRequestAsync({
				ServiceName: this.name,
				ObjectName: "statistic",
				Query: {
					"object-identity": "all"
				}
			})
		]);
		if (onSuccess !== undefined) {
			onSuccess();
		}
	}

	private processUpdateStatisticMessageAsync(message: AppMessage) {
		switch (message.Type.Event) {
			case "Categories":
				this.categories = (message.Data.Objects as Array<any>).map(s => StatisticInfo.deserialize(s));
				return this.storeCategoriesAsync();

			case "Authors":
				const authors = this.authors;
				authors.set(message.Data.Char, (message.Data.Objects as Array<any>).map(s => StatisticBase.deserialize(s)));
				this.configSvc.appConfig.extras["Books-Authors"] = authors;
				return this.storeAuthorsAsync();

			case "Status":
				return new Promise<void>(() => this.configSvc.appConfig.extras["Books-Status"] = (message.Data.Objects as Array<any>).map(s => StatisticBase.deserialize(s)));

			default:
				return new Promise<void>(message.Type.Event === "All" ? () => {} : () => console.warn(this.getMessage("Got an update message"), message));
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
		});
		this.configSvc.appConfig.extras["Books-Bookmarks"] = bookmarks;
		if (onNext !== undefined) {
			onNext();
		}
	}

	private async storeBookmarksAsync(onNext?: () => void) {
		await AppStorage.setAsync("Books-Bookmarks", this.bookmarks.toArray());
		AppEvents.broadcast("Books", { Type: "BookmarksUpdated" });
		if (onNext !== undefined) {
			onNext();
		}
	}

	private async fetchBookmarksAsync(onNext?: () => void) {
		await Promise.all(this.bookmarks.toArray(bookmark => !Book.instances.contains(bookmark.ID)).map(bookmark => this.getBookAsync(bookmark.ID)));
		if (onNext !== undefined) {
			onNext();
		}
	}

	private async getBookmarksAsync(onNext?: () => void) {
		await this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "bookmarks"
		}, async data => await this.updateBookmarksAsync(data, onNext));
	}

	private async updateBookmarksAsync(data: any, onNext?: () => void) {
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
		await this.storeBookmarksAsync(async () => await this.fetchBookmarksAsync(onNext));
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

	public async sendBookmarksAsync(onSuccess?: (data?: any) => void, onError?: (error?: any) => void) {
		await this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "bookmarks",
			Verb: "POST",
			Body: this.bookmarks.toArray().sortBy({ name: "Time", reverse: true }).take(30)
		}, onSuccess, onError);
	}

	public async deleteBookmarkAsync(id: string, onNext?: () => void) {
		await this.sendRequestAsync(
			{
				ServiceName: this.name,
				ObjectName: "bookmarks",
				Verb: "DELETE",
				Query: {
					"object-identity": id
				}
			},
			async _ => {
				this.bookmarks.remove(id);
				await this.storeBookmarksAsync();
				if (onNext !== undefined) {
					onNext();
				}
			}
		);
	}

	private async processUpdateBookmarkMessageAsync(message: AppMessage) {
		const account = this.configSvc.getAccount();
		if (this.configSvc.isAuthenticated && account.id === message.Data.ID) {
			const profile = account.profile;
			if (profile !== undefined) {
				profile.LastSync = new Date();
			}
			if ("Delete" === message.Type.Event) {
				this.bookmarks.remove(message.Data.ID);
				await this.storeBookmarksAsync();
			}
			else {
				await this.updateBookmarksAsync(message.Data);
			}
		}
	}

	public async sendRequestToCrawlAsync(url: string, onNext?: () => void) {
		await this.sendRequestAsync({
			ServiceName: this.name,
			ObjectName: "crawl",
			Query: {
				url: url
			}
		}, onNext);
	}

	public async sendRequestToReCrawlAsync(id: string, url: string, mode: string) {
		await this.sendRequestAsync({
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
