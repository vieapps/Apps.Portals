import "@angular/compiler";
import assert from "node:assert/strict";
import test from "node:test";
import { FormArray, FormControl, FormGroup } from "@angular/forms";
import { of } from "rxjs";
import { AppConfig } from "@app/app.config";
import { AppFormsControl, AppFormsSegment } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";
import { AppFormsControlComponent } from "@app/components/forms.control.component";
import { DataItemControl } from "@app/controls/common/data.item.control";
import { FilesSelectorControl } from "@app/controls/common/file.selector.control";

// UI controllers are injected peers; all network-capable paths are excluded from these definitions.
const makeService = (controllers: any = {}) => new AppFormsService(
	{ get: key => of("translated:" + key) } as any,
	{ getResourceAsync: async key => "translated:" + key } as any,
	controllers.loading, controllers.alert, controllers.actionsheet, controllers.modal, controllers.toast,
	controllers.injector
);
const control = (name = "Title", options: any = {}) => new AppFormsControl({ Name: name, ...options });
const renderer = (definition: AppFormsControl, form: FormGroup, service = makeService()) => {
	const component = new AppFormsControlComponent({} as any, {} as any, service, { detectChanges: () => {} } as any);
	component.control = definition; component.formGroup = form;
	return component;
};

test("metadata casing/defaults retain hidden and callback semantics", () => {
	const changed = () => {};
	const item = new AppFormsControl({ name: "lower", type: "TextBox", hidden: true, required: true, options: { onChanged: changed, disabled: true, readOnly: true } } as any);
	assert.equal(item.Name, "lower"); assert.equal(item.Required, false);
	assert.equal(item.Options.OnChanged, changed); assert.equal(item.Options.Disabled, true); assert.equal(item.Options.ReadOnly, true);
	assert.equal(item.Options.LabelOptions.Position, "stacked");
});

test("hidden and UI-disabled fields remain enabled Angular controls in payload", () => {
	const service = makeService();
	const items = [control("ID", { Hidden: true }), control("Locked", { Options: { Disabled: true } }), control("Display", { Type: "Text", Extras: { Text: "label" } })];
	const form = service.getFormGroup(items);
	form.patchValue({ ID: "keep-id", Locked: "keep-locked" });
	assert.deepEqual(form.value, { ID: "keep-id", Locked: "keep-locked" });
	assert.equal(form.controls.Locked.enabled, true); assert.equal(form.controls.Display, undefined);
});

test("segments sort controls and retain next/parent references after preparation", async () => {
	const service = makeService();
	const segments = { items: [new AppFormsSegment("first"), new AppFormsSegment("second")], default: "first", current: "first" };
	const items = service.getControls([
		{ Name: "Later", Segment: "second" },
		{ Name: "Group", SubControls: { Controls: [{ Name: "Child" }] } },
		{ Name: "Unknown", Segment: "missing" }
	], undefined, segments);
	await (service as any).prepareControlsAsync(items, false);
	assert.deepEqual(items.map(item => item.Name), ["Group", "Unknown", "Later"]);
	assert.equal(items[0].next, items[1]); assert.equal(items[0].SubControls.Controls[0].parent, items[0]);
});

test("metadata copy preserves function/class references and creates independent options", () => {
	const service = makeService(); const callback = () => {};
	class Modal {}
	const original = control("Lookup", { Type: "Lookup", Options: { OnChanged: callback, LookupOptions: { AsModal: true, ModalOptions: { Component: Modal } } } });
	const copied = service.copyControl(original);
	assert.notEqual(copied, original); assert.notEqual(copied.Options, original.Options);
	assert.equal(copied.Options.OnChanged, callback); assert.equal(copied.Options.LookupOptions.ModalOptions.Component, Modal);
});

test("validators retain required/length/pattern, numeric ranges and date boundaries", () => {
	const service = makeService();
	const text = service.getFormControl(control("Text", { Required: true, Options: { Type: "text", MinLength: 2, MaxLength: 4, ValidatePattern: "[a-z]+" } }));
	assert.equal(text.hasError("required"), true); text.setValue("A"); assert.equal(text.hasError("minlength"), true); assert.equal(text.hasError("pattern"), true);
	text.setValue("abc"); assert.equal(text.valid, true); text.setValue("abcde"); assert.equal(text.hasError("maxlength"), true);
	const number = service.getFormControl(control("Number", { Options: { Type: "number", MinValue: 2, MaxValue: 5 } }));
	number.setValue(1); assert.equal(number.hasError("min"), true); number.setValue(6); assert.equal(number.hasError("max"), true);
	const date = service.getFormControl(control("Date", { Options: { Type: "date", MinValue: "2026-01-01", MaxValue: "2026-12-31" } }));
	date.setValue("2025-12-31"); assert.equal(date.hasError("lessThan"), true); date.setValue("2027-01-01"); assert.equal(date.hasError("greater"), true);
});

test("cross-field equality and unimplemented validator declarations keep legacy behavior", () => {
	const service = makeService();
	const form = new FormGroup({ Password: new FormControl("one"), Confirm: new FormControl("two") }, service.areEquals("Password", "Confirm"));
	assert.equal(form.hasError("notEquivalent"), true); assert.equal(form.controls.Confirm.hasError("notEquivalent"), true);
	const item = control("Declared", { Validators: ["not-an-executed-validator"], AsyncValidators: [() => of(null)] } as any);
	assert.deepEqual(service.getValidators(item), []); assert.deepEqual(service.getAsyncValidators(item), []);
});

test("engine builds nested groups and simple/complex FormArrays", () => {
	const service = makeService();
	const items = [control("Details", { SubControls: { Controls: [{ Name: "City" }] } }), control("Tags", { SubControls: { AsArray: true, Controls: [{ Name: "0" }, { Name: "1" }] } }), control("Rows", { SubControls: { AsArray: true, Controls: [{ Name: "0", SubControls: { Controls: [{ Name: "Code" }] } }] } })];
	const form = service.getFormGroup(items);
	form.patchValue({ Details: { City: "Fixture" }, Tags: ["a", "b"], Rows: [{ Code: "row" }] });
	assert.equal(form.controls.Tags instanceof FormArray, true);
	assert.deepEqual(form.value, { Details: { City: "Fixture" }, Tags: ["a", "b"], Rows: [{ Code: "row" }] });
});

test("buildForm expands metadata before constructing its initial FormArray", () => {
	const service = makeService(); const items = [control("Tags", { SubControls: { AsArray: true, Controls: [{ Name: "0" }] } })];
	const form = new FormGroup({}); service.buildForm(form, items, { Tags: ["a", "b"] });
	assert.equal(items[0].SubControls.Controls.length, 2);
	assert.deepEqual(form.value, { Tags: ["a", "b"] });
});

test("array renderer addresses rows by index even when metadata uses business names", () => {
	const service = makeService();
	const definition = control("Tags", { SubControls: { AsArray: true, Controls: [{ Name: "Tag" }] } });
	const form = new FormGroup({}); service.buildForm(form, [definition], { Tags: ["a", "b"] });
	definition.SubControls.Controls.forEach((item, index) => {
		const row = renderer(item, form.controls.Tags as any, service); row.formArrayIndex = index; row.ngOnInit();
		assert.equal(row.formControl.value, index === 0 ? "a" : "b");
	});
});

test("arrays containing arrays expand and render every nested value", () => {
	const service = makeService();
	const item = control("Matrix", { SubControls: { AsArray: true, Controls: [{ Name: "Line", SubControls: { AsArray: true, Controls: [{ Name: "Cell" }] } }] } });
	const form = new FormGroup({}); service.buildForm(form, [item], { Matrix: [["a", "b"], ["c"]] });
	assert.deepEqual(form.value, { Matrix: [["a", "b"], ["c"]] });
	const line = renderer(item.SubControls.Controls[0], form.controls.Matrix as any, service); line.formArrayIndex = 0; line.ngOnInit();
	const cell = renderer(item.SubControls.Controls[0].SubControls.Controls[1], line.formControl as any, service); cell.formArrayIndex = 1; cell.ngOnInit();
	assert.equal(cell.formControl.value, "b");
});

test("array copies own runtime refs at every depth while retaining callbacks", () => {
	const service = makeService(); const changed = () => {};
	const original = control("Row", { Extras: { marker: "keep" }, SubControls: { Controls: [{ Name: "Title", Options: { OnChanged: changed } }] } });
	original.formControlRef = new FormControl("original");
	original.SubControls.Controls[0].formControlRef = new FormControl("child");
	const copied = service.copyControl(original);
	assert.notEqual(copied.Extras, original.Extras); assert.equal(copied.formControlRef, undefined);
	assert.equal(copied.Extras.marker, "keep");
	const child = copied.SubControls.Controls[0];
	assert.notEqual(child.Extras, original.SubControls.Controls[0].Extras);
	assert.equal(child.formControlRef, undefined); assert.equal(child.parent, copied);
	assert.equal(child.Options.OnChanged, changed);
});

test("nested arrays build all values; partial patch retains existing rows and missing arrays keep their seed", () => {
	const service = makeService();
	const item = control("Rows", { SubControls: { AsArray: true, Controls: [{ Name: "Row", SubControls: { Controls: [{ Name: "Tags", SubControls: { AsArray: true, Controls: [{ Name: "Tag" }] } }] } }] } });
	const form = new FormGroup({});
	service.buildForm(form, [item], { Rows: [{ Tags: ["a", "b"] }, { Tags: ["c"] }] });
	assert.deepEqual(form.value, { Rows: [{ Tags: ["a", "b"] }, { Tags: ["c"] }] });
	form.patchValue({ Rows: [{ Tags: ["changed"] }] });
	assert.deepEqual(form.value, { Rows: [{ Tags: ["changed", "b"] }, { Tags: ["c"] }] });
	for (const value of [{}, { Tags: [] }]) {
		const empty = new FormGroup({});
		service.buildForm(empty, [control("Tags", { SubControls: { AsArray: true, Controls: [{ Name: "Tag" }] } })], value);
		assert.deepEqual(empty.value, { Tags: [null] });
	}
});

test("data selector multiple and single modes preserve selected IDs and callbacks", () => {
	const events: any[] = []; const item = control("Selection");
	const selector = new DataItemControl({ color: "light" } as any, makeService());
	Object.assign(selector, { control: item, multiple: true, settings: { selected: new Set(["a"]), handlers: { onSelect: (...args) => events.push(args) } } });
	selector.ngOnInit(); assert.equal(selector.checked("a"), true);
	selector.select({ stopPropagation() {}, detail: { checked: true } }, "b");
	assert.equal(selector.checked("a"), true); assert.equal(selector.checked("b"), true);
	(selector as any).multiple = false;
	selector.select({ stopPropagation() {}, detail: { checked: true } }, "c");
	assert.equal(selector.checked("a"), false); assert.equal(selector.checked("c"), true);
	assert.deepEqual(events, [["b", true], ["c", true]]);
});

test("data selector delete waits for confirmation and forwards selected IDs only", async () => {
	let confirm; let deleted;
	const service = makeService(); service.showAlertAsync = async (...args: any[]) => { confirm = args[3]; };
	const selector = new DataItemControl({} as any, service);
	Object.assign(selector, { control: control(), settings: { selected: new Set(["a"]), resources: { confirm: "fixture confirm" }, handlers: { onDelete: ids => deleted = ids } } });
	selector.ngOnInit(); selector.delete({ stopPropagation() {} } as any);
	assert.equal(deleted, undefined); confirm(); assert.deepEqual(deleted, ["a"]); assert.equal(selector.checked("a"), false);
});

test("confirmation alert keeps Ionic input defaults and separate cancel/confirm callbacks", async () => {
	let options; let confirmed = 0, cancelled = 0;
	const service = makeService({ alert: { create: async value => { options = value; return { present: async () => {}, dismiss: async () => {} }; } } });
	await service.showAlertAsync("fixture", "message", undefined, () => confirmed++, "OK", "Cancel", undefined, false, () => cancelled++);
	assert.deepEqual(options.inputs, []);
	options.buttons[0].handler(); assert.equal(cancelled, 1); assert.equal(confirmed, 0);
	options.buttons[1].handler(); assert.equal(confirmed, 1);
});

test("files selector forwards attachment objects while maintaining single/multiple selection", () => {
	const selected: any[] = []; const item = control("Files"); item.value = [{ ID: "a" }, { ID: "b" }];
	const selector = new FilesSelectorControl({ locales: [] } as any, makeService());
	Object.assign(selector, { control: item, allowSelect: true, settings: { handlers: { onSelect: files => selected.push(files) } } });
	selector.ngOnInit();
	selector.onSelect({ detail: { checked: true } }, item.value[0]);
	selector.onSelect({ detail: { checked: true } }, item.value[1]);
	assert.deepEqual(selected[1], [item.value[1]]);
	(selector as any).multiple = true;
	selector.onSelect({ detail: { checked: true } }, item.value[0]);
	assert.deepEqual(selected[2], item.value);
});

test("lookup dialog forwards props and cancel/result to caller without guessing payload", async () => {
	const service = makeService(); let options: any[]; const results: any[] = [];
	service.showModalAsync = async (...args: any[]) => { options = args; };
	class Dialog {}
	const item = control("Lookup", { Type: "Lookup", Options: { LookupOptions: { AsModal: true, ModalOptions: { Component: Dialog, ComponentProps: { ids: ["a"] }, OnDismiss: (data, source) => results.push([data, source]) } } } });
	const component = renderer(item, service.getFormGroup([item]), service); component.ngOnInit(); component.lookup();
	assert.equal(options[0], Dialog); assert.deepEqual(options[1], { ids: ["a"] });
	options[2](undefined); assert.deepEqual(results[0], [undefined, component]);
	options[2]({ ids: ["b"] }); assert.deepEqual(results[1], [{ ids: ["b"] }, component]);
});

test("select preparation translates options and remains deferred from getControls", async () => {
	const service = makeService();
	const items = service.getControls([{ Name: "Choice", Type: "Select", Options: { Label: "{{field}}", SelectOptions: { Values: [{ Value: "a", Label: "Alpha" }, { Value: "b", Label: "Beta" }] } } }]);
	assert.equal(items[0].Options.Label, "{{field}}");
	await (service as any).prepareControlsAsync(items, false);
	assert.equal(items[0].Options.Label, "translated:field");
	assert.deepEqual((items[0].Options.SelectOptions.Values as any[]).map(({ Value, Label }) => ({ Value, Label })), [{ Value: "a", Label: "Alpha" }, { Value: "b", Label: "Beta" }]);
});

test("select and YesNo renderer events preserve converters/callbacks instead of adding CVA", () => {
	const service = makeService(); let received;
	const item = control("Enabled", { Type: "YesNo", Options: { MinValue: "0", MaxValue: "1", OnChanged: event => received = event } });
	const form = service.getFormGroup([item]); const component = renderer(item, form, service);
	component.focusNext = () => {}; component.ngOnInit();
	const event = { detail: { checked: true } }; component.onChanged(event);
	assert.equal(form.value.Enabled, 1); assert.equal(received, event);
	component.onChanged({ detail: { checked: false } }); assert.equal(form.value.Enabled, 0);
	const choice = control("Choice", { Type: "Select" }); const selection = service.getFormGroup([choice]);
	const select = renderer(choice, selection, service); select.focusNext = () => {}; select.ngOnInit();
	assert.deepEqual(select.selectInterfaceOptions, {});
	assert.equal(select.selectInterface, "alert");
	select.onChanged({ detail: { value: "b" } }); assert.equal(selection.value.Choice, "b");
});

test("legacy edge: metadata OR defaults discard numeric zero but retain string zero", () => {
	assert.equal(control("Number", { Options: { MinValue: 0 } }).Options.MinValue, undefined);
	assert.equal(control("Number", { Options: { MinValue: "0" } }).Options.MinValue, "0");
});

test("array add synchronizes both trees and invokes the existing hook", () => {
	const service = makeService(); let called;
	const item = control("Tags", { SubControls: { AsArray: true, Controls: [{ Name: "0" }] }, Extras: { onControlOfFormArrayAdded: value => called = value } });
	const form = service.getFormGroup([item]); const component = renderer(item, form, service); component.ngOnInit();
	component.addControlOfFormArray();
	assert.equal(item.SubControls.Controls.length, 2); assert.equal((form.controls.Tags as FormArray).length, 2); assert.equal(called, item);
});

test("legacy Address metadata retains Unit/Province/Country payload fields", () => {
	const item = control("Addresses", { Type: "Lookup", Options: { Type: "Address", LookupOptions: { AsModal: false, AsCompleter: true } } });
	const form = makeService().getFormGroup([item]); form.patchValue({ Unit: "Unit", Province: "Province", Country: "Country" });
	assert.deepEqual(form.value, { Unit: "Unit", Province: "Province", Country: "Country" });
	assert.equal(form.controls.Addresses, undefined);
});

test("loading awaits dismiss/present but does not await async continuation work", async () => {
	const order: string[] = []; let finish;
	const service = makeService({ loading: { create: async () => ({ present: async () => { order.push("present"); }, dismiss: async () => { order.push("dismiss"); } }) } });
	await service.showLoadingAsync("fixture");
	await service.hideLoadingAsync(async () => { order.push("callback"); await new Promise(resolve => finish = resolve); order.push("work-done"); });
	assert.deepEqual(order, ["present", "dismiss", "callback"]); finish();
});

test("modal service preserves props/injector and dismiss → onDismiss → onNext order", async () => {
	const order: any[] = []; let options;
	const injector = {};
	const service = makeService({ injector, modal: { create: async value => { options = value; return { present: async () => { order.push("present"); }, dismiss: async () => { order.push("dismiss"); } }; } } });
	class Modal {}
	await service.showModalAsync(Modal, { fixture: true }, value => order.push(["onDismiss", value]));
	assert.equal(options.component, Modal); assert.deepEqual(options.componentProps, { fixture: true }); assert.equal(options.injector, injector);
	await service.hideModalAsync({ saved: true }, value => order.push(["onNext", value]));
	assert.deepEqual(order, ["present", "dismiss", ["onDismiss", { saved: true }], ["onNext", { saved: true }]]);
	await service.hideModalAsync({ ignored: true }, value => order.push(["no-modal", value]));
	assert.deepEqual(order[4], ["no-modal", undefined]);
});

test("deferred visible renderer families fail explicitly instead of silently omitting a field", () => {
	for (const item of [control("Custom", { Type: "Custom" })]) {
		assert.throws(() => renderer(item, makeService().getFormGroup([item])).ngOnInit(), /Renderer not migrated yet/);
	}
});
