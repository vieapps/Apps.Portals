import { AbstractControl } from "@angular/forms";
import { ValidatorFn, AsyncValidatorFn } from "@angular/forms";
import { CompleterData } from "ng2-completer";
import { AppUtility } from "@app/components/app.utility";
import { PlatformUtility } from "@app/components/app.utility.platform";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { AppFormsViewComponent } from "@app/components/forms.view.component";

/** Presents the settings of a segment (means a tab that contains group of controls) in the dynamic forms */
export class AppFormsSegment {

	constructor(
		name?: string,
		label?: string,
		icon?: string
	) {
		this._name = name || "";
		this._label = label || "";
		this._icon = icon;
	}

	private _name: string;
	private _label: string;
	private _icon: string;

	/** Gets the name of the segment */
	get Name() {
		return this._name;
	}

	/** Gets the lable of the segment */
	get Label() {
		return this._label;
	}

	/** Gets the icon name of the segment */
	get Icon() {
		return this._icon;
	}

}

//  ---------------------------------------------------------------

/** Presents a value for working with lookup in the dynamic forms */
export interface AppFormsLookupValue {
	Value: string;
	Label: string;
	Description?: string;
	Image?: string;
	Extras?: { [key: string]: any };
	Children?: Array<AppFormsLookupValue>;
}

//  ---------------------------------------------------------------

/** Presents the icon options of a control in the dynamic forms */
export interface AppFormsControlIconOptionsConfig {
	Name?: string;
	Fill?: string;
	Color?: string;
	Slot?: string;
	OnClick?: (event: Event, control: AppFormsControlComponent | AppFormsViewComponent) => void;
}

//  ---------------------------------------------------------------

/** Presents the select options of a control in the dynamic forms */
export interface AppFormsControlSelectOptionsConfig {
	Values?: string | Array<string> | Array<AppFormsLookupValue>;
	RemoteURI?: string;
	RemoteURIConverter?: (data: any) => AppFormsLookupValue;
	RemoteURIProcessor?: (uri: string, converter?: (data: any) => AppFormsLookupValue) => Promise<Array<AppFormsLookupValue>>;
	Multiple?: boolean;
	AsBoxes?: boolean;
	Interface?: string;
	InterfaceOptions?: any;
	OkText?: string;
	CancelText?: string;
}

//  ---------------------------------------------------------------

/** Presents the lookup options of a control in the dynamic forms */
export interface AppFormsControlLookupOptionsConfig {
	Multiple?: boolean;
	OnDelete?: (data: Array<string>, control: AppFormsControlComponent) => void;
	WarningOnDelete?: string;
	AsModal?: boolean;
	ModalOptions?: {
		Component?: any;
		ComponentProps?: { [key: string]: any };
		BackdropDismiss?: boolean;
		SwipeToClose?: boolean
		OnDismiss?: (data?: any, control?: AppFormsControlComponent) => void;
	};
	AsCompleter?: boolean;
	CompleterOptions?: {
		SearchingText?: string;
		NoResultsText?: string;
		PauseMiliseconds?: number;
		ClearSelected?: boolean;
		DataSource?: CompleterData;
		InitialValue?: any;
		GetInitialValue?: (control: AppFormsControlComponent) => any;
		OnInitialized?: (control: AppFormsControlComponent) => void;
		OnSelected?: (data: any, control: AppFormsControlComponent) => void;
		AllowLookupByModal?: boolean;
	};
	AsSelector?: boolean;
	SelectorOptions?: {
		HeaderText?: string;
		OkText?: string;
		CancelText?: string;
		OnAdd?: (control?: AppFormsControlComponent) => void;
	};
}

//  ---------------------------------------------------------------

/** Presents the date-picker options of a control in the dynamic forms */
export interface AppFormsControlDatePickerOptionsConfig {
	AllowTimes?: boolean;
	DisplayFormat?: string;
	PickerFormat?: string;
	DayNames?: string;
	DayShortNames?: string;
	MonthNames?: string;
	MonthShortNames?: string;
	DoneText?: string;
	CancelText?: string;
	AllowDelete?: boolean;
}

//  ---------------------------------------------------------------

/** Presents the file-picker options of a control in the dynamic forms */
export interface AppFormsControlFilePickerOptionsConfig {
	Accept?: string;
	Multiple?: boolean;
	AllowSelect?: boolean;
	AllowPreview?: boolean;
	AllowDelete?: boolean;
	OnDelete?: (name: string, control: AppFormsControlComponent) => void;
	WarningOnDelete?: string;
}

//  ---------------------------------------------------------------

/** Presents the range options of a control in the dynamic forms */
export interface AppFormsControlRangeOptionsConfig {
	AllowPin?: boolean;
	AllowSnaps?: boolean;
	AllowDualKnobs?: boolean;
	AllowTicks?: boolean;
	Step?: number;
	Icons?: {
		Start?: string;
		End?: string;
	};
}

//  ---------------------------------------------------------------

/** Presents the button options of a control in the dynamic forms */
export interface AppFormsControlButtonOptionsConfig {
	OnClick?: (event: Event, control: AppFormsControl) => void;
	Fill?: string;
	Color?: string;
	Icon?: {
		Name?: string;
		Slot?: string;
	};
}

//  ---------------------------------------------------------------

/** Presents the options of a control in the dynamic forms */
export interface AppFormsControlOptionsConfig {
	Label?: string;
	LabelOptions?: {
		Position?: string;
		Color?: string;
		Css?: string;
	};
	Description?: string;
	DescriptionOptions?: {
		Css?: string;
		Style?: string;
	};
	Type?: string;
	Name?: string;
	Css?: string;
	Color?: string;
	PlaceHolder?: string;
	ValidatePattern?: string;
	Disabled?: boolean;
	ReadOnly?: boolean;
	AutoFocus?: boolean;
	MinValue?: any;
	MaxValue?: any;
	MinLength?: number;
	MaxLength?: number;
	Width?: string;
	Height?: string;
	Rows?: number;
	Icon?: AppFormsControlIconOptionsConfig;
	SelectOptions?: AppFormsControlSelectOptionsConfig;
	LookupOptions?: AppFormsControlLookupOptionsConfig;
	DatePickerOptions?: AppFormsControlDatePickerOptionsConfig;
	FilePickerOptions?: AppFormsControlFilePickerOptionsConfig;
	RangeOptions?: AppFormsControlRangeOptionsConfig;
	ButtonOptions?: AppFormsControlButtonOptionsConfig;
	OnAfterViewInit?: (control: AppFormsControlComponent | AppFormsViewComponent) => void;
	OnFocus?: (event: Event, control: AppFormsControlComponent) => void;
	OnKeyUp?: (event: KeyboardEvent, control: AppFormsControlComponent) => void;
	OnBlur?: (event: Event, control: AppFormsControlComponent) => void;
	OnChanged?: (event: any, control: AppFormsControlComponent) => void;
}

//  ---------------------------------------------------------------

/** Presents the configuration of a control in the dynamic forms */
export interface AppFormsControlConfig {
	Name?: string;
	Order?: number;
	Segment?: string;
	Type?: string;
	Hidden?: boolean;
	Required?: boolean;
	Validators?: Array<ValidatorFn> | Array<string>;
	AsyncValidators?: Array<AsyncValidatorFn> | Array<string>;
	Extras?: { [key: string]: any };
	Options?: AppFormsControlOptionsConfig;
	SubControls?: {
		AsArray?: boolean;
		Controls?: Array<AppFormsControlConfig>
	};
}

//  ---------------------------------------------------------------

/** Presents the settings of a control in the dynamic forms */
export class AppFormsControl {

	constructor(
		options?: any,
		order?: number
	) {
		if (options !== undefined) {
			this.assign(options, this, order);
		}
	}

	Name: string;
	Order: number;
	Segment: string;
	Type: string;
	Hidden: boolean;
	Required: boolean;
	Validators: Array<ValidatorFn> | Array<string>;
	AsyncValidators: Array<AsyncValidatorFn> | Array<string>;
	Extras: { [key: string]: any };
	Options = {
		Label: undefined as string,
		LabelOptions: {
			Position: "stacked",
			Color: "",
			Css: ""
		},
		Description: undefined as string,
		DescriptionOptions: {
			Css: "description",
			Style: ""
		},
		Type: "text",
		Name: "",
		Css: "",
		Color: "",
		PlaceHolder: undefined as string,
		ValidatePattern: undefined as string,
		Disabled: false,
		ReadOnly: false,
		AutoFocus: false,
		MinValue: undefined as any,
		MaxValue: undefined as any,
		MinLength: undefined as number,
		MaxLength: undefined as number,
		Width: undefined as string,
		Height: undefined as string,
		Rows: undefined as number,
		OnAfterViewInit: undefined as (control: AppFormsControlComponent | AppFormsViewComponent) => void,
		OnFocus: undefined as (event: Event, control: AppFormsControlComponent) => void,
		OnKeyUp: undefined as (event: KeyboardEvent, control: AppFormsControlComponent) => void,
		OnBlur: undefined as (event: Event, control: AppFormsControlComponent) => void,
		OnChanged: undefined as (event: any, control: AppFormsControlComponent) => void,
		Icon: {
			Name: undefined as string,
			Fill: undefined as string,
			Color: undefined as string,
			Slot: undefined as string,
			OnClick: undefined as (event: Event, control: AppFormsControlComponent | AppFormsViewComponent) => void
		},
		SelectOptions: {
			Values: undefined as Array<AppFormsLookupValue>,
			RemoteURI: undefined as string,
			RemoteURIConverter: undefined as (data: any) => AppFormsLookupValue,
			RemoteURIProcessor: undefined as (uri: string, converter?: (data: any) => AppFormsLookupValue) => Promise<Array<AppFormsLookupValue>>,
			Multiple: false,
			AsBoxes: false,
			Interface: "alert",
			InterfaceOptions: undefined as any,
			OkText: "{{common.buttons.ok}}",
			CancelText: "{{common.buttons.cancel}}"
		},
		LookupOptions: {
			Multiple: false,
			OnDelete: undefined as (data: Array<string>, control: AppFormsControlComponent) => void,
			WarningOnDelete: undefined as string,
			AsModal: true,
			ModalOptions: {
				Component: undefined as any,
				ComponentProps: undefined as { [key: string]: any },
				BackdropDismiss: false,
				SwipeToClose: false,
				OnDismiss: undefined as (data?: any, control?: AppFormsControlComponent) => void
			},
			AsCompleter: false,
			CompleterOptions: {
				SearchingText: "{{common.messages.completer.searching}}",
				NoResultsText: "{{common.messages.completer.noresults}}",
				PauseMiliseconds: 234,
				ClearSelected: false,
				DataSource: undefined as CompleterData,
				InitialValue: undefined as any,
				GetInitialValue: undefined as (control: AppFormsControlComponent) => any,
				OnInitialized: undefined as (control: AppFormsControlComponent) => void,
				OnSelected: undefined as (data: any, control: AppFormsControlComponent) => void,
				AllowLookupByModal: false
			},
			AsSelector: false,
			SelectorOptions: {
				HeaderText: undefined as string,
				OkText: "{{common.buttons.ok}}",
				CancelText: "{{common.buttons.cancel}}",
				OnAdd: undefined as (control: AppFormsControlComponent) => void
			}
		},
		DatePickerOptions: {
			AllowTimes: false,
			DisplayFormat: undefined as string,
			PickerFormat: undefined as string,
			DayNames: undefined as string,
			DayShortNames: undefined as string,
			MonthNames: undefined as string,
			MonthShortNames: undefined as string,
			DoneText: "{{common.buttons.done}}",
			CancelText: "{{common.buttons.cancel}}",
			AllowDelete: true
		},
		FilePickerOptions: {
			Accept: "*",
			Multiple: true,
			AllowSelect: true,
			AllowPreview: false,
			AllowDelete: true,
			OnDelete: undefined as (name: string, control: AppFormsControlComponent) => void,
			WarningOnDelete: undefined as string
		},
		RangeOptions: {
			AllowPin: true,
			AllowSnaps: false,
			AllowDualKnobs: false,
			AllowTicks: true,
			Step: 1,
			Icons: {
				Start: undefined as string,
				End: undefined as string
			}
		},
		ButtonOptions: {
			OnClick: undefined as (event: Event, control: AppFormsControl) => void,
			Fill: "solid",
			Color: undefined as string,
			Icon: {
				Name: undefined as string,
				Slot: undefined as string
			}
		}
	};
	SubControls: {
		AsArray: boolean;
		Controls: Array<AppFormsControl>
	};

	/** Gets uri of the captcha image */
	get captchaURI() {
		return this.Extras["_captchaURI"];
	}

	/** Sets uri of the captcha image */
	set captchaURI(value: string) {
		this.Extras["_captchaURI"] = value;
	}

	/** Gets the reference to the UI element */
	get elementRef() {
		return this.Extras["_elementRef"];
	}

	/** Sets the reference to the UI element */
	set elementRef(value: any) {
		this.Extras["_elementRef"] = value;
	}

	/** Gets the reference to the form control */
	get formControlRef() {
		return this.Extras["_formRef"];
	}

	/** Sets the reference to the form control */
	set formControlRef(value: AbstractControl) {
		this.Extras["_formRef"] = value;
	}

	/** Gets the reference to the form control component */
	get controlRef() {
		return this.Extras["_controlRef"];
	}

	/** Sets the reference to the form control component */
	set controlRef(value: AppFormsControlComponent) {
		this.Extras["_controlRef"] = value;
	}

	/** Gets the reference to the next sibling */
	get next() {
		return this.Extras["_nextControl"];
	}

	/** Sets the reference to the next sibling */
	set next(value: AppFormsControl) {
		this.Extras["_nextControl"] = value;
	}

	/** Gets the reference to the parent sibling */
	get parent() {
		return this.Extras["_parentControl"];
	}

	/** Sets the reference to the parent sibling */
	set parent(value: AppFormsControl) {
		this.Extras["_parentControl"] = value;
	}

	/** Gets the index of segment (if has) */
	get segmentIndex() {
		const index = this.Extras["_segmentIndex"];
		return index !== undefined ? index as number : 0;
	}

	/** Sets the index of segment (if has) */
	set segmentIndex(value: number) {
		this.Extras["_segmentIndex"] = value;
	}

	/** Gets the value of the control */
	get value() {
		return AppUtility.isEquals(this.Type, "Text")
			? this.Extras["Text"] || this.Extras["text"] || this.Extras["_value"]
			: this.formControlRef !== undefined ? this.formControlRef.value : this.Extras["_value"];
	}

	/** Sets the value of the control */
	set value(value: any) {
		if (this.formControlRef !== undefined) {
			this.formControlRef.setValue(value, { onlySelf: true });
		}
		else {
			this.Extras["_value"] = value;
		}
	}

	private assign(options: any, control?: AppFormsControl, order?: number, alternativeName?: string) {
		options = options || {};
		control = control || new AppFormsControl();
		control.Order = (options.Order !== undefined ? options.Order : undefined) || (options.order !== undefined ? options.order : undefined) || (order !== undefined ? order : 0);
		control.Segment = options.Segment || options.segment;

		control.Name = options.Name || options.name || (alternativeName !== undefined ? `${alternativeName}_${control.Order}` : `c_${control.Order}`);
		control.Type = options.Type || options.type || "TextBox";

		control.Hidden = !!(options.Hidden || options.hidden);
		control.Required = !control.Hidden && !!(options.Required || options.required);
		control.Extras = options.Extras || options.extras || {};

		control.Validators = options.Validators || options.validators;
		control.AsyncValidators = options.AsyncValidators || options.asyncValidators || options.asyncvalidators;

		const controlOptions = options.Options || options.options;
		if (controlOptions !== undefined) {
			control.Options.Label = controlOptions.Label || controlOptions.label;
			const labelOptions = controlOptions.LabelOptions || controlOptions.labeloptions;
			if (labelOptions !== undefined) {
				control.Options.LabelOptions.Position = labelOptions.Position || labelOptions.position || "stacked";
				control.Options.LabelOptions.Color = labelOptions.Color || labelOptions.color;
				control.Options.LabelOptions.Css = labelOptions.Css || labelOptions.css || "";
			}

			control.Options.Description = controlOptions.Description || controlOptions.description;
			const descriptionOptions = controlOptions.DescriptionOptions || controlOptions.descriptionOptions || controlOptions.descriptionoptions;
			if (descriptionOptions !== undefined) {
				control.Options.DescriptionOptions.Css = descriptionOptions.Css || descriptionOptions.css || "description";
				control.Options.DescriptionOptions.Style = descriptionOptions.Style || descriptionOptions.style || "";
			}

			control.Options.Type = controlOptions.Type || controlOptions.type || "text";
			control.Options.Name = controlOptions.Name || controlOptions.name || (alternativeName !== undefined ? `${alternativeName}-${control.Name}` : `${control.Name}`);
			control.Options.Css = controlOptions.Css || controlOptions.css || "";
			control.Options.Color = controlOptions.Color || controlOptions.color;
			control.Options.PlaceHolder = controlOptions.PlaceHolder || controlOptions.placeHolder || controlOptions.placeholder;
			control.Options.ValidatePattern = controlOptions.ValidatePattern || controlOptions.validatePattern || controlOptions.validatepattern;

			control.Options.Disabled = !!(controlOptions.Disabled || controlOptions.disabled);
			control.Options.ReadOnly = !!(controlOptions.ReadOnly || controlOptions.readOnly || controlOptions.readonly);
			control.Options.AutoFocus = !!(controlOptions.AutoFocus || controlOptions.autoFocus || controlOptions.autofocus);

			control.Options.MinValue = controlOptions.MinValue || controlOptions.minValue || controlOptions.minvalue;
			control.Options.MaxValue = controlOptions.MaxValue || controlOptions.maxValue || controlOptions.maxvalue;

			control.Options.MinLength = controlOptions.MinLength || controlOptions.minLength || controlOptions.minlength;
			control.Options.MaxLength = controlOptions.MaxLength || controlOptions.maxLength || controlOptions.maxlength;

			control.Options.Width = controlOptions.Width || controlOptions.width;
			control.Options.Height = controlOptions.Height || controlOptions.height;
			control.Options.Rows = controlOptions.Rows || controlOptions.rows;

			control.Options.OnAfterViewInit = controlOptions.OnAfterViewInit || controlOptions.onAfterViewInit || controlOptions.onafterviewinit;
			control.Options.OnFocus = controlOptions.OnFocus || controlOptions.onFocus || controlOptions.onfocus;
			control.Options.OnKeyUp = controlOptions.OnKeyUp || controlOptions.onKeyUp || controlOptions.onkeyup;
			control.Options.OnBlur = controlOptions.OnBlur || controlOptions.onBlur || controlOptions.onblur;
			control.Options.OnChanged = controlOptions.OnChanged || controlOptions.onChanged || controlOptions.onchanged;

			let icon = controlOptions.Icon || controlOptions.icon;
			if (icon !== undefined) {
				control.Options.Icon = {
					Name: icon.Name || icon.name,
					Fill: icon.Fill || icon.fill,
					Color: icon.Color || icon.color,
					Slot: icon.Slot || icon.slot,
					OnClick: icon.OnClick || icon.onClick || icon.onclick,
				};
			}

			const selectOptions = controlOptions.SelectOptions || controlOptions.selectOptions || controlOptions.selectoptions;
			if (selectOptions !== undefined) {
				const selectValues = selectOptions.Values || selectOptions.values;
				control.Options.SelectOptions = {
					Values: AppUtility.isNotEmpty(selectValues)
						? ((AppUtility.indexOf(selectValues, "#;") > 0 ? AppUtility.toArray(selectValues, "#;") : AppUtility.toArray(selectValues, ";")) as Array<string>).map(value => ({ Value: value, Label: value }))
						: AppUtility.isArray(selectValues, true)
							? selectValues.length > 0 && typeof selectValues[0] === "string"
								? (selectValues as Array<string>).map(value => ({ Value: value, Label: value }))
								: (selectValues as Array<any>).map(data => ({ Value: data.Value || data.value, Label: data.Label || data.label || data.Value || data.value, Description: data.Description || data.description }))
							: [],
					RemoteURI: selectOptions.RemoteURI || selectOptions.remoteURI || selectOptions.remoteuri,
					RemoteURIConverter: selectOptions.RemoteURIConverter || selectOptions.remoteURIConverter || selectOptions.remoteuriconverter,
					RemoteURIProcessor: selectOptions.RemoteURIProcessor || selectOptions.remoteURIProcessor || selectOptions.remoteuriprocessor,
					Multiple: !!(selectOptions.Multiple || selectOptions.multiple),
					AsBoxes: !!(selectOptions.AsBoxes || selectOptions.asboxes),
					Interface: selectOptions.Interface || selectOptions.interface || "alert",
					InterfaceOptions: selectOptions.InterfaceOptions || selectOptions.interfaceOptions || selectOptions.interfaceoptions,
					OkText: selectOptions.OkText || selectOptions.okText || selectOptions.oktext || "{{common.buttons.ok}}",
					CancelText: selectOptions.CancelText || selectOptions.cancelText || selectOptions.canceltext || "{{common.buttons.cancel}}"
				};
			}

			const lookupOptions = controlOptions.LookupOptions || controlOptions.lookupOptions || controlOptions.lookupoptions;
			if (lookupOptions !== undefined) {
				const asModal = lookupOptions.AsModal !== undefined || lookupOptions.asModal !== undefined || lookupOptions.asmodal !== undefined ? !!(lookupOptions.AsModal || lookupOptions.asModal || lookupOptions.asmodal) : true;
				const modalOptions = lookupOptions.ModalOptions || lookupOptions.modalOptions || lookupOptions.modaloptions || {};
				const asCompleter = !asModal && (lookupOptions.AsCompleter !== undefined || lookupOptions.asCompleter !== undefined || lookupOptions.ascompleter !== undefined ? !!(lookupOptions.AsCompleter || lookupOptions.asCompleter || lookupOptions.ascompleter) : false);
				const completerOptions = lookupOptions.CompleterOptions || lookupOptions.completerOptions || lookupOptions.completeroptions || {};
				const asSelector = !asModal && !asCompleter && (lookupOptions.AsSelector !== undefined || lookupOptions.asSelector !== undefined || lookupOptions.asselector !== undefined ? !!(lookupOptions.AsSelector || lookupOptions.asSelector || lookupOptions.asselector) : false);
				const selectorOptions = lookupOptions.SelectorOptions || lookupOptions.selectorOptions || lookupOptions.selectoroptions || {};
				control.Options.LookupOptions = {
					AsModal: asModal,
					ModalOptions: {
						Component: modalOptions.Component || modalOptions.component,
						ComponentProps: modalOptions.ComponentProps || modalOptions.componentProps || modalOptions.componentprops,
						BackdropDismiss: !!(modalOptions.BackdropDismiss || modalOptions.backdropDismiss || modalOptions.backdropdismiss),
						SwipeToClose: !!(modalOptions.SwipeToClose || modalOptions.swipeToClose || modalOptions.swipetoclose),
						OnDismiss: modalOptions.OnDismiss || modalOptions.onDismiss || modalOptions.ondismiss
					},
					AsCompleter: asCompleter,
					CompleterOptions: {
						SearchingText: completerOptions.SearchingText || completerOptions.searchingText || completerOptions.searchingtext || "{{common.messages.completer.searching}}",
						NoResultsText: completerOptions.NoResultsText || completerOptions.noResultsText || completerOptions.noresultstext || "{{common.messages.completer.noresults}}",
						PauseMiliseconds: completerOptions.PauseMiliseconds || completerOptions.pauseMiliseconds || completerOptions.pausemiliseconds || 123,
						ClearSelected: !!(completerOptions.ClearSelected || completerOptions.clearSelected || completerOptions.clearselected),
						DataSource: completerOptions.DataSource || completerOptions.dataSource || completerOptions.datasource,
						InitialValue: completerOptions.InitialValue || completerOptions.initialValue || completerOptions.initialvalue,
						GetInitialValue: completerOptions.GetInitialValue || completerOptions.getInitialValue || completerOptions.getinitialvalue,
						OnInitialized: completerOptions.OnInitialized || completerOptions.onInitialized || completerOptions.oninitialized,
						OnSelected: completerOptions.OnSelected || completerOptions.onSelected || completerOptions.onselected,
						AllowLookupByModal: !!(completerOptions.AllowLookupByModal || completerOptions.allowLookupByModal || completerOptions.allowlookupbymodal)
					},
					AsSelector: asSelector,
					SelectorOptions: {
						HeaderText: selectorOptions.HeaderText || selectorOptions.headerText || selectorOptions.headertext,
						OkText: selectorOptions.OkText || selectorOptions.okText || selectorOptions.oktext || "{{common.buttons.ok}}",
						CancelText: selectorOptions.CancelText || selectorOptions.cancelText || selectorOptions.canceltext || "{{common.buttons.cancel}}",
						OnAdd: selectorOptions.OnAdd || selectorOptions.onAdd || selectorOptions.onadd
					},
					Multiple: lookupOptions.Multiple !== undefined || lookupOptions.multiple !== undefined ? !!(lookupOptions.Multiple || lookupOptions.multiple) : !asCompleter,
					OnDelete: lookupOptions.OnDelete || lookupOptions.onDelete || lookupOptions.ondelete,
					WarningOnDelete: lookupOptions.WarningOnDelete || lookupOptions.warningOnDelete || lookupOptions.warningondelete
				};
			}

			const datepickerOptions = controlOptions.DatePickerOptions || controlOptions.datePickerOptions || controlOptions.datepickerOptions || controlOptions.datepickeroptions;
			if (datepickerOptions !== undefined) {
				control.Options.DatePickerOptions = {
					AllowTimes: !!(datepickerOptions.AllowTimes || datepickerOptions.allowTimes || datepickerOptions.allowtimes),
					DisplayFormat: datepickerOptions.DisplayFormat || datepickerOptions.displayFormat || datepickerOptions.displayformat,
					PickerFormat: datepickerOptions.PickerFormat || datepickerOptions.pickerFormat || datepickerOptions.pickerformat,
					DayNames: datepickerOptions.DayNames || datepickerOptions.dayNames || datepickerOptions.daynames,
					DayShortNames: datepickerOptions.DayShortNames || datepickerOptions.dayShortNames || datepickerOptions.dayshortnames,
					MonthNames: datepickerOptions.MonthNames || datepickerOptions.monthNames || datepickerOptions.monthnames,
					MonthShortNames: datepickerOptions.MonthShortNames || datepickerOptions.monthShortNames || datepickerOptions.monthshortnames,
					DoneText: datepickerOptions.DoneText || datepickerOptions.doneText || datepickerOptions.donetext || "{{common.buttons.done}}",
					CancelText: datepickerOptions.CancelText || datepickerOptions.cancelText || datepickerOptions.canceltext || "{{common.buttons.cancel}}",
					AllowDelete: datepickerOptions.AllowDelete !== undefined || datepickerOptions.allowDelete !== undefined || datepickerOptions.allowdelete !== undefined ? !!(datepickerOptions.AllowDelete || datepickerOptions.allowDelete || datepickerOptions.allowdelete) : true
				};
			}

			const filepickerOptions = controlOptions.FilePickerOptions || controlOptions.filePickerOptions || controlOptions.filepickerOptions || controlOptions.filepickeroptions;
			if (filepickerOptions !== undefined) {
				control.Options.FilePickerOptions = {
					Accept: filepickerOptions.Accept || filepickerOptions.accept || "*",
					Multiple: filepickerOptions.Multiple !== undefined || filepickerOptions.multiple !== undefined ? !!(filepickerOptions.Multiple || filepickerOptions.multiple) : true,
					AllowSelect: filepickerOptions.AllowSelect !== undefined || filepickerOptions.allowSelect !== undefined || filepickerOptions.allowselect !== undefined ? !!(filepickerOptions.AllowSelect || filepickerOptions.allowSelect || filepickerOptions.allowselect) : true,
					AllowPreview: filepickerOptions.AllowPreview !== undefined || filepickerOptions.allowPreview !== undefined || filepickerOptions.allowpreview !== undefined ? !!(filepickerOptions.AllowPreview || filepickerOptions.allowPreview || filepickerOptions.allowpreview) : false,
					AllowDelete: filepickerOptions.AllowDelete !== undefined || filepickerOptions.allowDelete !== undefined || filepickerOptions.allowdelete !== undefined ? !!(filepickerOptions.AllowDelete || filepickerOptions.allowDelete || filepickerOptions.allowdelete) : true,
					OnDelete: filepickerOptions.OnDelete || filepickerOptions.onDelete || filepickerOptions.ondelete,
					WarningOnDelete: filepickerOptions.WarningOnDelete || filepickerOptions.warningOnDelete || filepickerOptions.warningondelete
				};
			}

			const rangeOptions = controlOptions.RangeOptions || controlOptions.rangeOptions || controlOptions.rangeoptions;
			if (rangeOptions !== undefined) {
				const icons = rangeOptions.Icons || rangeOptions.icons || {};
				control.Options.RangeOptions = {
					AllowPin: !!(rangeOptions.AllowPin || rangeOptions.allowPin || rangeOptions.allowpin),
					AllowSnaps: !!(rangeOptions.AllowSnaps || rangeOptions.allowSnaps || rangeOptions.allowSnaps),
					AllowDualKnobs: !!(rangeOptions.AllowDualKnobs || rangeOptions.allowDualKnobs || rangeOptions.allowdualknobs),
					AllowTicks: !!(rangeOptions.AllowTicks || rangeOptions.allowTicks || rangeOptions.allowticks),
					Step: rangeOptions.Step || rangeOptions.step || 1,
					Icons: {
						Start: icons.Start || icons.start,
						End:  icons.End || icons.end
					}
				};
			}

			const buttonOptions = controlOptions.ButtonOptions || controlOptions.buttonOptions || controlOptions.buttonoptions;
			if (buttonOptions !== undefined) {
				icon = buttonOptions.Icon || buttonOptions.icon || {};
				control.Options.ButtonOptions = {
					OnClick: buttonOptions.OnClick || buttonOptions.onClick || buttonOptions.onclick,
					Fill: buttonOptions.Fill || buttonOptions.fill || "solid",
					Color: buttonOptions.Color || buttonOptions.color,
					Icon: {
						Name: icon.Name || icon.name,
						Slot: icon.Slot || icon.slot || "start"
					}
				};
			}
		}

		const subControls = options.SubControls || options.subControls || options.subcontrols;
		if (subControls !== undefined) {
			const subConfig = subControls.Controls || subControls.controls;
			if (AppUtility.isArray(subConfig, true)) {
				control.SubControls = {
					AsArray: !!(subControls.AsArray || subControls.asArray || subControls.asarray),
					Controls: (subConfig as Array<any>).map((subOptions, subOrder) => this.assign(subOptions, undefined, subOrder, control.Name)).sortBy("Order")
				};
				if (control.SubControls.Controls.length < 1) {
					control.SubControls = undefined;
				}
				else {
					control.SubControls.Controls.forEach((subControl, subOrder) => subControl.Order = subOrder);
				}
			}
		}

		return control;
	}

	/** Sets focus into this control */
	focus(defer?: number) {
		PlatformUtility.focus(this.elementRef, defer);
	}

}
