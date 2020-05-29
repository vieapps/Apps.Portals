import { Component, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppCrypto } from "@components/app.crypto";
import { AppEvents } from "@components/app.events";
import { AppUtility } from "@components/app.utility";
import { TrackingUtility } from "@components/app.utility.trackings";
import { AppPagination } from "@components/app.pagination";
import { AppFormsControl, AppFormsControlConfig, AppFormsSegment, AppFormsService } from "@components/forms.service";
import { ConfigurationService } from "@services/configuration.service";
import { AuthenticationService } from "@services/authentication.service";
import { PortalsCoreService } from "@services/portals.core.service";
import { Organization } from "@models/portals.core.organization";
import { Module } from "@models/portals.core.module";
import { ContentType } from "@models/portals.core.content.type";
import { Expression } from "@models/portals.core.expression";

@Component({
	selector: "page-portals-core-expressions-update",
	templateUrl: "./update.page.html",
	styleUrls: ["./update.page.scss"]
})

export class PortalsExpressionsUpdatePage implements OnInit {
	constructor(
		private configSvc: ConfigurationService,
		private appFormsSvc: AppFormsService,
		private authSvc: AuthenticationService,
		private portalsCoreSvc: PortalsCoreService
	) {
	}

	private expression: Expression;
	private organization: Organization;
	private isSystemModerator = false;
	private canModerateOrganization = false;
	private hash = "";
	private unspecified = "unspecified";

	title = "";
	form = new FormGroup({});
	formConfig: Array<AppFormsControlConfig>;
	formSegments = {
		items: undefined as Array<AppFormsSegment>,
		default: "basic"
	};
	formControls = new Array<AppFormsControl>();
	processing = false;
	button = {
		update: "Update",
		cancel: "Cancel"
	};

	get color() {
		return this.configSvc.color;
	}

	ngOnInit() {
		this.initializeAsync();
	}

	private async initializeAsync() {
		await this.appFormsSvc.showLoadingAsync();
		this.expression = Expression.get(this.configSvc.requestParams["ID"]);

		this.organization = this.expression !== undefined
			? Organization.get(this.expression.SystemID)
			: this.portalsCoreSvc.activeOrganization || new Organization();

		if (this.organization === undefined) {
			await this.portalsCoreSvc.getOrganizationAsync(this.expression.SystemID, _ => this.organization = Organization.get(this.expression.SystemID), undefined, true);
		}

		this.isSystemModerator = this.authSvc.isSystemAdministrator() || this.authSvc.isModerator(this.portalsCoreSvc.name, "Organization", undefined);
		this.canModerateOrganization = this.isSystemModerator || this.portalsCoreSvc.canModerateOrganization(this.organization);
		if (!this.canModerateOrganization) {
			await this.appFormsSvc.hideLoadingAsync(async () => await Promise.all([
				this.appFormsSvc.showToastAsync("Hmmmmmm...."),
				this.configSvc.navigateBackAsync()
			]));
			return;
		}

		if (this.organization.modules.length < 1) {
			const request = AppPagination.buildRequest(
				{ And: [{ SystemID: { Equals: this.organization.ID } }] },
				{ Title: "Ascending" },
				{ TotalRecords: -1, TotalPages: 0, PageSize: 0, PageNumber: 1 }
			);
			await this.portalsCoreSvc.searchModuleAsync(request, undefined, undefined, true, true);
		}

		if (this.organization.modules.length < 1) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.expressions.list.invalid")));
			return;
		}

		this.expression = this.expression || new Expression(this.organization.ID, this.configSvc.requestParams["RepositoryID"] || this.organization.modules[0].ID, this.configSvc.requestParams["RepositoryEntityID"]);
		if (!AppUtility.isNotEmpty(this.organization.ID) || this.organization.ID !== this.expression.SystemID) {
			await this.appFormsSvc.hideLoadingAsync(async () => await this.cancelAsync(await this.configSvc.getResourceAsync("portals.organizations.list.invalid")));
			return;
		}

		this.configSvc.appTitle = this.title = await this.configSvc.getResourceAsync(`portals.expressions.title.${(AppUtility.isNotEmpty(this.expression.ID) ? "update" : "create")}`);
		this.unspecified = await this.configSvc.getResourceAsync("portals.common.unspecified");

		this.button = {
			update: await this.configSvc.getResourceAsync(`common.buttons.${(AppUtility.isNotEmpty(this.expression.ID) ? "update" : "create")}`),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};

		this.formSegments.items = await this.getFormSegmentsAsync();
		this.formConfig = await this.getFormControlsAsync();
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
		if (onCompleted !== undefined) {
			onCompleted(formSegments);
		}
		return formSegments;
	}

	private async getFormControlsAsync(onCompleted?: (formConfig: AppFormsControlConfig[]) => void) {
		const formConfig: AppFormsControlConfig[] = await this.configSvc.getDefinitionAsync(this.portalsCoreSvc.name, "expression");

		AppUtility.insertAt(
			formConfig,
			{
				Name: "Organization",
				Type: "Text",
				Segment: "basic",
				Extras: { Text: this.organization.Title },
				Options: {
					Label: "{{portals.expressions.controls.Organization}}",
					ReadOnly: true
				}
			},
			0
		);

		let control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Title"));
		control.Options.AutoFocus = true;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Description"));
		control.Options.Rows = 2;

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryID"));
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			AppUtility.insertAt(
				formConfig,
				{
					Name: "Repository",
					Type: "Text",
					Segment: "basic",
					Extras: { Text: Module.get(this.expression.RepositoryID).Title },
					Options: {
						Label: control.Options.Label,
						ReadOnly: true
					}
				},
				formConfig.findIndex(ctrl => ctrl.Name === control.Name)
			);
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.organization.modules.map(module => {
				return { Value: module.ID, Label: module.Title };
			});
			control.Options.OnChanged = async (_, formControl) => {
				const definitions = this.getContentTypeDefinitions(formControl.value);
				const definitionsControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
				definitionsControl.Options.SelectOptions.Values = definitions.map(definition => {
					return { Value: definition.ID, Label: definition.Title };
				});
				definitionsControl.controlRef.setValue(definitions[0].ID, { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ContentTypeDefinitionID"));
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			if (AppUtility.isNotEmpty(this.expression.ContentTypeDefinitionID)) {
				AppUtility.insertAt(
					formConfig,
					{
						Name: "ContentTypeDefinition",
						Type: "Text",
						Segment: "basic",
						Extras: { Text: this.getContentTypeDefinitions(this.expression.RepositoryID).find(definition => definition.ID  === this.expression.ContentTypeDefinitionID).Title },
						Options: {
							Label: control.Options.Label,
							ReadOnly: true
						}
					},
					formConfig.findIndex(ctrl => ctrl.Name === control.Name)
				);
			}
		}
		else {
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = this.getContentTypeDefinitions(this.organization.modules[0].ID).map(definition => {
				return { Value: definition.ID, Label: definition.Title };
			});
			control.Options.OnChanged = (_, formControl) => {
				const module = Module.get(this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryID")).value);
				const contentTypes = module.contentTypes.filter(contType => contType.ContentTypeDefinitionID === formControl.value);
				const contentType = contentTypes.length > 0 ? contentTypes[0] : undefined;
				const contentTypeControl = this.formControls.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
				contentTypeControl.Options.SelectOptions.Values = contentTypes.map(contType => {
					return { Value: contType.ID, Label: contType.Title };
				});
				AppUtility.insertAt(contentTypeControl.Options.SelectOptions.Values, { Value: "-", Label: this.unspecified }, 0);
				contentTypeControl.controlRef.setValue(contentType !== undefined ? contentType.ID : "-", { onlySelf: true });
			};
		}

		control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "RepositoryEntityID"));
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control.Hidden = true;
			if (AppUtility.isNotEmpty(this.expression.RepositoryEntityID)) {
				AppUtility.insertAt(
					formConfig,
					{
						Name: "RepositoryEntity",
						Type: "Text",
						Segment: "basic",
						Extras: { Text: ContentType.get(this.expression.RepositoryEntityID).Title },
						Options: {
							Label: control.Options.Label,
							ReadOnly: true
						}
					},
					formConfig.findIndex(ctrl => ctrl.Name === control.Name)
				);
			}
		}
		else {
			const module = this.organization.modules[0];
			const contentTypeDefinitionID = this.getContentTypeDefinitions(module.ID)[0].ID;
			const contentTypes = module.contentTypes.filter(contentType => contentType.ContentTypeDefinitionID === contentTypeDefinitionID);
			control.Options.Type = "dropdown";
			control.Options.SelectOptions.Values = contentTypes.map(contType => {
				return { Value: contType.ID, Label: contType.Title };
			});
			AppUtility.insertAt(control.Options.SelectOptions.Values, { Value: "-", Label: this.unspecified }, 0);
		}

		if (AppUtility.isNotEmpty(this.expression.ID)) {
			formConfig.push(
				{
					Name: "Filter",
					Type: "TextArea",
					Segment: "filter",
					Options: {
						Label: control.Options.Label.replace("RepositoryEntityID", "Filter"),
						Rows: 25
					}
				},
				{
					Name: "Sorts",
					Type: "TextArea",
					Segment: "sorts",
					Options: {
						Label: control.Options.Label.replace("RepositoryEntityID", "Sorts"),
						Rows: 25
					}
				},
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

		formConfig.forEach((ctrl, index) => ctrl.Order = index);
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			control = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "ID"));
			control.Order = formConfig.find(ctrl => AppUtility.isEquals(ctrl.Name, "Audits")).Order + 1;
			control.Hidden = false;
			control.Options.Label = "{{common.audits.identity}}";
			control.Options.ReadOnly = true;
		}

		if (onCompleted !== undefined) {
			onCompleted(formConfig);
		}
		return formConfig;
	}

	private getContentTypeDefinitions(moduleID: string) {
		const moduleDefinitionID = Module.get(moduleID).ModuleDefinitionID;
		return Module.moduleDefinitions.find(definition => definition.ID === moduleDefinitionID).ContentTypeDefinitions.filter(definition => definition.Portlets);
	}

	onFormInitialized() {
		this.form.patchValue(this.expression);
		if (AppUtility.isNotEmpty(this.expression.ID)) {
			this.form.controls.Filter.setValue(JSON.stringify(this.expression.Filter));
			this.form.controls.Sorts.setValue(JSON.stringify(this.expression.Sorts));
		}
		else {
			this.form.controls.ContentTypeDefinitionID.setValue(this.getContentTypeDefinitions(this.expression.RepositoryID)[0].ID);
			this.form.controls.Filter.setValue(undefined);
			this.form.controls.Sorts.setValue(undefined);
		}
		this.hash = AppCrypto.hash(this.form.value);
		this.appFormsSvc.hideLoadingAsync();
	}

	async updateAsync() {
		if (this.appFormsSvc.validate(this.form)) {
			if (this.hash === AppCrypto.hash(this.form.value)) {
				await this.configSvc.navigateBackAsync();
			}
			else {
				this.processing = true;
				await this.appFormsSvc.showLoadingAsync(this.title);

				const expression = this.form.value;
				expression.RepositoryEntityID = AppUtility.isNotEmpty(expression.RepositoryEntityID) && expression.RepositoryEntityID !== "-" ? expression.RepositoryEntityID : undefined;
				try {
					expression.Filter = AppUtility.isNotEmpty(expression.Filter)
						? JSON.parse(expression.Filter)
						:
						{
							Operator: "And",
							Children: [{
								Attribute: "SystemID",
								Operator: "Equals",
								Value: this.organization.ID
							}]
						};
					expression.Sorts = AppUtility.isNotEmpty(expression.Sorts)
						? JSON.parse(expression.Sorts)
						:
						[{
							Attribute: "Created",
							Mode: "Descending",
							ThenBy: undefined
						}];
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
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Updated", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.update")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.showErrorAsync(error);
						}
					);
				}
				else {
					await this.portalsCoreSvc.createExpressionAsync(
						expression,
						async data => {
							AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Created", ID: data.ID });
							await Promise.all([
								TrackingUtility.trackAsync(this.title, this.configSvc.currentUrl),
								this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.new")),
								this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
							]);
						},
						async error => {
							this.processing = false;
							await this.appFormsSvc.showErrorAsync(error);
						}
					);
				}
			}
		}
	}

	async deleteAsync() {
		await this.appFormsSvc.showAlertAsync(
			undefined,
			await this.configSvc.getResourceAsync("portals.expressions.update.messages.confirm.delete"),
			undefined,
			async () => {
				await this.appFormsSvc.showLoadingAsync(await this.configSvc.getResourceAsync("portals.expressions.update.buttons.delete"));
				await this.portalsCoreSvc.deleteExpressionAsync(
					this.expression.ID,
					async data => {
						AppEvents.broadcast(this.portalsCoreSvc.name, { Object: "Expression", Type: "Deleted", ID: data.ID });
						await Promise.all([
							TrackingUtility.trackAsync(await this.configSvc.getResourceAsync("portals.expressions.update.buttons.delete"), this.configSvc.currentUrl),
							this.appFormsSvc.showToastAsync(await this.configSvc.getResourceAsync("portals.expressions.update.messages.success.delete")),
							this.appFormsSvc.hideLoadingAsync(async () => await this.configSvc.navigateBackAsync())
						]);
					},
					async error => await this.appFormsSvc.showErrorAsync(error)
				);
			},
			await this.configSvc.getResourceAsync("common.buttons.delete"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	async cancelAsync(message?: string) {
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