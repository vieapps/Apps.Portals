import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";
import { AppAPIs } from "@app/components/app.apis";
import { AppUtility } from "@app/components/app.utility";

/** Presentation fields plus the original domain object, as in the previous completer. */
export interface CompleterItem {
	title: string;
	description?: string;
	image?: string;
	originalObject: any;
}

export interface CompleterData extends Observable<CompleterItem[]> {
	search(term: string): void;
	cancel(): void;
	convertToItem(data: any): CompleterItem;
	readonly loading?: Observable<boolean>;
}

/** Caller-owned datasource. Existing four-argument URL builders remain supported. */
export class AppCustomCompleter extends Subject<CompleterItem[]> implements CompleterData {
	constructor(
		private queryBuilder: ((term: string) => string) | string | any[],
		private convertItems?: (data: any) => CompleterItem[],
		private convertItem?: (data: any) => CompleterItem,
		private onCancel?: () => void
	) { super(); }

	private subscription: Subscription;
	private searchFields: string[] = [];
	private titleField: string;
	readonly loading = new BehaviorSubject(false);

	/** Search a local array without changing the identity of its domain objects. */
	static local(data: any[], searchFields: string = "title", titleField: string = "title") {
		const source = new AppCustomCompleter(data);
		source.searchFields = searchFields.split(",").map(field => field.trim());
		source.titleField = titleField;
		return source;
	}

	private convert(response: any): CompleterItem[] {
		return Array.isArray(response)
			? response.map(data => this.convertToItem(data))
			: this.convertItems !== undefined
				? this.convertItems(response)
				: (response?.Objects || []).map(data => this.convertToItem(data));
	}

	convertToItem(data: any): CompleterItem {
		return this.convertItem !== undefined ? this.convertItem(data) : {
			title: String(this.titleField ? data?.[this.titleField] ?? "" : data?.title ?? data?.Title ?? data ?? ""),
			originalObject: data
		};
	}

	search(term: string) {
		this.cancel();
		if (Array.isArray(this.queryBuilder)) {
			const normalize = (value: any) => AppUtility.toANSI(String(value ?? "")).toLowerCase();
			const query = normalize(term);
			const data = this.queryBuilder.filter(item => this.searchFields.length
				? this.searchFields.some(field => normalize(item?.[field]).includes(query))
				: normalize(this.convertToItem(item).title).includes(query));
			this.next(data.map(item => this.convertToItem(item)));
			return;
		}
		// A string URL is a prefix (or contains {{term}}); builders retain full query control.
		const path = typeof this.queryBuilder === "function" ? this.queryBuilder(term)
			: this.queryBuilder.includes("{{term}}") ? this.queryBuilder.replace(/\{\{term\}\}/g, encodeURIComponent(term))
				: this.queryBuilder + encodeURIComponent(term);
		this.loading.next(true);
		this.subscription = AppAPIs.sendXMLHttpRequest("GET", AppAPIs.getURL(path), { headers: AppAPIs.getHeaders() }).subscribe({
			next: response => this.next(this.convert(response)),
			error: error => {
				this.loading.next(false);
				this.next([]);
				console.error(`[Custom Completer]: Error occurred while fetching remote data => ${AppUtility.getErrorMessage(error)}`, error);
			},
			complete: () => this.loading.next(false)
		});
	}

	cancel() {
		this.subscription?.unsubscribe();
		this.subscription = undefined;
		this.loading.next(false);
		this.onCancel?.();
	}
}
