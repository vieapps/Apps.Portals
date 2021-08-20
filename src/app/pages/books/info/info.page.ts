import { Component, OnInit, OnDestroy } from "@angular/core";
import { registerLocaleData } from "@angular/common";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { BooksService } from "@app/services/books.service";
import { Book } from "@app/models/book";
import { CounterInfo } from "@app/models/counters";

@Component({
	selector: "page-books-info",
	templateUrl: "./info.page.html",
	styleUrls: ["./info.page.scss"]
})

export class BooksInfoPage implements OnInit, OnDestroy {
	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private booksSvc: BooksService
	) {
		this.configSvc.locales.forEach(locale => registerLocaleData(this.configSvc.getLocaleData(locale)));
	}

	title = "";
	qrcode = "";
	book = new Book();
	statistics = {
		views: undefined as CounterInfo,
		downloads: undefined as CounterInfo
	};
	labels = {
		category: "Category",
		original: "Original",
		author: "Author",
		translator: "Translator",
		publisher: "Publisher",
		producer: "Producer",
		source: "Source",
		chapters: "Number of chapters",
		download: "Download",
		qrcode: {
			header: "QR Code",
			description: "Scan this QR Code by your smartphone to quick access"
		},
		statistics: {
			views: "Views",
			downloads: "Downloads",
			total: "Total",
			month: "Total of this month",
			week: "Total of this week"
		},
		updated: "Updated at",
		link: "Permanent link"
	};

	get color() {
		return this.configSvc.color;
	}

	get locale() {
		return this.configSvc.locale;
	}

	get sourceUrl() {
		return this.book.SourceUrl !== ""
			? this.book.SourceUrl.replace("/mobile/", "/").replace("/mobil/", "/truyen/").replace("http://", "https://")
			: undefined;
	}

	get redirectUrl() {
		return this.configSvc.getAppURL(this.book !== undefined ? this.book.routerURI : undefined);
	}

	ngOnInit() {
		this.initialize();
		AppEvents.on("App", info => {
			if ("LanguageChanged" === info.args.Type) {
				this.prepareLabelsAsync();
			}
		}, "LanguageChangedEventHandlerOfViewBookInfoPage");
		AppEvents.on("Books", info => {
			if (this.book.ID === info.args.ID && "StatisticsUpdated" === info.args.Type) {
				this.getStatistics();
			}
		}, "EventHandlerOfViewBookInfoPage");
	}

	ngOnDestroy() {
		AppEvents.off("App", "LanguageChangedEventHandlerOfViewBookInfoPage");
		AppEvents.off("Books", "EventHandlerOfViewBookInfoPage");
	}

	getStatistics() {
		this.statistics = {
			views: this.book.Counters.get("View") || new CounterInfo(),
			downloads: this.book.Counters.get("Download") || new CounterInfo()
		};
	}

	initialize() {
		const id = this.configSvc.requestParams["ID"];
		this.booksSvc.getBookAsync(id, async () => {
			this.book = Book.get(id);
			if (this.book !== undefined) {
				this.prepareLabelsAsync().then(() => this.getStatistics());
				this.title = this.configSvc.appTitle = this.book.Title + " - " + this.book.Author;
				this.qrcode = this.configSvc.appConfig.isNativeApp
					? AppUtility.stringify({ Service: this.booksSvc.name, Object: "Book", ID: this.book.ID, Action: "Read" })
					: this.redirectUrl;
				if (AppUtility.isObject(this.book.Files, true) && (this.book.Files.Epub.Size === "generating..." || this.book.Files.Mobi.Size === "generating...")) {
					this.booksSvc.generateEBookFilesAsync(this.book.ID);
				}
				this.trackAsync(this.title);
			}
			else {
				this.configSvc.navigateBackAsync();
			}
		});
	}

	async prepareLabelsAsync() {
		this.labels = {
			category: await this.configSvc.getResourceAsync("books.info.controls.Category"),
			original: await this.configSvc.getResourceAsync("books.info.controls.Original"),
			author: await this.configSvc.getResourceAsync("books.info.controls.Author"),
			translator: await this.configSvc.getResourceAsync("books.info.controls.Translator"),
			publisher: await this.configSvc.getResourceAsync("books.info.controls.Publisher"),
			producer: await this.configSvc.getResourceAsync("books.info.controls.Producer"),
			source: await this.configSvc.getResourceAsync("books.info.controls.Source"),
			chapters: await this.configSvc.getResourceAsync("books.info.chapters"),
			download: await this.configSvc.getResourceAsync("books.info.download"),
			qrcode: {
				header: await this.configSvc.getResourceAsync("books.info.qrcode.header"),
				description: await this.configSvc.getResourceAsync("books.info.qrcode.description", { scanner: this.configSvc.appConfig.isNativeApp ? "app" : "smartphone" })
			},
			statistics: {
				views: await this.configSvc.getResourceAsync("books.info.statistics.views"),
				downloads: await this.configSvc.getResourceAsync("books.info.statistics.downloads"),
				total: await this.configSvc.getResourceAsync("books.info.statistics.total"),
				month: await this.configSvc.getResourceAsync("books.info.statistics.month"),
				week: await this.configSvc.getResourceAsync("books.info.statistics.week")
			},
			updated: await this.configSvc.getResourceAsync("books.info.updated"),
			link: await this.configSvc.getResourceAsync("books.info.link")
		};
	}

	download(type: string) {
		if (this.configSvc.isAuthenticated) {
			this.trackAsync(this.title, "Download", "/books/download/success").then(() => PlatformUtility.openURL(`${this.book.Files[type].Url}?${AppUtility.toQuery(this.configSvc.appConfig.getAuthenticatedInfo())}`));
		}
		else {
			this.trackAsync(this.title, "Download", "/books/download/failed").then(async () => await this.appFormsSvc.showAlertAsync(
				undefined,
				await this.configSvc.getResourceAsync("books.info.notAuthenticated"),
				undefined,
				() => AppEvents.broadcast("Navigate", { Type: "LogIn" }),
				await this.configSvc.getResourceAsync("common.buttons.login"),
				await this.configSvc.getResourceAsync("common.buttons.later")
			));
		}
	}

	copyLink() {
		PlatformUtility.copyToClipboardAsync(this.redirectUrl).then(() => this.appFormsSvc.showToastAsync("Copied..."));
	}

	openSource() {
		PlatformUtility.openURL(this.sourceUrl);
	}

	private trackAsync(title: string, action?: string, url?: string) {
		return TrackingUtility.trackAsync({ title: title, campaignUrl: url, category: "Book", action: action || "View" });
	}

}
