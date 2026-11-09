import { AppUtility } from "@app/components/app.utility";

/** Based-Counter information */
export class CounterBase {

	constructor(
		type?: string,
		total?: number
	) {
		if (AppUtility.isNotEmpty(type) && total !== undefined) {
			this.Type = type;
			this.Total = total;
		}
	}

	Type = "";
	Total = 0;

	static deserialize(json: any, counter?: CounterBase) {
		return (counter || new CounterBase()).copy(json);
	}

	copy(source: any, onCompleted?: (data: any, instance: CounterBase) => void) {
		AppUtility.copy(source, this, data => {
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
		return this;
	}

}

/** Counter information */
export class CounterInfo extends CounterBase {

	constructor(
		type?: string,
		total?: number
	) {
		super(type, total);
	}

	LastUpdated = new Date();
	Month = 0;
	Week = 0;

	static deserialize(json: any, counter?: CounterInfo) {
		return (counter || new CounterInfo()).copy(json);
	}

	copy(source: any, onCompleted?: (data: any, instance: CounterInfo) => void) {
		return super.copy(source, data => {
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}
