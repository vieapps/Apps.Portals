import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@app/components/app.crypto";
import { AppEvents } from "@app/components/app.events";
import { AppUtility } from "@app/components/app.utility";
import { TrackingUtility } from "@app/components/app.utility.trackings";
import { AppPagination } from "@app/components/app.pagination";
import { AppFormsControlConfig, AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { AuthenticationService } from "@app/services/authentication.service";
import { PortalsCoreService } from "@app/services/portals.core.service";
import { Organization, Module, ContentType, Expression } from "@app/models/portals.core.all";

@Component({
	selector: "page-portals-core-expressions-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsExpressionsUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private authSvc: AuthenticationService,
		private appFormsSvc: AppFormsService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private expression: Expression;
	private organization: Organization;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private hash = "";
	private unspecified = "unspecified";
	private isAdvancedMode = false;

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
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

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		this.expression = Expression.get(this.configSvc.requestParams["ID"]);
		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.expressions.title.${(this.expression !== undefined ? "update" : "create")}`);
		this.unspecified = await this.configSvc.getResourceAsync("portals.common.unspecified");
		await this.appFormsSvc.showLoadingAsync(this.title);

		this.organization = this.expression !== undefined
			? Organization.get(this.expression.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.expression.SystemID, _ => this.organization = Organization.get(this.expression.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await Promise.all([
				this.trackAsync(`${this.title} | No Permission`, "Check"),
				this.appFormsSvc.hideLoadingAsync(async () => await this.appFormsSvc.showToastAsync("Hmmmmmm....")),
				this.configSvc.navigateBackAsync()
			]);
			return;
		}

		if (this.organization.modules.length < 1) {
			const request = AppPagination.buildRequest(
				{ And: [{ SystemID: { Equals: this.organization.ID } }] },
				{ Title: "Ascending" },
				{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
			);
			await this.portalsCoreSvc.searchModulesAsync(request, undefined, undefined, true, true);
		}

		if (this.organization.modules.length < 1) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check"),
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.expressions.list.invalid")));
			return;
		}

		if (this.expression === undefined) {
			const moduleID = this.configSvc.requestParams["RepositoryID"];
			const module = AppUtility.isNotEmpty(moduleID)
				? Module.get(moduleID)
				: this.portalsCoreSvc.activeModule || this.organization.modules.first();
			const contentTypeID = this.configSvc.requestParams["RepositoryEntityID"] || (module.contentTypes.length > 0 ? module.contentTypes.first().ID : undefined);
			const contentType = AppUtility.isNotEmpty(contentTypeID)
				? ContentType.get(contentTypeID)
				: module.contentTypes.length > 0 ? module.contentTypes.first() : undefined;
			const contentTypeDefinitionID = contentType !== undefined
				? contentType.ContentTypeDefinitionID
				: this.configSvc.requestParams["ContentTypeDefinitionID"] || (module.contentTypeDefinitions.length > 0 ? module.contentTypeDefinitions.first().ID : undefined);
			this.expression = new Expression(this.organization.ID, module.ID, contentTypeDefinitionID, contentType !== undefined ? contentType.ID : undefined, this.configSvc.requestParams["Title"]);
			this.prepareFilterAndSorts();
		}
		else {
			this.isAdvancedMode = AppUtility.isTrue(this.configSvc.requestParams["Advanced"]);
		}

		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.expression.SystemID) {
			this.trackAsync(`${this.title} | Invalid Organization`, "Check"),
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.buttons = {
			save: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.expression.ID) ? "save" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
		await this.trackAsync(this.title);
	}

	private async getFormSegmentsAsync(onCompleted?: (formSegments: AppFormsSegment[]) => void) {
		const formSegments = [
			new AppFormsSegment("basic", await this.configSvc.getResourceAsync("portals.expressions.update.segments.basic"))
		];
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			formSegments.push(
				new AppFormsSegment("filter", await this.configSvc.getResourceAsync("portals.expressions.update.segments.filter")),
				new AppFormsSegment("sorts", await this.configSvc.getResourceAsync("portals.expressions.update.segments.sorts"))
			);
		}
		if (this.isAdvancedMode) {
			formSegments.push(
				new AppFormsSegment("integrations", "Integrations")
			);
		}
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "expression");
		this.portalsCoreSvc.addOrganizationControl(formConfig, "{{portals.expressions.controls.Organization}}", this.organization);

		let control = formConfig.find(ctrl => ctrl.Name === "Title");
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => ctrl.Name === "Description");
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => ctrl.Name === "RepositoryID");
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			formConfig.insert({
				Name: "Repository",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: Module.get(this.expression.RepositoryID).Title },
				Options: {
					Label: control.Options.Label,
					ReadOnly: true
				}
			}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
		}
		else {
			control.Options.SelectOptions.Values = this.organization.modules.map(module => ({ Value: module.ID, Label: module.Title }));
			control.Options.OnChanged = async (_, formControl) => {
				const module = Module.get(formControl.value);
				const definitions = module.contentTypeDefinitions;
				const definitionID = definitions.first().ID;
				const definitionsControl = this.formControls.find(ctrl => ctrl.Name === "ContentTypeDefinitionID");
				definitionsControl.Options.SelectOptions.Values = definitions.map(definition => ({ Value: definition.ID, Label: definition.Title }));
				definitionsControl.controlRef.setValue(definitionID, { onlySelf: true });
				const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === definitionID);
				const contentTypeControl = this.formControls.find(ctrl => ctrl.Name === "RepositoryEntityID");
				contentTypeControl.Options.SelectOptions.Values = contentTypes.map(contentType => ({ Value: contentType.ID, Label: contentType.Title }));
				contentTypeControl.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);
				contentTypeControl.controlRef.setValue(contentTypes.length > 0 ? contentTypes.first().ID : "-", { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => ctrl.Name === "ContentTypeDefinitionID");
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			if (AppUtility.isNotEmpty(this.expression.ContentTypeDefinitionID)) {
				formConfig.insert({
					Name: "ContentTypeDefinition",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: Module.get(this.expression.RepositoryID).contentTypeDefinitions.find(definition => definition.ID  === this.expression.ContentTypeDefinitionID).Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
			}
		}
		else {
			control.Options.SelectOptions.Values = this.organization.modules.first().contentTypeDefinitions.map(definition => ({ Value: definition.ID, Label: definition.Title }));
			control.Options.OnChanged = (_, formControl) => {
				const module = Module.get(this.formControls.find(ctrl => ctrl.Name === "RepositoryID").value);
				const contentTypeDefinitionID = formControl.value;
				const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === contentTypeDefinitionID);
				const contentTypeControl = this.formControls.find(ctrl => ctrl.Name === "RepositoryEntityID");
				contentTypeControl.Options.SelectOptions.Values = contentTypes.map(contentType => ({ Value: contentType.ID, Label: contentType.Title }));
				contentTypeControl.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);
				contentTypeControl.controlRef.setValue(contentTypes.length > 0 ? contentTypes.first().ID : "-", { onlySelf: true });
				this.prepareFilterAndSorts();
			};
		}

		control = formConfig.find(ctrl => ctrl.Name === "RepositoryEntityID");
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			if (AppUtility.isNotEmpty(this.expression.RepositoryEntityID)) {
				formConfig.insert({
					Name: "RepositoryEntity",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: ContentType.get(this.expression.RepositoryEntityID).Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				}, formConfig.findIndex(ctrl => ctrl.Name === control.Name));
			}
		}
		else {
			const module = AppUtility.isNotEmpty(this.expression.RepositoryID)
				? this.organization.modules.find(m => m.ID === this.expression.RepositoryID)
				: this.organization.modules.first();
			const contentTypeDefinitionID = AppUtility.isNotEmpty(this.expression.ContentTypeDefinitionID)
				? this.expression.ContentTypeDefinitionID
				: module.contentTypeDefinitions.first().ID;
			const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === contentTypeDefinitionID);
			control.Options.SelectOptions.Values = contentTypes.map(contentType => ({ Value: contentType.ID, Label: contentType.Title }));
			control.Options.SelectOptions.Values.insert({ Value: "-", Label: this.unspecified }, 0);
			control.Options.OnChanged = (_, __) => this.prepareFilterAndSorts();
		}

		formConfig.push(
			{
				Name: "Filter",
				Type: "TextArea",
				Segment: "filter",
				Hidden: AppUtility.isEmpty(this.expression.ID),
				Options: {
					Label: control.Options.Label.replace("RepositoryEntityID", "Filter"),
					Rows: 25
				}
			},
			{
				Name: "Sorts",
				Type: "TextArea",
				Segment: "sorts",
				Hidden: AppUtility.isEmpty(this.expression.ID),
				Options: {
					Label: control.Options.Label.replace("RepositoryEntityID", "Sorts"),
					Rows: 25
				}
			}
		);
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			formConfig.push(
				this.portalsCoreSvc.getAuditFormControl(this.expression, "basic"),
				this.appFormsSvc.getButtonControls(
					"basic",
					{
						Name: "Delete",
						Label: "{{portals.expressions.update.buttons.delete}}",
						OnClick: async () => await this.deleteAsync(),
						Options: {
							Fill: "clear",
							Color: "danger",
							Css: "ion-float-end",
							Icon: {
								Name: "trash",
								Slot: "start"
							}
						}
					}
				)
			);
		}

		if (this.isAdvancedMode) {
			formConfig.push(
				{
					Name: "JSONXRequest",
					Type: "TextArea",
					Segment: "integrations",
					Options: {
						Label: "JSON of x-request (FilterBy, SortBy, Pagination)",
						Rows: 12
					}
				},
				{
					Name: "EncodedXRequest",
					Type: "TextArea",
					Segment: "integrations",
					Options: {
						Label: "Url-Encoded of x-request",
						Rows: 4
					}
				},
				this.appFormsSvc.getButtonControls(
					"integrations",
					{
						Name: "EncodeJson",
						Label: "JSON > Base64Url",
						OnClick: async () => {
							try {
								this.form.controls.EncodedXRequest.setValue(AppCrypto.jsonEncode(AppUtility.parse(this.form.controls.JSONXRequest.value)));
							}
							catch (error) {
								await this.appFormsSvc.showErrorAsync(error);
							}
						},
						Options: {
							Fill: "clear",
							Css: "ion-float-end"
						}
					}
				),
				{
					Name: "PlainText",
					Type: "TextArea",
					Segment: "integrations",
					Options: {
						Label: "Plain text",
						Rows: 2
					}
				},
				{
					Name: "Base64Encoded",
					Type: "TextArea",
					Segment: "integrations",
					Options: {
						Label: "Base64-Encoded",
						Rows: 2
					}
				},
				this.appFormsSvc.getButtonControls(
					"integrations",
					{
						Name: "EncodeBase64",
						Label: "Text > Base64",
						OnClick: async () => {
							try {
								this.form.controls.Base64Encoded.setValue(AppCrypto.base64Encode(this.form.controls.PlainText.value));
							}
							catch (error) {
								await this.appFormsSvc.showErrorAsync(error);
							}
						},
						Options: {
							Fill: "clear",
							Css: "ion-float-end"
						}
					}
				),
				{
					Name: "Base64UrlEncoded",
					Type: "TextArea",
					Segment: "integrations",
					Options: {
						Label: "Base64Url-Encoded",
						Rows: 2
					}
				},
				this.appFormsSvc.getButtonControls(
					"integrations",
					{
						Name: "EncodeBase64Url",
						Label: "Text > Base64Url",
						OnClick: async () => {
							try {
								this.form.controls.Base64UrlEncoded.setValue(AppCrypto.base64urlEncode(this.form.controls.PlainText.value));
							}
							catch (error) {
								await this.appFormsSvc.showErrorAsync(error);
							}
						},
						Options: {
							Fill: "clear",
							Css: "ion-float-end"
						}
					}
				)
			);
		}

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control = formConfig.find(ctrl => ctrl.Name === "ID");
			control.Order = formConfig.find(ctrl => ctrl.Name === "Audits").Order + 1;
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	private prepareFilterAndSorts() {
		const module = this.formControls.find(ctrl => ctrl.Name === "RepositoryID") !== undefined
			? Module.get(this.formControls.find(ctrl => ctrl.Name === "RepositoryID").value || this.configSvc.requestParams["RepositoryID"])
			: Module.get(this.configSvc.requestParams["RepositoryID"]);
		const contentType = this.formControls.find(ctrl => ctrl.Name === "RepositoryEntityID") !== undefined
			? ContentType.get(this.formControls.find(ctrl => ctrl.Name === "RepositoryEntityID").value || this.configSvc.requestParams["RepositoryEntityID"])
			: ContentType.get(this.configSvc.requestParams["RepositoryEntityID"]);
		const objectName = contentType !== undefined ? contentType.getObjectName(true) : undefined;
		const filterBy: Array<{ Attribute?: string; Operator: string; Value?: string; Children?: Array<{ Attribute: string; Operator: string; Value?: string }> }> = contentType !== undefined
			? [
				{
					Attribute: "SystemID",
					Operator: "Equals",
					Value: contentType.SystemID
				},
				{
					Attribute: "RepositoryID",
					Operator: "Equals",
					Value: contentType.RepositoryID
				},
				{
					Attribute: "RepositoryEntityID",
					Operator: "Equals",
					Value: contentType.ID
				}
			]
			: module !== undefined
				? [
					{
						Attribute: "SystemID",
						Operator: "Equals",
						Value: module.SystemID
					},
					{
						Attribute: "RepositoryID",
						Operator: "Equals",
						Value: module.ID
					}
				]
				: [
					{
						Attribute: "SystemID",
						Operator: "Equals",
						Value: this.organization.ID
					}
				];
		if (this.configSvc.requestParams["ParentID"] !== undefined && ("CMS.Content" === objectName || "CMS.Link" === objectName)) {
			filterBy.push({
				Attribute: "CMS.Content" === objectName ? "CategoryID" : "ParentID",
				Operator: "Equals",
				Value: this.configSvc.requestParams["ParentID"]
			});
		}
		filterBy.push({
			Attribute: "Status",
			Operator: "Equals",
			Value: "Published"
		});
		if ("CMS.Content" === objectName) {
			filterBy.push(
				{
					Attribute: "StartDate",
					Operator: "LessThanOrEquals",
					Value: "@today"
				},
				{
					Operator: "Or",
					Children: [
						{
							Attribute: "EndDate",
							Operator: "GreaterOrEquals",
							Value: "@today"
						},
						{
							Attribute: "EndDate",
							Operator: "IsNull"
						}
					]
				}
			);
		}
		this.expression.Filter = {
			Operator: "And",
			Children: filterBy
		};
		this.expression.Sorts = ["CMS.Content" === objectName
			? { Attribute: "StartDate", Mode: "Descending", ThenBy: { Attribute: "PublishedTime", Mode: "Descending" } }
			: "CMS.Link" === objectName
				? { Attribute: "OrderIndex", Mode: "Ascending" }
				: { Attribute: "Created", Mode: "Descending" }
		];
	}

	onFormInitialized() {
		this.form.patchValue(this.expression);
		this.form.controls.Filter.setValue(JSON.stringify(this.expression.Filter), { onlySelf: true });
		this.form.controls.Sorts.setValue(JSON.stringify(this.expression.Sorts), { onlySelf: true });
		this.appFormsSvc.hideLoadingAsync(() => {
			this.hash = AppCrypto.hash(this.form.value);
			if (AppUtility.isEmpty(this.expression.ID)) {
				this.form.controls.Description.setValue("", { onlySelf: true });
				this.form.controls.ContentTypeDefinitionID.setValue(this.expression.ContentTypeDefinitionID || Module.get(this.expression.RepositoryID).contentTypeDefinitions.first().ID, { onlySelf: true });
			}
			else if (this.isAdvancedMode) {
				this.form.controls.JSONXRequest.setValue(JSON.stringify({
					FilterBy: {
						And: [{
							SystemID: {
								Equals: this.organization.ID
							}
						}]
					},
					SortBy: { Created: "Descending" },
					Pagination: {
						TotalRecords: -1,
						TotalPages: 0,
						PageSize: 20,
						PageNumber: 0
					}
				}));
			}
		});
	}

	async saveAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const expression = this.form.value;
				expression.RepositoryEntityID = AppUtility.isNotEmpty(expression.RepositoryEntityID) && expression.RepositoryEntityID !== "-" ? expression.RepositoryEntityID : undefined;

				if (this.isAdvancedMode) {
					delete expression["JSONXRequest"];
					delete expression["EncodedXRequest"];
					delete expression["Encode"];
				}

				try {
					expression.Filter = AppUtility.isNotEmpty(expression.Filter)
						? AppUtility.parse(expression.Filter)
						: undefined;
					expression.Sorts = AppUtility.isNotEmpty(expression.Sorts)
						? AppUtility.parse(expression.Sorts)
						: undefined;
				}
				catch (error) {
					this.processing = false;
					console.error("Error occurred while parsing JSON of expressions", error);
					await this.appFormsSvc.showErrorAsync({ Message: await this.configSvc.getResourceAsync("portals.expressions.update.messages.json")});
					return;
				}

				if (AppUtility.isNotEmpty(expression.ID)) {
					await this.portalsCoreSvc.updateExpressionAsync(
						expression,
						async data => {
							data = AppUtility.isArray(data.Objects) ? data.Objects.first() : data;
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Updated", ID: data.ID });
							await Promise.all([
								this.trackAsync(this.title, "Update"),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync()
							]);
							await this.configSvc.navigateBackAsync();
						},
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title, "Update"),
								this.appFormsSvc.showErrorAsync(error)
							]);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createExpressionAsync(
						expression,
						async data => {
							data = AppUtility.isArray(data.Objects) ? data.Objects.first() : data;
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Created", ID: data.ID });
							await Promise.all([
								this.trackAsync(this.title),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await Promise.all([
								this.trackAsync(this.title),
								this.appFormsSvc.showErrorAsync(error)
							]);
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		const button = await this.configSvc.getResourceAsync("portals.expressions.update.buttons.delete");
		await this.trackAsync(button, "Delete");
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.expressions.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(button);
				await this.portalsCoreSvc.deleteExpressionAsync(
					this.expression.ID,
					async _ => await Promise.all([
						this.trackAsync(button, "Delete"),
						this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.delete")),
						this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
					]),
					async error => await Promise.all([
						this.appFormsSvc.showErrorAsync(error),
						this.trackAsync(button, "Delete")
					])
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
		if (message === undefined && this.hash === AppCrypto.hash(this.form.value)) {
			await this.configSvc.navigateBackAsync();
		}
		else {
			await this.appFormsSvc.showAlertAsync(
				undefined,
				message || await this.configSvc.getResourceAsync(`portals.expressions.update.messages.confirm.${AppUtility.isNotEmpty(this.expression.ID) ? "cancel" : "new"}`),
				undefined,
				async () => await this.configSvc.navigateBackAsync(),
				await this.configSvc.getResourceAsync("common.buttons.ok"),
				message ? undefined : await this.configSvc.getResourceAsync("common.buttons.cancel")
			);
		}
	}

	private async trackAsync(title: string, action?: string, category?: string) {
		await TrackingUtility.trackAsync({ title: title, category: category || "Expression", action: action || (this.expression !== undefined && AppUtility.isNotEmpty(this.expression.ID) ? "Edit" : "Create") });
	}

}
