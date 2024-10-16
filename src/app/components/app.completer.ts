import { Subject, Subscription } from "rxjs";
import { CompleterData, CompleterItem } from "ng2-completer";
import { AppAPIs } from "@app/components/app.apis";
import { AppUtility } from "@app/components/app.utility";

/** Custom searching service of ng-completer */
export class AppCustomCompleter extends Subject<CompleterItem[]> implements CompleterData {

	/**
	 * Initials the new instance of completer to perform the search request with APIs
	 * @param queryBuilder The function to build the approriate searching query
	 * @param convertItems The function to convert multiple items to CompleterItem objects
	 * @param convertItem The function to convert one item to CompleterItem object (NgCompleter component will use this function to prepare the initial value as selected item)
	 * @param onCancel The function to run when the searching process was cancelled
	*/
	constructor(
		private queryBuilder: (term: string) => string,
		private convertItems?: (data: any) => CompleterItem[],
		private convertItem?: (data: any) => CompleterItem,
		private onCancel?: () => void
	) {
		super();
	}

	private subscription: Subscription;

	private convert(response: Object) {
		return AppUtility.isArray(response, true)
			? (response as Array<any>).map(data => this.convertToItem(data))
			: this.convertItems !== undefined
				? this.convertItems(response)
				: AppUtility.isArray(response["Objects"], true)
					? (response["Objects"] as Array<any>).map(data => this.convertToItem(data))
					: [];
	}

	convertToItem(data: any) {
		return this.convertItem !== undefined
			? this.convertItem(data)
			: {
					title: data.toString(),
					originalObject: data
				} as CompleterItem;
	}

	search(term: string) {
		this.cancel();
		this.subscription = AppAPIs.sendXMLHttpRequest("GET", AppAPIs.getURL(this.queryBuilder(term)), { headers: AppAPIs.getHeaders() }).subscribe(
			response => this.next(this.convert(response)),
			error => console.error(`[Custom Completer]: Error occurred while fetching remote data => ${AppUtility.getErrorMessage(error)}`, error)
		);
	}

	cancel() {
		if (this.subscription !== undefined) {
			this.subscription.unsubscribe();
			this.subscription = undefined;
		}
		if (this.onCancel !== undefined) {
			this.onCancel();
		}
	}

}
