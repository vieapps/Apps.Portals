import "@angular/compiler";
import assert from "node:assert/strict";
import test from "node:test";
import { Observable, of } from "rxjs";
import { SimpleChange } from "@angular/core";
import { FormGroup, FormControl } from "@angular/forms";
import { AppAPIs } from "@app/components/app.apis";
import { AppCustomCompleter } from "@app/components/app.completer";
import { AppCompleterControl } from "@app/components/app.completer.control";
import { AppFormsControl } from "@app/components/forms.objects";
import { AppFormsControlComponent } from "@app/components/forms.control.component";

const addresses = [{ Unit: "Bến Nghé", Province: "Hồ Chí Minh", Country: "VN", Title: "Bến Nghé, Hồ Chí Minh, VN", TitleANSI: "Ben Nghe, Ho Chi Minh, VN" }];
const local = () => AppCustomCompleter.local(addresses, "Title,TitleANSI", "Title");
const bridge = source => {
	const view = new AppCompleterControl({ markForCheck: () => {} } as any, { nativeElement: { closest: () => null } } as any);
	view.datasource = source; view.pause = 20; view.minSearchLength = 2;
	view.ngOnChanges({ datasource: new SimpleChange(undefined, source, true) });
	return view;
};

test("local accented and unaccented lookup preserves original object and initial conversion", () => {
	const source = local(); let items;
	source.subscribe(value => items = value);
	source.search("ben nghe"); assert.equal(items[0].originalObject, addresses[0]);
	source.search("Hồ Chí Minh"); assert.equal(items[0].title, addresses[0].Title);
	assert.equal(source.convertToItem(addresses[0]).originalObject, addresses[0]);
	source.search("missing"); assert.deepEqual(items, []);
});

test("URL builder retains GET, app headers, response conversion and request cancellation", context => {
	const requests: any[] = []; const cancellations: string[] = [];
	context.mock.method(AppAPIs, "getURL", path => "https://fixture.invalid/" + path);
	context.mock.method(AppAPIs, "getHeaders", () => ({ "x-app-token": "fixture" }));
	context.mock.method(AppAPIs, "sendXMLHttpRequest", (method, url, options) => new Observable(observer => {
		requests.push({ method, url, options, observer }); return () => cancellations.push(url);
	}));
	const objects = [{ ID: "1", Name: "Remote object" }];
	const convert = item => ({ title: item.Name, originalObject: item });
	const source = new AppCustomCompleter(term => "lookup?q=" + encodeURIComponent(term), data => data.Objects.map(convert), convert);
	let items; source.subscribe(value => items = value);
	source.search("old"); source.search("new term");
	assert.deepEqual(cancellations, ["https://fixture.invalid/lookup?q=old"]);
	assert.equal(requests[1].method, "GET"); assert.equal(requests[1].url, "https://fixture.invalid/lookup?q=new%20term");
	assert.equal(requests[1].options.headers["x-app-token"], "fixture");
	requests[0].observer.next({ Objects: [{ Name: "stale" }] }); assert.equal(items, undefined);
	requests[1].observer.next({ Objects: objects }); assert.equal(items[0].originalObject, objects[0]);
	requests[1].observer.complete(); assert.equal(source.loading.value, false);
	source.cancel();
});

test("array and Objects API envelopes use single-item conversion; URL string encodes term", context => {
	const calls: any[] = [];
	context.mock.method(AppAPIs, "getURL", path => path);
	context.mock.method(AppAPIs, "sendXMLHttpRequest", (method, path) => { calls.push(path); return of(calls.length === 1 ? [{ ID: 1 }] : { Objects: [{ ID: 2 }] }); });
	const source = new AppCustomCompleter("https://fixture.invalid/?q={{term}}", undefined, item => ({ title: String(item.ID), originalObject: item }));
	let items; source.subscribe(value => items = value);
	source.search("a b"); assert.equal(items[0].originalObject.ID, 1);
	source.search("c"); assert.equal(items[0].originalObject.ID, 2);
	assert.equal(calls[0], "https://fixture.invalid/?q=a%20b");
});

test("HTTP failure clears loading/results and leaves datasource reusable", context => {
	context.mock.method(console, "error", () => {});
	let observer;
	context.mock.method(AppAPIs, "sendXMLHttpRequest", () => new Observable(value => { observer = value; }));
	const source = new AppCustomCompleter(() => "https://fixture.invalid/"); let items;
	source.subscribe(value => items = value);
	source.search("one"); assert.equal(source.loading.value, true);
	observer.error(new Error("fixture")); assert.deepEqual(items, []); assert.equal(source.loading.value, false);
	source.search("two"); observer.next(["ok"]); assert.equal(items[0].originalObject, "ok"); source.cancel();
});

test("UI bridge debounces input, cancels immediately, and suppresses short/closed/destroyed searches", context => {
	context.mock.timers.enable({ apis: ["setInterval", "Date"] });
	const source = local(); const searches: string[] = [];
	context.mock.method(source, "search", term => searches.push(term));
	let cancels = 0; context.mock.method(source, "cancel", () => { cancels++; });
	const view = bridge(source);
	view.terms.next("be"); view.terms.next("ben"); assert.ok(cancels >= 2);
	context.mock.timers.tick(20); assert.deepEqual(searches, ["ben"]);
	view.terms.next("x"); context.mock.timers.tick(20); assert.equal(searches.length, 1);
	view.terms.next("closed"); view.cancelSearch(); context.mock.timers.tick(20); assert.equal(searches.length, 1);
	view.terms.next("destroyed"); view.ngOnDestroy(); context.mock.timers.tick(20); assert.equal(searches.length, 1);
});

test("initial object does not invoke callback; choose emits original object and clear-selected is silent", () => {
	const source = local(); const view = bridge(source); const selected: any[] = [];
	view.selected.subscribe(value => selected.push(value));
	view.initialValue = addresses[0]; view.ngOnChanges({ initialValue: new SimpleChange(undefined, addresses[0], true) });
	assert.equal(view.selection.originalObject, addresses[0]); assert.deepEqual(selected, []);
	view.choose(source.convertToItem(addresses[0])); assert.equal(selected[0].originalObject, addresses[0]);
	view.clearSelected = true; let written = "unchanged";
	view.select = { writeValue: value => written = value } as any;
	view.choose(source.convertToItem(addresses[0])); assert.equal(view.selection, null); assert.equal(written, null); assert.equal(selected.length, 2);
	view.choose(undefined); assert.equal(selected[2], undefined); view.ngOnDestroy();
});

test("datasource replacement unsubscribes old results and cancels old request", () => {
	const oldSource = local(), nextSource = local(); const view = bridge(oldSource);
	view.datasource = nextSource;
	view.ngOnChanges({ datasource: new SimpleChange(oldSource, nextSource, false) });
	view.terms.next("ben"); oldSource.next([{ title: "stale", originalObject: {} }]); assert.deepEqual(view.items, []);
	nextSource.next([nextSource.convertToItem(addresses[0])]); assert.equal(view.items[0].originalObject, addresses[0]); view.ngOnDestroy();
});

test("Address selection fills three fields, clear empties them, unrelated fields remain intact", () => {
	const definition = new AppFormsControl({ Name: "Addresses", Type: "Lookup", Options: { Type: "Address", LookupOptions: { AsModal: false, AsCompleter: true } } });
	const form = new FormGroup({ Unit: new FormControl("old"), Province: new FormControl("old"), Country: new FormControl("VN"), Other: new FormControl("keep") });
	const component = new AppFormsControlComponent({} as any, {} as any, { getMetaUnits: () => addresses } as any, { detectChanges: () => {} } as any);
	component.control = definition; component.formGroup = form; component.ngOnInit();
	component.onChanged(local().convertToItem(addresses[0]));
	assert.deepEqual(form.value, { Unit: "Bến Nghé", Province: "Hồ Chí Minh", Country: "VN", Other: "keep" });
	component.onChanged(undefined); assert.deepEqual(form.value, { Unit: "", Province: "", Country: "", Other: "keep" }); component.ngOnDestroy();
});
