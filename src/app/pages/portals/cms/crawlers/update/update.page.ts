import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment, AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { PortalsCmsService } from "@app/services/portals.cms.service";
import { Organization, Module, ContentType } from "@app/models/portals.core.all";
import { Category, Crawler } from "@app/models/portals.cms.all";
import { DataItemModalPage } from "@app/controls/common/data.item.modal.page";
import { DataLookupModalPage } from "@app/controls/portals/data.lookup.modal.page";

@Component({
	selector: "page-portals-cms-crawlers-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class CmsCrawlersUpdatePage implements OnInit, OnDestroy {

	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService,
		private portalsCmsSvc: PortalsCmsService
	) {
	}

	private organization: Organization;
	private crawler: Crawler;
	private canModerate = false;
	private hash = {
		content: "",
		full: ""
	};

	title = {
		page: "Crawler",
		track: "Crawler"
	};
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic",
		current: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	buttons = {
		save: "Save",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

	private categories = new Array<{ ID: string; Title: string; URL: string; }>();

	private get selectedCategories() {
		const control = this.formControls.find(ctrl => ctrl.Name === "SelectedCategories");
		return control !== undefined ? control.controlRef.lookupValues : [];
	}

	private set selectedCategories(values: Array<string>)  {
		const control = this.formControls.find(ctrl => ctrl.Name === "SelectedCategories");
		if (control !== undefined) {
			control.controlRef.lookupValues = values;
		}
	}

	private get selectedMappings() {
		const control = this.formControls.find(ctrl => ctrl.Name === "CategoryMappings");
		return control !== undefined ? control.controlRef.lookupValues : [];
	}

	private set selectedMappings(values: Array<string>)  {
		const control = this.formControls.find(ctrl => ctrl.Name === "CategoryMappings");
		if (control !== undefined) {
			control.controlRef.lookupValues = values;
		}
	}

	ngOnInit() {
		this.initializeAsync();
	}

	ngOnDestroy() {
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		const crawlerID = this.configSvc.requestParams["ID"];
		if (AppUtility.isNotEmpty(crawlerID)) {
			this.crawler = Crawler.get(crawlerID);
			if (this.crawler === undefined) {
				await this.portalsCmsSvc.getCrawlerAsync(crawlerID, _ => this.crawler = Crawler.get(crawlerID), undefined, true);
			}
		}

		this.organization = this.crawler !== undefined
			? Organization.get(this.crawler.SystemID)
			: await this.portalsCoreSvc.getActiveOrganizationAsync();

		this.title.track = await this.configSvc.getResourceAsync(`portals.cms.crawlers.title.${(this.crawler !== undefined && AppUtility.isNotEmpty(this.crawler.ID) ? "update" : "create")}`);

		if (this.organization === undefined) {
			this.trackAsync(`${this.title.track} | Invalid Organization`, "Check");
			this.appFormsSvc.hideLoadingAsync(async () => this.cancel(await this.configSvc.getResourceAsync("portals.organizations.list.invalid"), "/portals/core/organizations/list/all"));
			return;
		}

		this.canModerate = this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerate) {
			this.trackAsync(`${this.title.track} | No Permission`, "Check").then(() => this.appFormsSvc.showToastAsync("Hmmmmmm...."));
			this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
			return;
		}

		this.crawler = this.crawler || new Crawler(this.organization.ID);
		if (AppUtility.isEmpty(this.crawler.ID)) {
			const module = this.organization.modules.first();
			const contentTypes = this.portalsCmsSvc.getContentTypesOfContent(module);
			this.crawler.RepositoryID = module !== undefined ? module.ID : undefined;
			this.crawler.RepositoryEntityID = contentTypes.length ? contentTypes.first().ID : undefined;
			this.crawler.URL = "https://blogchamsoc.com";
		}

		this.configSvc.appTitle = this.title.page = this.title.track + (AppUtility.isNotEmpty(this.crawler.ID) ? ` [${this.crawler.Title}]` : "");
		this.trackAsync(this.title.track);

		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.crawler.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: Array<AppFormsSegment>) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.cms.crawlers.update.segments.basic")),
			new AppFormsSegment("categories", await this.configSvc.getResourceAsync("portals.cms.crawlers.update.segments.categories")),
			new AppFormsSegment("options", await this.configSvc.getResourceAsync("portals.cms.crawlers.update.segments.options"))
		];
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: Array<AppFormsControlConfig>) => void) {
		const formConfig: Array<AppFormsControlConfig> = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "cms.crawler");

		let control = formConfig.find(ctrl => ctrl.Name === "Status");
		this.portalsCoreSvc.prepareApprovalStatusControl(control);

		control = formConfig.find(ctrl => ctrl.Name === "DefaultStatus");
		this.portalsCoreSvc.prepareApprovalStatusControl(control);

		if (AppUtility.isNotEmpty(this.crawler.ID)) {
			const module = Module.get(this.crawler.RepositoryID);
			control = formConfig.find(ctrl => ctrl.Name === "RepositoryID");
			control.Hidden = true;
			formConfig.insert({
				Name: "Repository",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: module.Title },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));

			const contentType = ContentType.get(this.crawler.RepositoryEntityID);
			control = formConfig.find(ctrl => ctrl.Name === "RepositoryEntityID");
			control.Hidden = true;
			formConfig.insert({
				Name: "RepositoryEntity",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: contentType.Title },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}
		else {
			control = formConfig.find(ctrl => ctrl.Name === "RepositoryID");
			control.Options.SelectOptions.Values = this.organization.modules.map(module => ({ Value: module.ID, Label: module.Title }));
			control.Options.OnChanged = (_, formControl) => {
				const module = Module.get(formControl.value);
				const contentTypeControl = this.formControls.find(ctrl => ctrl.Name === "RepositoryEntityID");
				contentTypeControl.Options.SelectOptions.Values = this.portalsCmsSvc.getContentTypesOfContent(module).map(contentType => ({ Value: contentType.ID, Label: contentType.Title }));
				contentTypeControl.controlRef.setValue(contentTypeControl.Options.SelectOptions.Values.length ? contentTypeControl.Options.SelectOptions.Values.first().Value : undefined);
				const categoryContentType = this.portalsCmsSvc.getDefaultContentTypeOfCategory(module);
				const categoryControl = this.formControls.find(ctrl => ctrl.Name === "DefaultCategoryID");
				const mappingsControl = this.formControls.find(c => c.Name === "CategoryMappings");
				categoryControl.Options.LookupOptions.ModalOptions.ComponentProps.moduleID = mappingsControl.Options.LookupOptions.ModalOptions.ComponentProps.moduleID = categoryContentType === undefined ? undefined : categoryContentType.RepositoryID;
				categoryControl.Options.LookupOptions.ModalOptions.ComponentProps.contentTypeID = mappingsControl.Options.LookupOptions.ModalOptions.ComponentProps.contentTypeID = categoryContentType === undefined ? undefined : categoryContentType.ID;
				categoryControl.controlRef.lookupDisplayValues = undefined;
				categoryControl.controlRef.setValue(undefined);
			};
			control = formConfig.find(ctrl => ctrl.Name === "RepositoryEntityID");
			control.Options.SelectOptions.Values = this.portalsCmsSvc.getContentTypesOfContent(Module.get(this.crawler.RepositoryID)).map(contentType => ({ Value: contentType.ID, Label: contentType.Title }));
		}

		control = formConfig.find(ctrl => ctrl.Name === "SelectedCategories");
		control.Options.LookupOptions = AppUtility.clone(formConfig.find(ctrl => ctrl.Name === "DefaultCategoryID").Options.LookupOptions);
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataItemModalPage, undefined, true, true, options => {
			options.AsModal = true;
			options.ModalOptions.ComponentProps.objectName = undefined;
			options.OnDelete = (data, formControl) => {
				if (data !== undefined && data.length) {
					this.selectedCategories = this.selectedCategories.filter(id => id !== data[0]);
					formControl.lookupDisplayValues = this.categories.filter(cat => this.selectedCategories.indexOf(cat.ID) > -1).map(cat => ({ Value: cat.ID, Label: cat.Title }));
					formControl.control.Options.LookupOptions.ModalOptions.ComponentProps.settings = { selected: this.selectedCategories };
				}
				const index = this.selectedMappings.findIndex(catIDs => catIDs.startsWith(data[0]));
				if (index > -1) {
					this.selectedMappings.removeAt(index);
					this.prepareCategoriesAsync();
				}
			};
			options.ModalOptions.OnDismiss = (data, formControl) => {
				if (data !== undefined) {
					const values = data as AppFormsLookupValue[];
					this.crawler.CategoryMappings = (this.crawler.CategoryMappings || []).merge(values.map(item => item.Value).except(this.crawler.SelectedCategories || []).map(id => `${id}:`));
					this.crawler.SelectedCategories = (this.crawler.SelectedCategories || []).merge(values.map(item => item.Value), true);
					formControl.lookupDisplayValues = this.categories.filter(cat => this.crawler.SelectedCategories.indexOf(cat.ID) > -1).map(cat => ({ Value: cat.ID, Label: cat.Title }));
					formControl.control.Options.LookupOptions.ModalOptions.ComponentProps.settings = { selected: this.crawler.SelectedCategories };
					this.prepareCategoriesAsync();
				}
			};
		});

		formConfig.insert(this.appFormsSvc.getButtonControls(
			"categories",
			{
				Name: "FetchCategories",
				Label: "{{portals.cms.crawlers.controls.SelectedCategories.fetch}}",
				OnClick: () => this.fetchCategoriesAsync(() => {
					const ctrl = this.formControls.find(c => c.Name === "SelectedCategories");
					ctrl.Options.LookupOptions.ModalOptions.ComponentProps.items = this.categories.map(cat => ({ Value: cat.ID, Label: cat.Title }));
					ctrl.controlRef.lookup();
				}),
				Options: {
					Fill: "clear",
					Color: "primary",
					Css: "ion-float-end",
					Icon: {
						Name: "reload",
						Slot: "end"
					}
				}
			}
		), formConfig.findIndex(ctrl => ctrl.Name === control.Name) + 1);

		control = formConfig.find(ctrl => ctrl.Name === "CategoryMappings");
		control.Type = "Custom";
		control.Options.Type = "data-items";
		control.Options.LookupOptions = AppUtility.clone(formConfig.find(ctrl => ctrl.Name === "DefaultCategoryID").Options.LookupOptions);
		control.Extras["LookupSettings"] = {
			allowSelect: false,
			allowClick: true,
			onClick: (event: Event, value: string) => {
				event.stopPropagation();
				const ctrl = this.formControls.find(c => c.Name === "CategoryMappings");
				ctrl.Extras["ItemID"] = value;
				ctrl.controlRef.lookup();
			}
		};
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.portalsCmsSvc.getDefaultContentTypeOfCategory(Module.get(this.crawler.RepositoryID)), false, true, options => {
			options.ModalOptions.ComponentProps.objectName = "cms.category";
			options.ModalOptions.OnDismiss = (data, formControl) => {
				const category: Category = AppUtility.isArray(data, true) ? data[0] : undefined;
				if (category !== undefined) {
					const id = (formControl.control.Extras["ItemID"] as string).split(":").first() + ":";
					console.log("Mappings", formControl.control.Extras["ItemID"], category);
					// formControl.lookupDisplayValues = [{ Value: category.ID, Label: category.FullTitle }];
				}
			};
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories, true);
		});

		const defaultCategory = Category.get(this.crawler.DefaultCategoryID);
		control = formConfig.find(ctrl => ctrl.Name === "DefaultCategoryID");
		control.Extras = { LookupDisplayValues: defaultCategory !== undefined ? [{ Value: defaultCategory.ID, Label: defaultCategory.FullTitle }] : undefined };
		this.portalsCmsSvc.setLookupOptions(control.Options.LookupOptions, DataLookupModalPage, this.portalsCmsSvc.getDefaultContentTypeOfCategory(Module.get(this.crawler.RepositoryID)), false, true, options => {
			options.ModalOptions.ComponentProps.objectName = "cms.category";
			options.OnDelete = (_, formControl) => {
				formControl.setValue(undefined);
				formControl.lookupDisplayValues = undefined;
			};
			options.ModalOptions.OnDismiss = async (data, formControl) => {
				if (AppUtility.isArray(data, true) && data[0].ID !== formControl.value) {
					const category = Category.get(data[0].ID);
					formControl.setValue(category.ID);
					formControl.lookupDisplayValues = [{ Value: category.ID, Label: category.FullTitle }];
				}
			};
			options.ModalOptions.ComponentProps.preProcess = (categories: Array<any>) => this.portalsCmsSvc.processCategories(categories, true);
		});

		control = formConfig.find(ctrl => ctrl.Name === "Title");
		if (!control.Hidden) {
			control.Options.AutoFocus = true;
		}

		if (AppUtility.isNotEmpty(this.crawler.ID)) {
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
			control.Segment = "basic";
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}
		else {
			formConfig.find(ctrl => ctrl.Name === "LastActivity").Hidden = true;
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}

		return formConfig;
	}

	private fetchCategoriesAsync(onCompleted?: () => void) {
		const crawler = this.form.value;
		crawler.ID = "categories";
		return this.portalsCmsSvc.createCrawlerAsync(crawler, data => {
			this.categories = data;
			if (onCompleted !== undefined) {
				onCompleted();
			}
		});
	}

	private async prepareCategoriesAsync(onCompleted?: () => void) {
		const categoryMappings = new Array<AppFormsLookupValue>();
		await Promise.all((this.crawler.CategoryMappings || []).map(async id => {
			const ids = id.split(":");
			const sCategory = this.categories.first(cat => cat.ID === ids.first());
			let dCategory = ids.length > 1 ? Category.get(ids.last()) : undefined;
			if (dCategory === undefined && ids.length > 1 && AppUtility.isNotEmpty(ids.last())) {
				await this.portalsCmsSvc.getCategoryAsync(ids.last(), () => dCategory = Category.get(ids.last()), undefined, true);
			}
			categoryMappings.push(sCategory !== undefined ? { Value: id, Label: `${sCategory.Title} => ${dCategory !== undefined ? dCategory.FullTitle : "..."}` } : undefined);
		}));
		this.formControls.find(ctrl => ctrl.Name === "CategoryMappings").controlRef.lookupDisplayValues = categoryMappings.filter(cat => cat !== undefined);
		if (onCompleted !== undefined) {
			onCompleted();
		}
	}

	onFormInitialized() {
		this.form.patchValue(AppUtility.clone(this.crawler, false));
		this.hash.content = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync(() => {
			if (AppUtility.isNotEmpty(this.crawler.URL)) {
				this.fetchCategoriesAsync(() => {
					const control = this.formControls.find(ctrl => ctrl.Name === "SelectedCategories");
					control.Options.LookupOptions.ModalOptions.ComponentProps.items = this.categories.map(cat => ({ Value: cat.ID, Label: cat.Title }));
					control.Options.LookupOptions.ModalOptions.ComponentProps.settings = { selected: this.crawler.SelectedCategories };
					control.controlRef.lookupDisplayValues = this.selectedCategories.map(id => {
						const category = this.categories.first(cat => cat.ID === id);
						return category !== undefined ? { Value: category.ID, Label: category.Title } : undefined;
					}).filter(cat => cat !== undefined);
					this.prepareCategoriesAsync();
				});
			}
		});
	}

	save() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash.full === AppCrypto.hash(this.form.value)) {
				this.configSvc.navigateBackAsync();
			}
			else {
				this.appFormsSvc.showLoadingAsync(this.title.track).then(() => {
					this.processing = true;
					const crawler = this.form.value;
					if (AppUtility.isNotEmpty(crawler.ID)) {
						if (this.hash.content === AppCrypto.hash(crawler)) {
							this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
						}
						else {
							this.portalsCmsSvc.updateCrawlerAsync(
								crawler,
								async _ => {
									await this.trackAsync(this.title.track, "Update");
									await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.crawlers.update.messages.success.update"));
									await this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
								},
								error => this.trackAsync(this.title.track, "Update").then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
							);
						}
					}
					else {
						this.portalsCmsSvc.createCrawlerAsync(
							crawler,
							async _ => {
								await this.trackAsync(this.title.track);
								await this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.cms.crawlers.update.messages.success.new"));
								await this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync());
							},
							error => this.trackAsync(this.title.track).then(() => this.appFormsSvc.showErrorAsync(error)).then(() => this.processing = false)
						);
					}
				});
			}
		}
	}

	delete() {
		AppUtility.invoke(async () => {
			const deleteButton = await this.configSvc.getResourceAsync("portals.cms.crawlers.update.buttons.delete");
			const removeButton = await this.configSvc.getResourceAsync("portals.cms.crawlers.update.buttons.remove");
			const confirmMessage = await this.configSvc.getResourceAsync("portals.cms.crawlers.update.messages.confirm.delete");
			const successMessage = await this.configSvc.getResourceAsync("portals.cms.crawlers.update.messages.success.delete");
			this.appFormsSvc.showConfirmAsync(
				confirmMessage,
				() => this.appFormsSvc.showLoadingAsync(deleteButton).then(() => this.portalsCmsSvc.deleteCrawlerAsync(
					this.crawler.ID,
					() => this.trackAsync(deleteButton, "Delete").then(() => this.appFormsSvc.showToastAsync(successMessage)).then(() => this.appFormsSvc.hideLoadingAsync(() => this.configSvc.navigateBackAsync())),
					error => this.trackAsync(this.title.track, "Delete").then(() => this.appFormsSvc.showErrorAsync(error))
				)),
				removeButton,
				"{{default}}"
			);
		});
	}

	cancel(message?: string, url?: string) {
		if (message === undefined && this.hash.full === AppCrypto.hash(this.form.value)) {
			this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url));
		}
		else {
			AppUtility.invoke(async () => this.appFormsSvc.showConfirmAsync(
				message || await this.configSvc.getResourceAsync(`portals.cms.crawlers.update.messages.confirm.${AppUtility.isNotEmpty(this.crawler.ID) ? "cancel" : "new"}`),
				() => this.trackAsync(this.title.track, "Cancel").then(() => this.configSvc.navigateBackAsync(url)),
				undefined,
				message === undefined ? "{{default}}" : undefined
			));
		}
	}

	private trackAsync(title: string, action?: string, category?: string) {
		return TrackingUtility.trackAsync({ title: title, category: category || "Crawler", action: action || (this.crawler !== undefined && AppUtility.isNotEmpty(this.crawler.ID) ? "Edit" : "Create") });
	}

}
