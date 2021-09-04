import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { IonContent, IonSearchbar, IonInfiniteScroll } from "@ionic/angular";
import { AppEvents } from "@app/components/app.events";
import { AppPagination } from "@app/components/app.pagination";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { BooksService } from "@app/services/books.service";
import { Book } from "@app/models/book";
import { RatingPoint } from "@app/models/rating.point";

@Component({
	selector: "page-books-list",
	templateUrl: "./list.page.html",
	styleUrls: ["./list.page.scss"]
})

export class BooksListPage implements OnInit, OnDestroy, AfterViewInit {
	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private booksSvc: BooksService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	filterBy: AppDataFilter = {
		Query: undefined as string,
		And: [
			{
				Category: {
					Equals: undefined as string
				}
			},
			{
				Author: {
					Equals: undefined as string
				}
			},
			{
				Status: {
					NotEquals: "Inactive"
				}
			}
		] as Array<{ [key: string]: any }>
	};
	sorts = [
		{
			label: "Last updated",
			value: "LastUpdated",
			expression: { LastUpdated: "Descending" } as { [key: string]: any }
		},
		{
			label: "Title (A - Z)",
			value: "Title"
		},
		{
			label: "Chapters",
			value: "Chapters"
		}
	];
	sort = this.sorts[0].value;
	pageNumber = 0;
	pagination: AppDataPagination;
	request: AppDataRequest;
	requestParams: { [key: string]: any };

	books = new Array<Book>();
	objects = new Array<Book>();
	ratings: { [key: string]: RatingPoint };

	title = "";
	uri = "";
	cancel = "";

	asGrid = true;
	filtering = false;
	searching = false;
	actions: Array<{
		text: string,
		role: string,
		icon: string,
		handler: () => void
	}>;
	subscription: Subscription;

	@ViewChild(IonContent, { static: true }) private contentCtrl: IonContent;
	@ViewChild(IonSearchbar, { static: true }) private searchCtrl: IonSearchbar;
	@ViewChild(IonInfiniteScroll, { static: true }) private infiniteScrollCtrl: IonInfiniteScroll;

	get color() {
		return this.configSvc.color;
	}

	get sortBy() {
		return this.sorts.first().expression;
	}

	getFilterElement(name: string) {
		const element = this.filterBy.And.find(e => e[name] !== undefined);
		return element !== undefined ? element[name] : undefined;
	}

	get category() {
		return this.getFilterElement("Category").Equals as string;
	}

	set category(value: string) {
		this.getFilterElement("Category").Equals = value;
	}

	get author() {
		return this.getFilterElement("Author").Equals as string;
	}

	set author(value: string) {
		this.getFilterElement("Author").Equals = value;
	}

	get showBackButton() {
		return this.searching || this.filtering || this.author !== undefined;
	}

	get hideCategory() {
		return this.searching ? true : this.category !== undefined;
	}

	get hideAuthor() {
		return this.searching ? false : this.author !== undefined;
	}

	get displayAsGrid() {
		return this.asGrid && !this.searching;
	}

	get totalRecords() {
		return AppPagination.computeTotal(this.pageNumber, this.pagination);
	}

	get eventIdentity() {
		const category = this.category;
		const author = this.author;
		return "@Books:" + (category !== undefined ? category : author !== undefined ? author : "Search");
	}

	get locale() {
		return this.configSvc.locale;
	}

	ngOnInit() {
		this.initializeAsync();
		if (!this.searching) {
			AppEvents.on("Session", info => {
				if ("Updated" === info.args.Type) {
					this.prepareActionsAsync();
				}
			}, `AccountEventHandlers${this.eventIdentity}`);
			AppEvents.on(this.booksSvc.name, info => {
				const category = this.category;
				const author = this.author;
				const reprepareResults = "Deleted" === info.args.Type
					? category !== undefined
						? category === info.args.Category
						: author !== undefined
							? author === info.args.Author
							: false
					: "Moved" === info.args.Type
						? category !== undefined && (category === info.args.From || category === info.args.To)
						: false;
				if (reprepareResults) {
					this.prepareResults();
				}
			}, `BookEventHandlers${this.eventIdentity}`);
		}
	}

	ngOnDestroy() {
		if (!this.searching) {
			AppEvents.off("Session", `AccountEventHandlers${this.eventIdentity}`);
			AppEvents.off(this.booksSvc.name, `BookEventHandlers${this.eventIdentity}`);
		}
		else if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	ngAfterViewInit() {
		if (this.searching) {
			PlatformUtility.focus(this.searchCtrl);
		}
	}

	private get paginationPrefix() {
		return `book@${this.booksSvc.name}`.toLowerCase();
	}

	async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.requestParams = this.configSvc.requestParams;
		this.searching = this.configSvc.currentURL.startsWith("/books/search");
		const category = this.category = this.requestParams["Category"];
		const author = this.author = this.requestParams["Author"];

		this.configSvc.appTitle = this.title = this.searching
			? await this.configSvc.getResourceAsync("books.list.title.search")
			: category !== undefined
				? await this.configSvc.getResourceAsync("books.list.title.category", { category: category })
				: await this.configSvc.getResourceAsync("books.list.title.author", { author: author });

		this.sorts.forEach(async sort => sort.label = await this.configSvc.getResourceAsync(`books.list.sort.labels.${sort.value}`));
		this.searchCtrl.placeholder = await this.configSvc.getResourceAsync(`books.list.searchbar.${(this.searching ? "search" : "filter")}`);
		this.cancel = await this.configSvc.getResourceAsync("common.buttons.cancel");
		this.uri = this.searching
				? "/books/search"
				: category !== undefined
					? `/books/category/${AppUtility.toANSI(category, true)}?x-request=`
					: `/books/author/${AppUtility.toANSI(author, true)}?x-request=`;

		if (this.searching) {
			this.appFormsSvc.hideLoadingAsync(() => PlatformUtility.focus(this.searchCtrl));
		}
		else {
			if (category === undefined && author === undefined) {
				this.appFormsSvc.hideLoadingAsync(() => this.appFormsSvc.showToastAsync("Hmmm...").then(() => this.configSvc.navigateRootAsync()));
			}
			else {
				this.ratings = {};
				this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.paginationPrefix) || AppPagination.getDefault();
				this.pagination.PageNumber = this.pageNumber;
				this.search(() => this.appFormsSvc.hideLoadingAsync(() => this.prepareActionsAsync().then(() => this.trackAsync())));
			}
		}
	}

	onSearch(event: any) {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (AppUtility.isNotEmpty(event.detail.value)) {
			this.filterBy.Query = event.detail.value;
			if (this.searching) {
				this.books = [];
				this.ratings = {};
				this.pageNumber = 0;
				this.pagination = AppPagination.getDefault();
				this.search(() => this.infiniteScrollCtrl.disabled = false);
			}
			else {
				this.books = this.objects.filter(Book.getFilterBy(this.filterBy.Query));
			}
		}
		else {
			this.onClear();
		}
	}

	onClear(isOnCanceled: boolean = false) {
		if (this.searching || this.filtering) {
			this.filterBy.Query = undefined;
			this.books = this.filtering ? this.objects.map(obj => obj) : [];
			if (isOnCanceled) {
				this.filtering = false;
				this.infiniteScrollCtrl.disabled = false;
				this.objects = [];
			}
		}
	}

	onCancel() {
		this.onClear(this.filtering);
		if (this.searching) {
			this.configSvc.navigateBackAsync();
		}
	}

	onInfiniteScroll() {
		if (this.pagination.PageNumber < this.pagination.TotalPages) {
			this.search(() => this.infiniteScrollCtrl.complete().then(() => this.trackAsync()));
		}
		else {
			this.infiniteScrollCtrl.complete().then(() => this.infiniteScrollCtrl.disabled = true);
		}
	}

	search(onNext?: () => void) {
		this.request = AppPagination.buildRequest(this.filterBy, this.searching ? undefined : this.sortBy, this.pagination);
		const onSuccess = (data: any) => {
			this.pageNumber++;
			this.pagination = data !== undefined ? AppPagination.getDefault(data) : AppPagination.get(this.request, this.paginationPrefix);
			this.pagination.PageNumber = this.pageNumber;
			this.prepareResults(onNext, data !== undefined ? data.Objects : undefined);
		};
		if (this.searching) {
			this.subscription = this.booksSvc.searchBooks(this.request, onSuccess, error => this.trackAsync().then(() => this.appFormsSvc.showErrorAsync(error)));
		}
		else {
			this.booksSvc.searchBooksAsync(this.request, onSuccess, error => this.trackAsync().then(() => this.appFormsSvc.showErrorAsync(error)));
		}
	}

	prepareResults(onNext?: () => void, results?: Array<any>) {
		if (this.searching) {
			(results || []).forEach(obj => {
				const book = Book.instances.get(obj.ID);
				this.books.push(book);
				this.ratings[book.ID] = book.RatingPoints.get("General");
			});
		}
		else {
			// prepare the predicate for filtering
			const query = this.filtering && AppUtility.isNotEmpty(this.filterBy.Query)
				? AppUtility.toANSI(this.filterBy.Query).trim().toLowerCase()
				: "";
			const category = this.category;
			const filterByCategory = AppUtility.isNotEmpty(category);
			const author = this.author;
			const filterByAuthor = AppUtility.isNotEmpty(author);
			const predicate: (book: Book) => boolean = this.filtering || results === undefined
				? obj => query !== "" || filterByCategory || filterByAuthor
					? (query !== "" ? obj.ansiTitle.indexOf(query) > -1 : true) && (filterByCategory ? obj.Category.startsWith(category) : true) && (filterByAuthor ? obj.Author === author : true)
					: true
				: _ => true;

			// initialize the list
			let objects = results === undefined
				? Book.instances.toList(predicate)
				: Book.toList(results).Where(predicate);

			// sort
			switch (this.sort) {
				case "Chapters":
					objects = objects.OrderByDescending(obj => obj.TotalChapters).ThenBy(obj => obj.LastUpdated);
					break;
				case "Title":
					objects = objects.OrderBy(obj => obj.Title).ThenByDescending(obj => obj.LastUpdated);
					break;
				default:
					objects = objects.OrderByDescending(obj => obj.LastUpdated);
					break;
			}

			if (results === undefined) {
				if (this.filtering) {
					this.books = objects.ToArray();
				}
				else {
					objects = objects.Take(this.pageNumber * this.pagination.PageSize);
					objects.ForEach(obj => this.ratings[obj.ID] = obj.RatingPoints.get("General"));
					this.books = objects.ToArray();
				}
			}
			else {
				objects.ForEach(obj => this.ratings[obj.ID] = obj.RatingPoints.get("General"));
				this.books = this.books.concat(objects.ToArray());
			}
		}

		// callback
		if (onNext !== undefined) {
			onNext();
		}
	}

	async prepareActionsAsync() {
		this.actions = [
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.list.actions.search"), "search", () => this.configSvc.navigateForwardAsync("/books/search")),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.list.actions.filter"), "funnel", () => this.showFilter()),
			this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.list.actions.sort"), "swap-vertical", () => this.showSorts())
		];

		const pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.booksSvc.name);
		if (pagination !== undefined && this.pageNumber < pagination.PageNumber) {
			this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.list.actions.show", { totalRecords: AppPagination.computeTotal(pagination.PageNumber, pagination) }), "eye", () => {
				this.pagination = AppPagination.get({ FilterBy: this.filterBy, SortBy: this.sortBy }, this.booksSvc.name);
				this.pageNumber = this.pagination.PageNumber;
				this.prepareResults(() => this.prepareActionsAsync());
			}));
		}

		if (this.authSvc.isServiceModerator()) {
			this.actions.push(this.appFormsSvc.getActionSheetButton(await this.configSvc.getResourceAsync("books.list.actions.crawl"), "build", () => this.showCrawl()));
		}
	}

	showActions() {
		this.appFormsSvc.showActionSheetAsync(this.actions);
	}

	showFilter() {
		this.objects = this.books.map(object => object);
		this.infiniteScrollCtrl.disabled = true;
		this.filtering = true;
		this.searchCtrl.value = undefined;
		PlatformUtility.focus(this.searchCtrl);
	}

	showSorts() {
		AppUtility.invoke(async () => this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("books.list.sort.header"),
			undefined,
			undefined,
			data => {
				if (this.sort !== data) {
					this.sort = data;
					this.prepareResults(async () => {
						await this.contentCtrl.scrollToTop(567);
						await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.list.sort.message"));
					});
				}
			},
			await this.configSvc.getResourceAsync("books.list.sort.button"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			this.sorts.map(sort => ({
				type: "radio",
				label: sort.label,
				value: sort.value,
				checked: this.sort === sort.value
			}))
		));
	}

	showCrawl() {
		AppUtility.invoke(async () => this.appFormsSvc.showAlertAsync(
			await this.configSvc.getResourceAsync("books.crawl.header"),
			undefined,
			await this.configSvc.getResourceAsync("books.crawl.label"),
			async data => {
				if (AppUtility.isNotEmpty(data.SourceUrl)) {
					await this.booksSvc.sendRequestToCrawlAsync(data.SourceUrl, async () => await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("books.crawl.message"), 2000));
				}
			},
			await this.configSvc.getResourceAsync("books.crawl.button"),
			await this.configSvc.getResourceAsync("common.buttons.cancel"),
			[{
				type: "text",
				name: "SourceUrl",
				placeholder: await this.configSvc.getResourceAsync("books.crawl.placeholder"),
				value: ""
			}]
		));
	}

	track(index: number, book: Book) {
		return `${book.ID}@${index}`;
	}

	private async trackAsync() {
		const title = this.searching ? await this.configSvc.getResourceAsync("books.list.title.search") : this.category || this.author;
		await TrackingUtility.trackAsync({ title: title, category: "Book", action: this.searching ? "Search" : "Browse" });
	}

}
