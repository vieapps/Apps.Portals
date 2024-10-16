import { Subscription } from "rxjs";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControl } from "@app/components/forms.objects";
import { ConfigurationService } from "@app/services/configuration.service";
import { BooksService } from "@app/services/books.service";

@Component({
	selector: "page-books-options",
	templateUrl: "./options.page.html",
	styleUrls: ["./options.page.scss"]
})

export class BooksOptionsPage implements OnInit, OnDestroy {
	constructor(
		private configSvc: ConfigurationService,
		private booksSvc: BooksService
	) {
	}

	title = "";
	options: { [key: string]: string };
	form = new FormGroup({});
	controls = new Array<AppFormsControl>();
	config: Array<any>;
	sample = "";
	hash = "";
	subscription: Subscription;

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.options = {};
		this.subscription = this.form.valueChanges.subscribe(value => this.options = value);
		this.initializeAsync();
	}

	ngOnDestroy() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
		}
	}

	async initializeAsync() {
		this.title = await this.configSvc.getResourceAsync("books.options.title");
		this.sample = await this.configSvc.getResourceAsync("books.options.labels.sample");
		const config = new Array<any>();
		await Promise.all(["color", "font", "size", "paragraph", "align"].map(async name => {
			const resources = await this.configSvc.getResourcesAsync(`books.options.${name}`);
			config.push({
				Name: name,
				Type: "Select",
				Options: {
					Label: await this.configSvc.getResourceAsync(`books.options.labels.${name}`),
					SelectOptions: {
						Values: Object.keys(resources).map(value => ({
							Value: value,
							Label: resources[value]
						}))
					}
				}
			});
		}));
		this.config = config;
		await TrackingUtility.trackAsync({ title: this.title, campaignUrl: "/books/options", category: "Book", action: "Options" });
	}

	onFormInitialized() {
		this.form.patchValue(this.booksSvc.readingOptions);
		this.hash = AppCrypto.hash(this.form.value);
	}

	async onCloseAsync() {
		if (this.hash !== AppCrypto.hash(this.form.value)) {
			Object.keys(this.options).forEach(key => this.booksSvc.readingOptions[key] = this.options[key]);
			await this.configSvc.storeOptionsAsync();
		}
	}

}
