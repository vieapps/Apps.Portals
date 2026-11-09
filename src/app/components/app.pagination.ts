import { Dictionary } from "@app/components/app.collections";
import { AppCrypto } from "@app/components/app.crypto";
import { AppUtility } from "@app/components/app.utility";
import { AppDataPagination, AppDataFilter, AppDataRequest } from "@app/components/app.objects";

/** Servicing component for working with paginations */
export class AppPagination {

	static instances = new Dictionary<string, AppDataPagination>();

	static get keys() {
		return Array.from(this.instances.keys());
	}

	private static cloneFilterBy(filterBy: AppDataFilter) {
		const filter: AppDataFilter = AppUtility.clone(
			filterBy || {},
			true,
			["IsNull", "IsNotNull", "IsEmpty", "IsNotEmpty"],
			obj => Object.getOwnPropertyNames(obj)
				.filter(name => AppUtility.isArray(obj[name], true))
				.map(name => obj[name] as Array<any>)
				.forEach(array => {
					let index = 0;
					while (index < array.length) {
						if (AppUtility.isNull(array[index])) {
							array.removeAt(index);
						}
						else {
							index++;
						}
					}
				})
		) as { [key: string]: any };
		if (filter.Query === undefined) {
			delete filter.Query;
		}
		if (filter.And === undefined && filter.Or === undefined) {
			filter["And"] = [];
		}
		return filter;
	}

	private static getKey(info?: any, prefix?: string) {
		const filterBy = info !== undefined ? this.cloneFilterBy(info.FilterBy) : undefined;
		return filterBy !== undefined && AppUtility.isNotEmpty(filterBy.Query)
			? undefined
			: (AppUtility.isNotEmpty(prefix) ? prefix + ":" : "") + AppCrypto.md5((JSON.stringify(filterBy || {}) + JSON.stringify(info !== undefined ? info.SortBy || {} : {})).toLowerCase());
	}

	/** Gets the default pagination */
	static getDefault(info?: any): AppDataPagination {
		const pagination = info !== undefined ? info.Pagination : undefined;
		return AppUtility.isObject(pagination, true)
			? {
				TotalRecords: pagination.TotalRecords !== undefined ? pagination.TotalRecords : -1,
				TotalPages: pagination.TotalPages !== undefined ? pagination.TotalPages : 0,
				PageSize: pagination.PageSize !== undefined ? pagination.PageSize : 20,
				PageNumber: pagination.PageNumber !== undefined ? pagination.PageNumber : 0
			}
			: {
				TotalRecords: -1,
				TotalPages: 0,
				PageSize: 20,
				PageNumber: 0
			};
	}

	/** Gets a pagination */
	static get(info?: any, prefix?: string): AppDataPagination {
		const key = this.getKey(info, prefix);
		const pagination = AppUtility.isNotEmpty(key) ? this.instances.get(key) : undefined;
		return pagination !== undefined
			? {
				TotalRecords: pagination.TotalRecords,
				TotalPages: pagination.TotalPages,
				PageSize: pagination.PageSize,
				PageNumber: pagination.PageNumber
			}
			: undefined;
	}

	/** Sets a pagination */
	static set(info?: any, prefix?: string) {
		const key = this.getKey(info, prefix);
		if (AppUtility.isNotEmpty(key)) {
			this.instances.set(key, this.getDefault(info));
		}
	}

	/** Removes a pagination */
	static remove(info?: any, prefix?: string) {
		const key = this.getKey(info, prefix);
		if (AppUtility.isNotEmpty(key)) {
			this.instances.remove(key);
		}
	}

	/** Computes the total of records */
	static computeTotal(pageNumber: number, pagination?: AppDataPagination) {
		let totalRecords = pageNumber * (AppUtility.isObject(pagination, true) ? pagination.PageSize : 20);
		if (AppUtility.isObject(pagination, true) && totalRecords > pagination.TotalRecords) {
			totalRecords = pagination.TotalRecords;
		}
		return totalRecords;
	}

	/** Builds the well-formed request (contains filter, sort and pagination) for working with remote APIs */
	static buildRequest(filterBy?: AppDataFilter, sortBy?: { [key: string]: any }, pagination?: AppDataPagination, onCompleted?: (request: AppDataRequest) => void) {
		const request: AppDataRequest = {
			FilterBy: this.cloneFilterBy(filterBy),
			SortBy: AppUtility.clone(sortBy || {}, true) as { [key: string]: any },
			Pagination: this.getDefault({ Pagination: pagination })
		};
		if (onCompleted !== undefined) {
			onCompleted(request);
		}
		return request;
	}

}
