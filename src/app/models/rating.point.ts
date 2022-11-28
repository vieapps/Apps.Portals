import { AppUtility } from "@app/components/app.utility";

/** Rating information */
export class RatingPoint {

	Type = "";
	Total = 0;
	Points = 0.0;

	static deserialize(json: any, ratingPoint?: RatingPoint) {
		return (ratingPoint || new RatingPoint()).copy(json);
	}

	get Average() {
		return this.Total > 0 ? this.Points / this.Total : 0;
	}

	copy(source: any, onCompleted?: (data: any, instance: RatingPoint) => void) {
		AppUtility.copy(source, this, data => {
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
		return this;
	}

}
