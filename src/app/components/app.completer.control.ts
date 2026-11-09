import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from "@angular/core";
import { Subject, Subscription, debounceTime } from "rxjs";
import { NgSelectComponent } from "@ng-select/ng-select";
import { CompleterData, CompleterItem } from "./app.completer";

/** UI bridge; business callbacks continue to receive the previous CompleterItem shape. */
@Component({
	selector: "app-completer", standalone: false, changeDetection: ChangeDetectionStrategy.Eager,
	template: `<ng-select #select [items]="items" bindLabel="title"
		[ngModel]="selection" [ngModelOptions]="{standalone: true}"
		[typeahead]="terms" [minTermLength]="minSearchLength" [loading]="loading"
		[loadingText]="textSearching" [notFoundText]="textNoResults" [typeToSearchText]="placeholder"
		[placeholder]="placeholder" [disabled]="disableInput" [readonly]="readonly"
		[labelForId]="inputName" [inputAttrs]="inputAttributes" [virtualScroll]="true"
		[clearable]="true" [compareWith]="compareItems" [appendTo]="overlayTarget"
		(change)="choose($event)" (close)="cancelSearch()" (focus)="focused.emit($event)" (blur)="blurred.emit($event)">
		<ng-template ng-option-tmp let-item="item">
			<img *ngIf="item.image" [src]="item.image" class="completer-image" alt="" />
			<span>{{ item.title }}<small *ngIf="item.description">{{ item.description }}</small></span>
		</ng-template>
	</ng-select>`,
	styles: [":host{display:block;width:100%;min-width:0} small{display:block;opacity:.7}.completer-image{width:32px;height:32px;object-fit:cover;margin-inline-end:8px;vertical-align:middle}"]
})
export class AppCompleterControl implements OnChanges, OnDestroy {
	constructor(private changeDetector: ChangeDetectorRef, private host: ElementRef<HTMLElement>) {}
	@Input() datasource: CompleterData;
	@Input() initialValue: any;
	@Input() inputName = "";
	@Input() placeholder = "";
	@Input() disableInput = false;
	@Input() readonly = false;
	@Input() minSearchLength = 3;
	@Input() maxChars = 150;
	@Input() pause = 123;
	@Input() clearSelected = false;
	@Input() textSearching = "Searching...";
	@Input() textNoResults = "No results";
	@Output() selected = new EventEmitter<CompleterItem | undefined>();
	@Output() focused = new EventEmitter<any>();
	@Output() blurred = new EventEmitter<any>();
	@ViewChild("select") select: NgSelectComponent;
	readonly terms = new Subject<string>();
	items: CompleterItem[] = [];
	selection: CompleterItem | null = null;
	loading = false;
	private subscriptions = new Subscription();
	private searches: Subscription;
	private activeQuery = false;

	get inputAttributes() { return { maxlength: String(this.maxChars), "aria-label": this.placeholder || this.inputName }; }
	// Keep an overlay inside an Ionic modal's focus enclosure; root pages can use body.
	get overlayTarget() {
		const modal = this.host.nativeElement.closest("ion-modal");
		return modal?.id ? `ion-modal#${CSS.escape(modal.id)}` : "body";
	}
	readonly compareItems = (a: CompleterItem, b: CompleterItem) => a === b || (a?.originalObject === b?.originalObject);

	ngOnChanges(changes: SimpleChanges) {
		if (changes["datasource"]) {
			this.subscriptions.unsubscribe();
			changes["datasource"].previousValue?.cancel();
			this.subscriptions = new Subscription();
			if (this.datasource) {
				this.subscriptions.add(this.datasource.subscribe(items => {
					if (this.activeQuery) this.items = [...items];
					this.changeDetector.markForCheck();
				}));
				if (this.datasource.loading) this.subscriptions.add(this.datasource.loading.subscribe(value => {
					this.loading = value; this.changeDetector.markForCheck();
				}));
			}
		}
		if (changes["datasource"] || changes["pause"]) {
			this.searches?.unsubscribe();
			this.searches = this.terms.pipe(debounceTime(this.pause)).subscribe(term => {
				if (this.activeQuery && term?.length >= this.minSearchLength) this.datasource?.search(term);
			});
		}
		if (changes["datasource"] || changes["initialValue"]) {
			const value = this.initialValue;
			this.selection = value == null ? null : value.originalObject !== undefined ? value : this.datasource?.convertToItem(value) ?? null;
		}
	}

	private inputSubscription = this.terms.subscribe(term => {
		this.datasource?.cancel();
		this.activeQuery = !!term && term.length >= this.minSearchLength;
		this.items = [];
	});

	choose(item?: CompleterItem) {
		this.cancelSearch();
		this.selection = item ?? null;
		this.selected.emit(item);
		if (this.clearSelected) {
			this.selection = null;
			this.select.writeValue(null);
		}
	}

	cancelSearch() { this.activeQuery = false; this.datasource?.cancel(); }
	focus() { this.select?.focus(); }
	ngOnDestroy() {
		this.searches?.unsubscribe(); this.inputSubscription.unsubscribe(); this.subscriptions.unsubscribe();
		this.datasource?.cancel(); this.terms.complete();
	}
}
