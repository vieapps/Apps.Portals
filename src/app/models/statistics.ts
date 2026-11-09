import { AppUtility } from "@app/components/app.utility";

/** Statistic base information */
export class StatisticBase {

	Name = "";
	Title = "";
	Counters = 0;

	static deserialize(json: any, statistic?: StatisticBase) {
		return (statistic || new StatisticBase()).copy(json);
	}

	copy(source: any, onCompleted?: (data: any, instance: StatisticBase) => void) {
		AppUtility.copy(source, this, data => {
			this.Title = AppUtility.toANSI(this.Name).toLowerCase();
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
		return this;
	}

}

/** Statistic information */
export class StatisticInfo extends StatisticBase {

	FullName = "";
	Children: Array<StatisticInfo> = [];

	static deserialize(json: any, statistic?: StatisticInfo) {
		return (statistic || new StatisticInfo()).copy(json);
	}

	copy(source: any, onCompleted?: (data: any, instance: StatisticInfo) => void) {
		return super.copy(source, data => {
			this.FullName = this.Name;
			this.Children = AppUtility.isArray(data.Children, true)
				? (data.Children as Array<any>).map(statistic => new StatisticInfo().copy(statistic, (_, instance) => {
						instance.FullName = this.Name + " > " + instance.Name;
						instance.Title = AppUtility.toANSI(instance.FullName).toLowerCase();
					}))
				: [];
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

	toJSON() {
		return JSON.stringify({
			Name: this.Name,
			Counters: this.Counters,
			Children: this.Children.map(statistic => ({
				Name: statistic.Name,
				Counters: statistic.Counters
			}))
		});
	}

}
