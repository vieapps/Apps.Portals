import { ChangeDetectionStrategy, Component, Input, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";
import { AppFormsControl, AppFormsControlConfig } from "@app/components/forms.objects";
import { AppFormsService } from "@app/components/forms.service";

const choices = [{ Value: "a", Label: "Alpha" }, { Value: "b", Label: "Beta" }];

@Component({
	selector: "verification-lookup-modal", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Fixture lookup dialog</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<control-data-item [control]="control" [items]="items" [settings]="settings" [multiple]="multiple"></control-data-item>
			<ion-button (click)="save()">Save lookup selection</ion-button>
			<ion-button (click)="cancel()">Cancel lookup selection</ion-button>
		</ion-content>`
})
export class LookupFixtureModal implements OnInit {
	@Input() initialIDs: string[] = [];
	@Input() multiple = true;
	items = choices;
	selected: string[] = [];
	control = new AppFormsControl({ Name: "Selection" });
	settings: any;
	constructor(private forms: AppFormsService) {}
	ngOnInit() {
		this.selected = [...this.initialIDs];
		this.settings = { allowAdd: false, allowDelete: false, selected: new Set(this.selected), handlers: {
			onSelect: (id: string, checked: boolean) => {
				this.selected = checked ? this.multiple ? Array.from(new Set([...this.selected, id])) : [id] : this.selected.filter(value => value !== id);
			}
		} };
	}
	save() { return this.forms.hideModalAsync({ ids: this.selected, items: choices.filter(item => this.selected.includes(item.Value)) }); }
	cancel() { return this.forms.hideModalAsync(); }
}

@Component({
	selector: "verification-arrays-page", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ion-header><ion-toolbar><ion-title>Arrays and lookup verification</ion-title></ion-toolbar></ion-header>
		<ion-content class="ion-padding">
			<app-form [form]="form" [config]="config" [value]="initial"></app-form>
			<ion-button (click)="patch()">Patch array rows</ion-button>
			<pre data-testid="arrays-value">{{ form.value | json }}</pre>
			<p data-testid="arrays-events">{{ events.join(' > ') }}</p>
		</ion-content>`
})
export class ArraysLookupFixturePage {
	form = new FormGroup({});
	events: string[] = [];
	private attachments = [{ ID: "file-a", Title: "Fixture document", icon: "document", friendlyFilename: "fixture.txt", Size: 8, URIs: {} }];
	initial = { Tags: ["first", "second"], Rows: [{ Code: "row-a" }, { Code: "row-b" }], Matrix: [["cell-a", "cell-b"], ["cell-c"]], Many: ["a"], One: "a", Files: this.attachments };
	private setLookup(data: any, component: any, multiple: boolean) {
		if (data === undefined) { this.events.push("lookup-cancel"); return; }
		component.setValue(multiple ? data.ids : data.ids[0]);
		component.lookupDisplayValues = data.items;
		component.control.Options.LookupOptions.ModalOptions.ComponentProps.initialIDs = [...data.ids];
		this.events.push(multiple ? "many-save" : "one-save");
	}
	private modalOptions(multiple: boolean) {
		return { Component: LookupFixtureModal, ComponentProps: { multiple, initialIDs: ["a"] }, OnDismiss: (data, component) => this.setLookup(data, component, multiple) };
	}
	config: AppFormsControlConfig[] = [
		{ Name: "Tags", Options: { Label: "Fixture tags" }, Extras: { onControlOfFormArrayAdded: () => this.events.push("tag-added") }, SubControls: { AsArray: true, Controls: [{ Name: "Tag", Options: { PlaceHolder: "Fixture tag" } }] } },
		{ Name: "Rows", Options: { Label: "Fixture rows" }, SubControls: { AsArray: true, Controls: [{ Name: "Row", SubControls: { Controls: [{ Name: "Code", Options: { PlaceHolder: "Fixture row code" } }] } }] } },
		{ Name: "Matrix", SubControls: { AsArray: true, Controls: [{ Name: "Line", SubControls: { AsArray: true, Controls: [{ Name: "Cell", Options: { PlaceHolder: "Fixture cell" } }] } }] } },
		{ Name: "Many", Type: "Lookup", Options: { LookupOptions: { AsModal: false, AsSelector: true, Multiple: true, ModalOptions: this.modalOptions(true),
			SelectorOptions: { HeaderText: "Fixture multiple lookup", OnAdd: component => { component.control.Options.LookupOptions.ModalOptions.ComponentProps.initialIDs = [...component.lookupValues]; component.lookup(); } },
			OnDelete: (ids, component) => { component.lookupValues = component.lookupValues.filter(id => !ids.includes(id)); component.lookupDisplayValues = component.lookupDisplayValues.filter(item => !ids.includes(item.Value)); this.events.push("many-delete"); }
		} }, Extras: { LookupDisplayValues: [choices[0]] } },
		{ Name: "One", Type: "Lookup", Options: { Label: "Fixture single lookup", LookupOptions: { AsModal: true, Multiple: false, ModalOptions: this.modalOptions(false) } }, Extras: { LookupDisplayValues: [choices[0]] } },
		{ Name: "Files", Type: "Custom", Options: { Type: "files-selector" }, Extras: { settings: { Label: "Fixture files", allowSelect: true, showIcons: false, handlers: { onSelect: files => this.events.push("files:" + files.map(file => file.ID).join(",")) } } } }
	];
	patch() { this.form.patchValue({ Tags: ["patched-first"], Rows: [{ Code: "patched-row" }] }); }
}
