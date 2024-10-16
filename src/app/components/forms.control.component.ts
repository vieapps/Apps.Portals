import { Component, OnInit, OnDestroy, AfterViewInit, Input, Output, EventEmitter, ViewChild, ChangeDetectorRef } from "@angular/core";
import { FormGroup, FormArray } from "@angular/forms";
import { CompleterService } from "ng2-completer";
import * as CKEditor from "@app/components/ckeditor";
import "@app/components/ckeditor.vi";
import { AppUtility } from "@app/components/app.utility";
import { AppFormsControl, AppFormsLookupValue } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { ConfigurationService } from "@app/services/configuration.service";
import { FilesService } from "@app/services/files.service";

@Component({
	selector: "app-form-control",
	templateUrl: "./forms.control.component.html"
})

export class AppFormsControlComponent implements OnInit, OnDestroy, AfterViewInit {

	constructor(
		private configSvc: ConfigurationService,
		private filesSvc: FilesService,
		private appFormsSvc: AppFormsService,
		private changeDetector: ChangeDetectorRef,
		private completerSvc: CompleterService
	) {
	}

	private _style: string;
	private _completerInitialValue: any;
	private _selectOptions: Array<string>;
	private _ckEditorConfig: { [key: string]: any };

	showPassword = false;

	@Input() control: AppFormsControl;

	@Input() formGroup: FormGroup;

	@Input() formArrayIndex: number;

	@Input() theme: string;

	@Output() refreshCaptcha = new EventEmitter<AppFormsControlComponent>();

	@Output() lastFocus = new EventEmitter<AppFormsControlComponent>();

	@ViewChild("elementRef", { static: false }) private elementRef: any;

	ngOnInit() {
		this.control.controlRef = this;
		this.control.formControlRef = this.formControl;
		if (this.isLookupControl && this.isCompleter) {
			this.completerInit();
			this.completerGetInitialValue();
		}
	}

	ngAfterViewInit() {
		this.control.elementRef = this.elementRef;
		if (this.control.Options.OnAfterViewInit !== undefined) {
			this.control.Options.OnAfterViewInit(this);
		}
		if (this.control.Options.OnAfterViewInit !== undefined || this.isYesNoControl || (this.isCompleter && this.completerInitialValue !== undefined)) {
			this.changeDetector.detectChanges();
		}
	}

	ngOnDestroy() {
		this.refreshCaptcha.unsubscribe();
		this.lastFocus.unsubscribe();
		if (this.control.Options.LookupOptions.CompleterOptions.DataSource !== undefined) {
			this.control.Options.LookupOptions.CompleterOptions.DataSource.cancel();
		}
	}

	get isFormControl() {
		return this.control.SubControls === undefined;
	}

	get isFormGroup() {
		return !this.isFormControl && !this.control.SubControls.AsArray;
	}

	get isFormArray() {
		return !this.isFormControl && this.control.SubControls.AsArray;
	}

	get isSimpleFormArray() {
		return this.isFormArray && this.control.SubControls.Controls.find(subcontrol => subcontrol.SubControls !== undefined) === undefined;
	}

	get isComplexFormArray() {
		return this.isFormArray && this.control.SubControls.Controls.find(subcontrol => subcontrol.SubControls !== undefined) !== undefined;
	}

	get isFormButtons() {
		return !this.isFormControl && this.isControl("Buttons");
	}

	isControl(type: string) {
		return AppUtility.isEquals(this.control.Type, type);
	}

	isCustomControl(type?: string) {
		return this.isFormControl && this.isControl("Custom") && (type === undefined || AppUtility.isEquals(this.control.Options.Type, type));
	}

	get isTextBoxControl() {
		return this.isFormControl && this.isControl("TextBox");
	}

	get isTextAreaControl() {
		return this.isFormControl && this.isControl("TextArea");
	}

	get isTextEditorControl() {
		return this.isFormControl && this.isControl("TextEditor");
	}

	get isTextDisplayControl() {
		return this.isFormControl && this.isControl("Text");
	}

	get isTextDatePickerControl() {
		return this.isTextBoxControl && (AppUtility.isEquals(this.control.Options.Type, "date") || AppUtility.isEquals(this.control.Options.Type, "datetime-local"));
	}

	get isSelectControl() {
		return this.isFormControl && this.isControl("Select");
	}

	get isRangeControl() {
		return this.isFormControl && this.isControl("Range");
	}

	get isLookupControl() {
		return this.isFormControl && this.isControl("Lookup");
	}

	get isPasswordControl() {
		return this.isTextBoxControl && AppUtility.isEquals(this.control.Options.Type, "password");
	}

	get isCaptchaControl() {
		return this.isFormControl && this.isControl("Captcha");
	}

	get isYesNoControl() {
		return this.isFormControl && this.isControl("YesNo");
	}

	get isToggleControl() {
		return this.isYesNoControl && AppUtility.isEquals(this.control.Options.Type, "toggle");
	}

	get isCheckboxControl() {
		return this.isYesNoControl && !AppUtility.isEquals(this.control.Options.Type, "toggle");
	}

	get isDatePickerControl() {
		return this.isFormControl && this.isControl("DatePicker");
	}

	get isFilePickerControl() {
		return this.isFormControl && this.isControl("FilePicker");
	}

	private get isImagePickerControl() {
		return this.isFilePickerControl && !this.control.Options.FilePickerOptions.Multiple && AppUtility.indexOf(this.control.Options.FilePickerOptions.Accept, "image/") > -1;
	}

	get isAllowImagePreview() {
		return this.isImagePickerControl && this.control.Options.FilePickerOptions.AllowPreview && this.value !== undefined;
	}

	private get isAllowDelete() {
		return this.isLookupControl
			? (this.isCompleter || this.isModal) && this.lookupDisplayValues.length > 0
			: this.isFilePickerControl
				? this.isImagePickerControl
					? this.control.Options.FilePickerOptions.AllowDelete && AppUtility.isObject(this.value, true) && this.value.new !== undefined
					: this.control.Options.FilePickerOptions.AllowDelete
				: this.isDatePickerControl
					? this.control.Options.DatePickerOptions.AllowDelete
					: this.isTextDatePickerControl
						? true
						: false;
	}

	get parentControl() {
		return this.control.parent;
	}

	get formControl() {
		return this.formGroup.controls[this.control.Name];
	}

	get formControlAsFormGroup() {
		return this.formControl as FormGroup;
	}

	get formControlAsFormArray() {
		return this.formControl as FormArray;
	}

	get formControlName() {
		return this.formArrayIndex !== undefined
			? this.formArrayIndex
			: this.control.Name;
	}

	get visible() {
		return !this.control.Hidden;
	}

	get invalid() {
		return this.formControl !== undefined && this.formControl.invalid && this.formControl.dirty;
	}

	get label() {
		return this.control.Options.Label;
	}

	get color() {
		return {
			label: AppUtility.isNotEmpty(this.control.Options.LabelOptions.Color) ? this.control.Options.LabelOptions.Color : undefined,
			control: AppUtility.isNotEmpty(this.control.Options.Color) ? this.control.Options.Color : undefined
		};
	}

	get position() {
		return this.isYesNoControl
			? ""
			: this.control.Options.LabelOptions.Position;
	}

	get description() {
		return this.control.Options.Description;
	}

	get css() {
		return {
			label: this.control.Options.LabelOptions.Css,
			control: this.control.Options.Css,
			description: this.control.Options.DescriptionOptions.Css
		};
	}

	get type() {
		return (this.isPasswordControl && this.showPassword ? "text" : this.control.Options.Type).trim().toLowerCase();
	}

	get required() {
		return this.control.Required
			? true
			: undefined;
	}

	get disabled() {
		return this.control.Options.Disabled
			? true
			: undefined;
	}

	get readonly() {
		return this.control.Options.ReadOnly
			? true
			: undefined;
	}

	get placeholder() {
		return this.control.Options.PlaceHolder;
	}

	get minValue() {
		return this.control.Options.MinValue;
	}

	get maxValue() {
		return this.control.Options.MaxValue;
	}

	get minLength() {
		return this.control.Options.MinLength;
	}

	get maxLength() {
		return this.control.Options.MaxLength;
	}

	get clearOnEdit() {
		return this.isPasswordControl
			? false
			: undefined;
	}

	get width() {
		return this.control.Options.Width !== undefined
			? this.control.Options.Width
			: "";
	}

	get height() {
		return this.control.Options.Height !== undefined
			? this.control.Options.Height
			: "";
	}

	get style() {
		if (this._style === undefined) {
			this._style = "";
			if (this.control.Options.Width) {
				this._style += `width:${this.control.Options.Width.trim()};`;
			}
			if (this.control.Options.Height) {
				this._style += `height:${this.control.Options.Height.trim()};`;
			}
			if (this.isCaptchaControl) {
				this._style += "text-transform:uppercase";
			}
		}
		return {
			control: this._style,
			description: this.control.Options.DescriptionOptions.Style || ""
		};
	}

	get name() {
		return this.control.Options.Name;
	}

	get value() {
		return this.isDatePickerControl || this.isTextDatePickerControl
			? this.datetimeValue
			: this.formControl.value;
	}

	get rows() {
		return this.selectAsDropdown
			? undefined
			: this.control.Options.Rows !== undefined && this.control.Options.Rows > 0 ? this.control.Options.Rows : 4;
	}

	get yesnoChecked() {
		return this.formControl.value !== undefined
			? this.minValue === undefined || this.maxValue === undefined ? AppUtility.isTrue(this.formControl.value) : +this.formControl.value !== 0
			: false;
	}

	get datetimeValue() {
		return this.formControl.value !== undefined
			? this.control.Options.DatePickerOptions.AllowTimes
				? AppUtility.toIsoDateTime(new Date(this.formControl.value), true)
				: AppUtility.toIsoDate(new Date(this.formControl.value))
			: undefined;
	}

	get datetimeDisplayFormat() {
		return this.control.Options.DatePickerOptions.DisplayFormat !== undefined
			? this.control.Options.DatePickerOptions.DisplayFormat
			: this.control.Options.DatePickerOptions.AllowTimes ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY";
	}

	get datetimePickerFormat() {
		return this.control.Options.DatePickerOptions.PickerFormat;
	}

	get datetimeDayNames() {
		return this.control.Options.DatePickerOptions.DayNames;
	}

	get datetimeDayShortNames() {
		return this.control.Options.DatePickerOptions.DayShortNames;
	}

	get datetimeMonthNames() {
		return this.control.Options.DatePickerOptions.MonthNames;
	}

	get datetimeMonthShortNames() {
		return this.control.Options.DatePickerOptions.MonthShortNames;
	}

	get datetimeCancelText() {
		return this.control.Options.DatePickerOptions.CancelText;
	}

	get datetimeDoneText() {
		return this.control.Options.DatePickerOptions.DoneText;
	}

	get selectMultiple() {
		return this.control.Options.SelectOptions.Multiple;
	}

	private get selectAsBoxes() {
		return this.isSelectControl && this.control.Options.SelectOptions.AsBoxes;
	}

	get selectAsRadioBoxes() {
		return this.selectAsBoxes && !this.selectMultiple;
	}

	get selectAsCheckBoxes() {
		return this.selectAsBoxes && this.selectMultiple;
	}

	private get selectAsList() {
		return this.isSelectControl && !this.control.Options.SelectOptions.AsBoxes && AppUtility.isEquals(this.control.Options.Type, "dropdown");
	}

	get selectAsDropdown() {
		return this.selectAsList && !this.control.Options.SelectOptions.Multiple;
	}

	get selectAsMultiple() {
		return this.selectAsList && this.control.Options.SelectOptions.Multiple;
	}

	get selectInterface() {
		return "alert";
		// return this.control.Options.SelectOptions.Interface;
	}

	get selectInterfaceOptions() {
		return this.control.Options.SelectOptions.InterfaceOptions;
	}

	get selectCancelText() {
		return this.control.Options.SelectOptions.CancelText;
	}

	get selectOkText() {
		return this.control.Options.SelectOptions.OkText;
	}

	get selectOptions() {
		return this.control.Options.SelectOptions.Values || new Array<AppFormsLookupValue>();
	}

	selectOptionIsChecked(selectOption: string) {
		if (this._selectOptions === undefined) {
			const values = this.formControl.value;
			if (AppUtility.isNotEmpty(values)) {
				this._selectOptions = AppUtility.toArray(values) as Array<string>;
			}
			else if (AppUtility.isArray(values, true)) {
				this._selectOptions = (values as Array<any>).map(value => value.toString());
			}
			else if (AppUtility.isObject(values, true)) {
				this._selectOptions = (AppUtility.toArray(values) as Array<any>).map(value => value.toString());
			}
			else {
				this._selectOptions = AppUtility.isNotNull(values) ? [values.toString()] : [];
			}
			this._selectOptions = this._selectOptions.filter(value => value !== "");
		}
		return this._selectOptions.indexOf(selectOption) > -1;
	}

	trackOption(index: number, option: { Value: string, Label: string }) {
		return `${option.Value}@${index}`;
	}

	get rangeOptions() {
		return this.control.Options.RangeOptions;
	}

	get isModal() {
		return this.isLookupControl && this.control.Options.LookupOptions.AsModal;
	}

	get isCompleter() {
		return this.isLookupControl && this.control.Options.LookupOptions.AsCompleter;
	}

	get isSelector() {
		return this.isLookupControl && this.control.Options.LookupOptions.AsSelector;
	}

	private get isCompleterAllowLookupByModal() {
		return this.isCompleter && this.control.Options.LookupOptions.CompleterOptions.AllowLookupByModal && this.control.Options.LookupOptions.ModalOptions.Component !== undefined;
	}

	private get isCompleterOfAddress() {
		return AppUtility.isEquals(this.control.Options.Type, "Address");
	}

	completerInit() {
		if (this.isCompleterOfAddress) {
			this.control.Options.LookupOptions.CompleterOptions.DataSource = this.completerSvc.local(this.appFormsSvc.getMetaCounties(), "Title,TitleANSI", "Title");
		}
		else if (this.control.Options.LookupOptions.CompleterOptions.OnInitialized !== undefined) {
			this.control.Options.LookupOptions.CompleterOptions.OnInitialized(this);
		}
	}

	get completerPlaceHolder() {
		return this.placeholder || "";
	}

	get completerMinLength() {
		return this.minLength || 3;
	}

	get completerMaxLength() {
		return this.maxLength || 150;
	}

	get completerSearchingText() {
		return this.control.Options.LookupOptions.CompleterOptions.SearchingText;
	}

	get completerNoResultsText() {
		return this.control.Options.LookupOptions.CompleterOptions.NoResultsText;
	}

	get completerPauseMiliseconds() {
		return this.control.Options.LookupOptions.CompleterOptions.PauseMiliseconds || 123;
	}

	get completerClearSelected() {
		return this.control.Options.LookupOptions.Multiple
			? true
			: this.control.Options.LookupOptions.CompleterOptions.ClearSelected;
	}

	get completerDataSource() {
		return this.control.Options.LookupOptions.CompleterOptions.DataSource;
	}

	private completerGetInitialValue() {
		if (this.isCompleterOfAddress) {
			const value = {
				County: "",
				Province: "",
				Country: ""
			};
			["County", "Province", "Country"].forEach(name => {
				const formControl = this.formGroup.controls[name];
				value[name] = formControl !== undefined ? formControl.value : "";
			});
			this._completerInitialValue = this.appFormsSvc.getMetaCounties().find(address => AppUtility.isEquals(address.County, value.County) && AppUtility.isEquals(address.Province, value.Province) && AppUtility.isEquals(address.Country, value.Country));
		}
		else {
			this._completerInitialValue = this.control.Options.LookupOptions.CompleterOptions.InitialValue !== undefined
				? this.control.Options.LookupOptions.CompleterOptions.InitialValue
				: this.control.Options.LookupOptions.CompleterOptions.GetInitialValue !== undefined
					? this.control.Options.LookupOptions.CompleterOptions.GetInitialValue(this)
					: undefined;
		}
		return this._completerInitialValue;
	}

	get completerInitialValue() {
		return this._completerInitialValue || this.completerGetInitialValue();
	}

	set completerInitialValue(value: any) {
		this._completerInitialValue = value;
		this.changeDetector.detectChanges();
	}

	lookup() {
		if (this.control.Options.LookupOptions.ModalOptions.Component === undefined) {
			this.appFormsSvc.showAlertAsync(undefined, "Lookup component is invalid");
		}
		else {
			this.appFormsSvc.showModalAsync(
				this.control.Options.LookupOptions.ModalOptions.Component,
				this.control.Options.LookupOptions.ModalOptions.ComponentProps,
				data => {
					if (this.control.Options.LookupOptions.ModalOptions.OnDismiss !== undefined) {
						this.control.Options.LookupOptions.ModalOptions.OnDismiss(data, this);
					}
				},
				this.control.Options.LookupOptions.ModalOptions.BackdropDismiss,
				this.control.Options.LookupOptions.ModalOptions.SwipeToClose
			);
		}
	}

	get lookupMultiple() {
		return this.isLookupControl && this.control.Options.LookupOptions.Multiple;
	}

	get lookupValues() {
		const value = this.formControl.value;
		return (this.lookupMultiple ? value as Array<string> : value !== undefined ? [value.toString()] : []) || [];
	}

	set lookupValues(values: Array<string>) {
		this.formControl.setValue(values);
	}

	get lookupDisplayValues() {
		return this.control.Extras["LookupDisplayValues"] || [];
	}

	set lookupDisplayValues(values: Array<AppFormsLookupValue>) {
		this.control.Extras["LookupDisplayValues"] = AppUtility.isArray(values, true)
			? values.map(value => ({
					Value: value["Value"],
					Label: value["Label"],
					Description: value["Description"] || value["Summary"],
					Image: value["Image"],
					Extras: value["Extras"],
					Children: value["Children"]
				}))
			: AppUtility.isObject(values, true)
				? [{
						Value: values["Value"],
						Label: values["Label"],
						Description: values["Description"] || values["Summary"],
						Image: values["Image"],
						Extras: values["Extras"],
						Children: values["Children"]
					}]
				: new Array<AppFormsLookupValue>();
	}

	get lookupDisplayValue() {
		return this.lookupDisplayValues.length > 0 ? this.lookupDisplayValues[0].Label : undefined;
	}

	get lookupSettings() {
		const settings: { [key: string]: any } = this.control.Extras["LookupSettings"] || {};
		settings["handlers"] = {
			onAdd: this.isSelector && this.control.Options.LookupOptions.SelectorOptions.OnAdd !== undefined ? () => this.control.Options.LookupOptions.SelectorOptions.OnAdd(this) : () => {},
			onDelete: (values: Array<string>) => this.deleteValue(values)
		};
		settings["resources"] = {
			header: this.control.Options.LookupOptions.SelectorOptions.HeaderText,
			confirm: this.control.Options.LookupOptions.WarningOnDelete,
			ok: this.control.Options.LookupOptions.SelectorOptions.OkText,
			cancel: this.control.Options.LookupOptions.SelectorOptions.CancelText
		};
		return settings;
	}

	set lookupSettings(settings: { [key: string]: any }) {
		this.control.Extras["LookupSettings"] = settings;
	}

	get isTextDisplayAsBoxControl() {
		const type = this.type;
		return this.isTextDisplayControl && type !== "textarea" && type !== "label" && type !== "paragraph";
	}

	get isTextDisplayAsTexAreaControl() {
		return this.isTextDisplayControl && this.type === "textarea";
	}

	get isTextDisplayAsLabelControl() {
		return this.isTextDisplayControl && this.type === "label";
	}

	get isTextDisplayAsParagraphControl() {
		return this.isTextDisplayControl && this.type === "paragraph";
	}

	set text(value: string) {
		this.control.Extras["Text"] = value;
	}

	get text() {
		return this.control.Extras["Text"];
	}

	get captchaURI() {
		return this.control.captchaURI;
	}

	set captchaURI(uri: string) {
		this.control.captchaURI = uri;
	}

	focus() {
		this.control.focus();
	}

	focusNext() {
		this.appFormsSvc.focusNext(this.control, () => this.lastFocus.emit(this));
	}

	trackControl(index: number, control: AppFormsControl) {
		return `${control.Name}@${index}`;
	}

	refreshCaptchaImage() {
		this.deleteValue();
		this.refreshCaptcha.emit(this);
	}

	setValue(value: any, options?: Object, updateValueAndValidity: boolean = false) {
		this.formControl.setValue(value, options);
		if (updateValueAndValidity) {
			this.formControl.updateValueAndValidity(options !== undefined ? { onlySelf: AppUtility.isTrue(options["onlySelf"]), emitEvent: AppUtility.isTrue(options["emitEvent"]) } : undefined);
		}
	}

	patchValue(value: any, options?: Object, updateValueAndValidity: boolean = false) {
		this.formControl.patchValue(value, options);
		if (updateValueAndValidity) {
			this.formControl.updateValueAndValidity(options !== undefined ? { onlySelf: AppUtility.isTrue(options["onlySelf"]), emitEvent: AppUtility.isTrue(options["emitEvent"]) } : undefined);
		}
	}

	resetValue(value?: any, options?: Object, updateValueAndValidity: boolean = false) {
		this.formControl.reset(value, options);
		if (updateValueAndValidity) {
			this.formControl.updateValueAndValidity(options !== undefined ? { onlySelf: AppUtility.isTrue(options["onlySelf"]), emitEvent: AppUtility.isTrue(options["emitEvent"]) } : undefined);
		}
	}

	deleteValue(value?: any, options?: Object, updateValueAndValidity: boolean = false) {
		if (this.isLookupControl) {
			if (this.control.Options.LookupOptions.OnDelete !== undefined) {
				if (this.isSelector) {
					this.control.Options.LookupOptions.OnDelete(AppUtility.isArray(value) ? value : [value], this);
				}
				else {
					if (AppUtility.isNotEmpty(this.control.Options.LookupOptions.WarningOnDelete)) {
						this.appFormsSvc.showAlertAsync(undefined, undefined, this.control.Options.LookupOptions.WarningOnDelete, () => {
							this.control.Options.LookupOptions.OnDelete(AppUtility.isArray(value) ? value : [value], this);
							if (this.isCompleter && this.lookupMultiple) {
								this.focus();
							}
						});
					}
					else {
						this.control.Options.LookupOptions.OnDelete(AppUtility.isArray(value) ? value : [value], this);
						if (this.isCompleter && this.lookupMultiple) {
							this.focus();
						}
					}
				}
			}
		}
		else if (this.isFilePickerControl) {
			if (this.control.Options.FilePickerOptions.OnDelete !== undefined) {
				if (AppUtility.isNotEmpty(this.control.Options.FilePickerOptions.WarningOnDelete)) {
					this.appFormsSvc.showAlertAsync(undefined, undefined, this.control.Options.FilePickerOptions.WarningOnDelete, () => this.control.Options.FilePickerOptions.OnDelete(value as string, this));
				}
				else {
					this.control.Options.FilePickerOptions.OnDelete(value as string, this);
				}
			}
		}
		else if (this.isCustomControl()) {
			if (this.control.Options.LookupOptions.OnDelete !== undefined) {
				this.control.Options.LookupOptions.OnDelete(value, this);
			}
		}
		else if (this.formControl !== undefined) {
			this.setValue(undefined, options, updateValueAndValidity);
			this.focus();
		}
	}

	addControlOfFormArray() {
		const control = this.appFormsSvc.copyControl(this.control.SubControls.Controls[0], ctrl => {
			ctrl.Name = `${this.control.Name}_${this.control.SubControls.Controls.length}`;
			ctrl.Order = this.control.SubControls.Controls.length;
			ctrl.Options.Label = `#${this.control.SubControls.Controls.length + 1}`;
		});
		this.control.SubControls.Controls.push(control);
		this.formControlAsFormArray.push(
			control.SubControls === undefined || control.SubControls.Controls === undefined || control.SubControls.Controls.length < 1
				? this.appFormsSvc.getFormControl(control)
				: control.SubControls.AsArray
					? this.appFormsSvc.getFormArray(control)
					: this.appFormsSvc.getFormGroup(control.SubControls.Controls)
		);
		if (this.control.Extras !== undefined && typeof this.control.Extras.onControlOfFormArrayAdded === "function") {
			this.control.Extras.onControlOfFormArrayAdded(this.control);
		}
	}

	get icon() {
		return (this.isImagePickerControl || this.isDatePickerControl || this.isTextDatePickerControl) && this.isAllowDelete
			? "trash"
			: this.isCompleterAllowLookupByModal || this.isModal
				? (this.control.Options.Icon.Name || "add").trim().toLowerCase()
				: AppUtility.isNotEmpty(this.control.Options.Icon.Name)
					? this.control.Options.Icon.Name.trim().toLowerCase()
					: undefined;
	}

	get iconSlot() {
		return (this.control.Options.Icon.Slot || "end").trim().toLowerCase();
	}

	get iconFill() {
		return (this.control.Options.Icon.Fill || "clear").trim().toLowerCase();
	}

	get iconColor() {
		return (this.control.Options.Icon.Color || "medium").trim().toLowerCase();
	}

	clickOnIcon(event: Event) {
		if (this.isPasswordControl) {
			this.showPassword = !this.showPassword;
			if (this.showPassword) {
				this.focus();
			}
		}
		else if ((this.isImagePickerControl || this.isDatePickerControl || this.isTextDatePickerControl) && this.isAllowDelete) {
			this.deleteValue();
		}
		else if (this.isCompleterAllowLookupByModal || this.isModal) {
			this.lookup();
		}
		else if (this.control.Options.Icon.OnClick !== undefined) {
			this.control.Options.Icon.OnClick(event, this);
		}
	}

	clickOnButton(event: Event, control: AppFormsControl) {
		if (control !== undefined && control.Options.ButtonOptions.OnClick !== undefined) {
			control.Options.ButtonOptions.OnClick(event, control);
		}
	}

	onFocus(event: Event) {
		if (this.control.Options.OnFocus !== undefined) {
			this.control.Options.OnFocus(event, this);
		}
	}

	onKeyUp(event: KeyboardEvent, focusNextOnEnter: boolean = true) {
		if (this.control.Options.OnKeyUp !== undefined) {
			this.control.Options.OnKeyUp(event, this);
		}
		else if (focusNextOnEnter && event.code === "Enter") {
			this.focusNext();
		}
	}

	onBlur(event: Event) {
		if (this.control.Options.OnBlur !== undefined) {
			this.control.Options.OnBlur(event, this);
		}
	}

	onChanged(event: any) {
		// special control: date-picker
		if (this.isDatePickerControl) {
			try {
				const time = {
					year: event.detail.value.year,
					month: event.detail.value.month,
					day: event.detail.value.day,
					hour: event.detail.value.hour,
					minute: event.detail.value.minute,
					second: event.detail.value.second
				};
				let value = time.year !== undefined && time.month !== undefined && time.day !== undefined
					? `${time.year.text}-${time.month.text}-${time.day.text}`
					: event.detail.value;
				if (this.control.Options.DatePickerOptions.AllowTimes && time.hour !== undefined && time.minute !== undefined) {
					value += `T${time.hour.text}:${time.minute.text}` + (time.second !== undefined ? `:${time.second.text}` : "") + "Z";
				}
				this.setValue(new Date(value));
			}
			catch (error) {
				console.error("[Forms]: Error occurred while preparing date-time value", error, event);
			}
			this.focusNext();
		}

		// special control: yes/no (toggle)
		else if (this.isYesNoControl) {
			this.setValue(this.minValue === undefined || this.maxValue === undefined ? AppUtility.isTrue(event.detail.checked) : AppUtility.isTrue(event.detail.checked) ? 1 : 0);
			this.focusNext();
		}

		// special control: completer
		else if (this.isCompleter) {
			if (this.isCompleterOfAddress) {
				const address = (AppUtility.isObject(event, true) ? event.originalObject : undefined) || this.completerInitialValue;
				["County", "Province", "Country"].forEach(name => {
					const formControl = this.formGroup.controls[name];
					if (formControl !== undefined) {
						formControl.setValue(address !== undefined ? address[name] || "" : "");
					}
				});
			}
			else if (this.control.Options.LookupOptions.CompleterOptions.OnSelected !== undefined) {
				this.control.Options.LookupOptions.CompleterOptions.OnSelected(event, this);
				if (this.control.Options.LookupOptions.Multiple) {
					this.focus();
				}
			}
		}

		// special control: select-box
		else if (this.selectAsDropdown) {
			this._selectOptions = AppUtility.isArray(event) ? (event as Array<any>).map(value => value.toString()) : [event.toString()];
			this.setValue(this._selectOptions.length > 0 ? this._selectOptions[0] : undefined);
			this.focusNext();
		}

		// special control: multiple (check-boxes or select-box with multiple)
		else if (this.selectAsCheckBoxes || this.selectAsMultiple) {
			if (AppUtility.isArray(event)) {
				this._selectOptions = (event as Array<any>).map(value => value.toString());
			}
			else {
				this._selectOptions = this._selectOptions || [];
				if (!event.detail.checked) {
					this._selectOptions.remove(event.detail.value);
				}
				else if (this._selectOptions.indexOf(event.detail.value) < 0) {
					this._selectOptions.push(event.detail.value);
				}
				this._selectOptions = this._selectOptions.filter(value => value !== "");
			}
			this.setValue(this._selectOptions);
		}

		// special control: text editor
		else if (this.isTextEditorControl) {
			const data = AppUtility.isObject(event.editor, true) ? event.editor.getData() : undefined;
			if (data !== undefined) {
				this.setValue(data);
			}
		}

		// other
		else if (!this.isFilePickerControl) {
			// set value
			this.setValue(event !== undefined && event.detail !== undefined ? event.detail.value : event);

			// focus to next control
			if (!this.isRangeControl) {
				this.focusNext();
			}
		}

		// call on-changed event handler
		if (this.control.Options.OnChanged !== undefined) {
			this.control.Options.OnChanged(event, this);
		}
	}

	get ckEditor() {
		return CKEditor;
	}

	get ckEditorConfig() {
		if (this._ckEditorConfig === undefined) {
			this._ckEditorConfig = {
				language: this.configSvc.appConfig.language.substring(0, 2),
				fontSize: this.control.Extras["ckEditorFontSize"] || {
					options: [10, 11, 12, "default", 14, 16, 18, 20, 24, 28, 34, 38, 40, 46, 50],
					supportAllValues: true
				},
				fontFamily: this.control.Extras["ckEditorFontFamily"] || { options: [
					"default",
					"Arial, Helvetica, sans-serif",
					"Courier New, Courier, monospace",
					"Georgia, serif",
					"Lucida Sans Unicode, Lucida Grande, sans-serif",
					"Roboto, sans-serif",
					"Tahoma, Geneva, sans-serif",
					"Times New Roman, Times, serif",
					"Trebuchet MS, Helvetica, sans-serif",
					"Verdana, Geneva, sans-serif"
				]},
				mediaEmbed: {
					extraProviders: [{
						name: this.configSvc.appConfig.app.name,
						url: AppUtility.toRegExp(`/^${AppUtility.parseURI(this.configSvc.appConfig.URIs.files).Host}/`)
					}]
				}
			};
			const hosts = this.control.Extras["ckEditorTrustedHosts"];
			if (AppUtility.isArray(hosts, true)) {
				(hosts as Array<string>).filter(host => AppUtility.isNotEmpty(host)).forEach(host => this._ckEditorConfig.mediaEmbed.extraProviders.push({
					name: host,
					url: AppUtility.toRegExp(`/^${host}/`)
				}));
			}
			const linkSelector = this.control.Extras["ckEditorLinkSelector"];
			if (AppUtility.isObject(linkSelector, true) && (AppUtility.isObject(linkSelector.content, true) || AppUtility.isObject(linkSelector.file, true))) {
				this._ckEditorConfig.link = this._ckEditorConfig.link || {};
				this._ckEditorConfig.link.selector = linkSelector;
			}
			const mediaSelector = this.control.Extras["ckEditorMediaSelector"];
			if (AppUtility.isObject(mediaSelector, true) && typeof mediaSelector.selectMedia === "function") {
				this._ckEditorConfig.media = this._ckEditorConfig.media || {};
				this._ckEditorConfig.media.selector = mediaSelector;
			}
			const removePlugins: Array<string> = this.control.Extras["ckEditorRemovePlugins"] || [];
			const simpleUploadOptions = this.control.Extras["ckEditorSimpleUpload"];
			if (AppUtility.isObject(simpleUploadOptions, true)) {
				this._ckEditorConfig.simpleUpload = {
					uploadUrl: this.configSvc.appConfig.URIs.files + "one.image",
					headers: this.filesSvc.getUploadHeaders(simpleUploadOptions)
				};
			}
			else {
				removePlugins.push("ImageInsert", "MediaSelector");
			}
			if (this.control.Extras["ckEditorPageBreakIsAvailable"] === undefined) {
				removePlugins.push("PageBreak");
			}
			if (this.control.Extras["ckEditorHighlightIsAvailable"] === undefined) {
				removePlugins.push("Highlight");
			}
			if (this.control.Extras["ckEditorCodeIsAvailable"] === undefined) {
				removePlugins.push("Code", "CodeBlock");
			}
			if (removePlugins.length > 0) {
				this._ckEditorConfig.removePlugins = removePlugins.distinct();
			}
			const toolbar = this.control.Extras["ckEditorToolbar"];
			if (AppUtility.isObject(toolbar, true) || AppUtility.isArray(toolbar, true)) {
				this._ckEditorConfig.toolbar = toolbar;
			}
			if (this.configSvc.isDebug) {
				console.log("CKEditor --------------------------------");
				console.log("+ Plugins:", this.ckEditor.builtinPlugins.map(plugin => plugin.pluginName));
				console.log("+ Default configuration:", this.ckEditor.defaultConfig);
				console.log("+ Runtime configuration:", this._ckEditorConfig);
				console.log("-----------------------------------------");
			}
		}
		return this._ckEditorConfig;
	}

	ckEditorOnReady(editor: any) {
		editor.ui.getEditableElement().parentElement.insertBefore(editor.ui.view.toolbar.element, editor.ui.getEditableElement());
	}

	ckEditorSetData(data: any) {
		if (this.isTextEditorControl) {
			this.elementRef.editorInstance.setData(data);
		}
	}

	ckEditorGetData() {
		return this.isTextEditorControl ? this.elementRef.editorInstance.getData() : undefined;
	}

}
