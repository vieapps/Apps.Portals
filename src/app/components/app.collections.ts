import { List } from "linqts";

declare global {
	interface Array<T> {

		/** Inserts an element at a specified index/position */
		insert(value: T, index?: number): T[];

		/** Updates an element at a specified index/position (replaces or inserts) */
		update(value: T, index?: number): T[];

		/** Merges other values */
		merge(values?: T[]): T[];

		/** Clears (Removes) a range of elements */
		clear(start?: number, amount?: number): T[];

		/** Removes an element */
		remove(value: T, findIndex?: (value: T, array: T[]) => number): T[];

		/** Removes an element at a specified index/position */
		removeAt(index: number): T[];

		/** Removes all elements */
		removeAll(): T[];

		/** Moves an element from a old index/position to a new index/position */
		move(from: number, to: number): T[];

		/** Produces the specified number of contiguous elements */
		take(amount: number, skip?: number): T[];

		/** Produces the distinct elements of the collection by using the equality comparer to compare values */
		distinct(comparer?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): T[];

		/** Produces the set difference of two collections by using the equality comparer to compare values */
		except(other: T[], comparer?: (value: T, array: T[]) => boolean, thisArg?: any): T[];

		/** Produces the set intersection of two collections by using the equality comparer to compare values */
		intersect(other: T[], comparer?: (value: T, array: T[]) => boolean, thisArg?: any): T[];

		/** Gets the comparing function for sorting the elements */
		compareFn(sorts: Array<{ name: string, reverse?: boolean, transformer?: (value: any) => any }>): (a: T, b: T) => number;

		/** Produces the sorted elements by the specified conditions */
		orderBy(sorts: Array<{ name: string, reverse?: boolean, transformer?: (value: any) => any }>): T[];

		/** Produces the sorted elements by the specified conditions */
		sortBy(...sorts: Array<string | { name: string, reverse?: boolean, transformer?: (value: any) => any }>): T[];

		/** Gets the first element that matched with the predicate */
		first(predicate?: (value: T, index: number, array: T[]) => boolean): T;

		/** Gets the first or default element that matched with the predicate */
		firstOrDefault(predicate?: (value: T, index: number, array: T[]) => boolean): T;

		/** Gets the last element that matched with the predicate */
		last(predicate?: (value: T, index: number, array: T[]) => boolean): T;

		/** Gets the last or default element that matched with the predicate */
		lastOrDefault(predicate?: (value: T, index: number, array: T[]) => boolean): T;

		/** Gets the previous element of the last element that matched with the predicate */
		previousLast(predicate?: (value: T, index: number, array: T[]) => boolean): T;

		/** Converts to List object (for working with LINQ) */
		toList(predicate?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): List<T>;

		/** Converts to HashSet object */
		toHashSet(predicate?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): HashSet<T>;

		/** Converts to Dictionary object */
		toDictionary<K>(keySelector: (value: T) => K, predicate?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): Dictionary<K, T>;
	}

}

if (!Array.prototype.insert) {
	Array.prototype.insert = function<T>(this: T[], value: T, index?: number): T[] {
		if (index !== undefined && index > -1 && index < this.length) {
			this.splice(index, 0, value);
		}
		else {
			this.push(value);
		}
		return this;
	};
}

if (!Array.prototype.update) {
	Array.prototype.update = function<T>(this: T[], value: T, index?: number): T[] {
		if (index !== undefined && index > -1 && index < this.length) {
			this[index] = value;
		}
		else {
			this.push(value);
		}
		return this;
	};
}

if (!Array.prototype.merge) {
	Array.prototype.merge = function<T>(this: T[], values?: T[]): T[] {
		if (values !== undefined) {
			values.forEach(value => this.push(value));
		}
		return this;
	};
}

if (!Array.prototype.clear) {
	Array.prototype.clear = function<T>(this: T[], start?: number, amount?: number): T[] {
		this.splice(start !== undefined && start > 0 ? start : 0, amount !== undefined && amount > 0 ? amount : this.length);
		return this;
	};
}

if (!Array.prototype.remove) {
	Array.prototype.remove = function<T>(this: T[], value: T, findIndex?: (value: T, array: T[]) => number): T[] {
		return this.removeAt(findIndex !== undefined ? findIndex(value, this) : this.indexOf(value));
	};
}

if (!Array.prototype.removeAt) {
	Array.prototype.removeAt = function<T>(this: T[], index: number): T[] {
		if (index !== undefined && index > -1 && index < this.length) {
			this.splice(index, 1);
		}
		return this;
	};
}

if (!Array.prototype.removeAll) {
	Array.prototype.removeAll = function<T>(this: T[]): T[] {
		return this.clear();
	};
}

if (!Array.prototype.move) {
	Array.prototype.move = function<T>(this: T[], from: number, to: number): T[] {
		if (from !== undefined && to !== undefined && from !== to && from > -1 && from < this.length && to > -1 && to < this.length) {
			const values = this.splice(from, 1);
			if (values !== undefined && values.length > 0) {
				this.insert(values[0], to);
			}
		}
		return this;
	};
}

if (!Array.prototype.take) {
	Array.prototype.take = function<T>(this: T[], amount: number, skip?: number): T[] {
		const values = skip !== undefined && skip > 0 && skip < this.length
			? this.slice(skip)
			: this;
		return amount !== undefined && amount > 0 && amount < values.length
			? values.slice(0, amount)
			: values;
	};
}

if (!Array.prototype.distinct) {
	Array.prototype.distinct = function<T>(this: T[], comparer?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): T[] {
		return comparer !== undefined
			? this.filter((value, index, array) => comparer(value, index, array), thisArg)
			: this.filter((value, index, array) => array.indexOf(value) === index, thisArg);
	};
}

if (!Array.prototype.except) {
	Array.prototype.except = function<T>(this: T[], other: T[], comparer?: (value: T, array: T[]) => boolean, thisArg?: any): T[] {
		return comparer !== undefined
			? this.filter(value => comparer(value, other), thisArg)
			: this.filter(value => other.indexOf(value) < 0, thisArg);
	};
}

if (!Array.prototype.intersect) {
	Array.prototype.intersect = function<T>(this: T[], other: T[], comparer?: (value: T, array: T[]) => boolean, thisArg?: any): T[] {
		return comparer !== undefined
			? this.filter(value => comparer(value, other), thisArg)
			: this.filter(value => other.indexOf(value) > -1, thisArg);
	};
}

if (!Array.prototype.compareFn) {
	Array.prototype.compareFn = function<T>(this: T[], sorts: Array<{ name: string, reverse?: boolean, transformer?: (value: any) => any }>): (a: T, b: T) => number {
		const compareFn = (a: any, b: any): number => a === b ? 0 : a < b ? -1 : 1;
		const sortBy = sorts.map(sort => ({
			name: sort.name,
			compare: (a: any, b: any) => (sort.reverse ? -1 : 1) * (sort.transformer !== undefined ? compareFn(sort.transformer(a), sort.transformer(b)) : compareFn(a, b))
		}));
		return (a: T, b: T) => {
			let result = 0;
			for (let index = 0; index < sortBy.length; index++) {
				const name = sortBy[index].name;
				result = sortBy[index].compare(a[name], b[name]);
				if (result !== 0) {
					break;
				}
			}
			return result;
		};
	};
}

if (!Array.prototype.orderBy) {
	Array.prototype.orderBy = function<T>(this: T[], sorts: Array<{ name: string, reverse?: boolean, transformer?: (value: any) => any }>): T[] {
		return this.sort(sorts !== undefined && sorts.length > 0 ? this.compareFn(sorts) : undefined);
	};
}

if (!Array.prototype.sortBy) {
	Array.prototype.sortBy = function<T>(this: T[], ...sorts: Array<string | { name: string, reverse?: boolean, transformer?: (value: any) => any }>): T[] {
		return this.orderBy(sorts !== undefined && sorts.length > 0
			? (sorts as Array<any>).filter(sort => sort !== undefined && sort !== null).map(sort => typeof sort === "string"
					? ({
							name: sort as string,
							reverse: false,
							transformer: undefined as (value: any) => any
						})
					: ({
							name: sort.name as string,
							reverse: true === sort.reverse,
							transformer: sort.transformer as (value: any) => any
						})
				)
			: undefined
		);
	};
}

if (!Array.prototype.first) {
	Array.prototype.first = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean): T {
		for (let index = 0; index < this.length; index++) {
			const value = this[index];
			if (predicate === undefined || predicate(value, index, this)) {
				return value;
			}
		}
		return undefined;
	};
}

if (!Array.prototype.firstOrDefault) {
	Array.prototype.firstOrDefault = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean): T {
		return this.first(predicate) || this.first();
	};
}

if (!Array.prototype.last) {
	Array.prototype.last = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean): T {
		const array = predicate !== undefined ? this.filter(predicate) : this;
		return array.length > 0 ? array[array.length - 1] : undefined;
	};
}

if (!Array.prototype.lastOrDefault) {
	Array.prototype.lastOrDefault = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean): T {
		return this.last(predicate) || this.last();
	};
}

if (!Array.prototype.previousLast) {
	Array.prototype.previousLast = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean): T {
		const array = predicate !== undefined ? this.filter(predicate) : this;
		return array.length > 1 ? array[array.length - 2] : undefined;
	};
}

if (!Array.prototype.toList) {
	Array.prototype.toList = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): List<T> {
		return new List<T>(predicate !== undefined ? this.filter(predicate, thisArg) : this);
	};
}

if (!Array.prototype.toHashSet) {
	Array.prototype.toHashSet = function<T>(this: T[], predicate?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): HashSet<T> {
		return new HashSet<T>(predicate !== undefined ? this.filter(predicate, thisArg) : this);
	};
}

if (!Array.prototype.toDictionary) {
	Array.prototype.toDictionary = function<K, T>(this: T[], keySelector: (value: T) => K, predicate?: (value: T, index: number, array: T[]) => boolean, thisArg?: any): Dictionary<K, T> {
		return new Dictionary<K, T>(predicate !== undefined ? this.filter(predicate, thisArg) : this, keySelector);
	};
}

/** HashSet */
export class HashSet<T> extends Set<T>  {

	/** Creates new instance of HashSet */
	constructor(values?: IterableIterator<T> | Array<T>) {
		super(values);
	}

	/** Adds a value into this collection */
	set(value: T) {
		this.add(value);
		return value;
	}

	/** Updates the values into this collection */
	update(values: IterableIterator<T> | Array<T>, add: boolean = true, clearBeforeUpdating: boolean = false) {
		if (clearBeforeUpdating) {
			this.clear();
		}
		if (values !== undefined) {
			for (const value of values) {
				if (!add) {
					this.delete(value);
				}
				else {
					this.add(value);
				}
			}
		}
		return this;
	}

	/** Removes a value from this collection */
	remove(value: T) {
		return this.delete(value);
	}

	/** Determines this collection has the value or not */
	contains(value: T) {
		return this.has(value);
	}

	/** Returns the first value that matched with the predicate */
	first(predicate?: (value: T) => boolean) {
		if (this.size > 0) {
			const values = this.values();
			for (const value of values) {
				if (predicate === undefined || predicate(value)) {
					return value;
				}
			}
		}
		return undefined;
	}

	/** Returns the first or default value that matched with the predicate */
	firstOrDefault(predicate?: (value: T) => boolean) {
		return this.first(predicate) || this.first();
	}

	/** Returns the first value that matched with the predicate */
	find(predicate?: (value: T) => boolean) {
		return this.first(predicate);
	}

	/** Produces the sub-set of this collection by using the predicate */
	filter(predicate: (value: T) => boolean) {
		if (predicate !== undefined) {
			const set = new HashSet<T>();
			this.forEach(value => {
				if (predicate(value)) {
					set.add(value);
				}
			});
			return set;
		}
		return this;
	}

	/** Concatenates this collection with other collection */
	concat(other: Set<T>) {
		if (other !== undefined) {
			other.forEach(value => this.add(value));
		}
		return this;
	}

	/** Produces the set difference of two collections by using the equality comparer to compare values */
	except(other: Set<T>) {
		return other !== undefined ? this.filter(value => !other.has(value)) : this;
	}

	/** Produces the set intersection of two collections by using the equality comparer to compare values */
	intersect(other: Set<T>) {
		return other !== undefined ? this.filter(value => other.has(value)) : new HashSet<T>();
	}

	/** Converts the values of this collection to array */
	toArray(predicate?: (value: T) => boolean) {
		if (this.size > 0 && predicate !== undefined) {
			const array = new Array<T>();
			this.forEach(value => {
				if (predicate(value)) {
					array.push(value);
				}
			});
			return array;
		}
		return Array.from(this.values());
	}

	/** Converts the values of this collection to List object (for working with LINQ) */
	toList(predicate?: (value: T) => boolean) {
		return this.toArray(predicate).toList();
	}
}

/** Dictionary */
export class Dictionary<TKey, TValue> extends Map<TKey, TValue> {

	/** Creates new instance of Dictionary */
	constructor(values?: IterableIterator<TValue> | Array<TValue>, keySelector?: (value: TValue) => TKey) {
		super();
		if (values !== undefined && keySelector !== undefined) {
			for (const value of values) {
				this.update(keySelector(value), value);
			}
		}
	}

	/** Adds the key-value pair into this collection */
	add(key: TKey, value: TValue) {
		this.set(key, value);
		return value;
	}

	/** Updates the key-value pair into this collection */
	update(key: TKey, value: TValue, updater: (v: TValue, k: TKey) => TValue = (v, k) => v) {
		if (this.has(key)) {
			this.set(key, updater(this.get(key), key));
		}
		else {
			this.set(key, value);
		}
		return this;
	}

	/** Removes a value that specified by a key from this collection */
	remove(key: TKey) {
		return this.delete(key);
	}

	/** Determines this collection has the key or not */
	contains(key: TKey) {
		return this.has(key);
	}

	/** Returns the first value that matched with the predicate */
	first(predicate?: (value: TValue) => boolean) {
		if (this.size > 0) {
			const values = this.values();
			for (const value of values) {
				if (predicate === undefined || predicate(value)) {
					return value;
				}
			}
		}
		return undefined;
	}

	/** Returns the first or default value that matched with the predicate */
	firstOrDefault(predicate?: (value: TValue) => boolean) {
		return this.first(predicate) || this.first();
	}

	/** Returns the first value that matched with the predicate */
	find(predicate?: (value: TValue) => boolean) {
		return this.first(predicate);
	}

	/** Produces the sub-set of this collection by using the predicate */
	filter(predicate: (value: TValue, key: TKey) => boolean) {
		if (predicate !== undefined) {
			const dictionary = new Dictionary<TKey, TValue>();
			this.forEach((value, key) => {
				if (predicate(value, key)) {
					dictionary.set(key, value);
				}
			});
			return dictionary;
		}
		return this;
	}

	/** Concatenates this collection with other collection */
	concat(other: Map<TKey, TValue>, resolve: (k: TKey, a: TValue, b: TValue) => TValue = (k, a, b) => b) {
		other.forEach((value, key) => {
			if (this.has(key)) {
				this.set(key, resolve(key, this.get(key), value));
			}
			else {
				this.set(key, value);
			}
		});
		return this;
	}

	/** Produces the set difference of two collections by using the equality comparer to compare values */
	except(other: Map<TKey, TValue>) {
		return other !== undefined ? this.filter((_, key) => !other.has(key)) : this;
	}

	/** Produces the set intersection of two collections by using the equality comparer to compare values */
	intersect(other: Map<TKey, TValue>) {
		return other !== undefined ? this.filter((_, key) => other.has(key)) : new Dictionary<TKey, TValue>();
	}

	/** Converts the values of this collection to array */
	toArray(predicate?: (value: TValue) => boolean) {
		if (this.size > 0 && predicate !== undefined) {
			const array = new Array<TValue>();
			this.forEach((value, _) => {
				if (predicate(value)) {
					array.push(value);
				}
			});
			return array;
		}
		return Array.from(this.values());
	}

	/** Converts the values of this collection to List object (for working with LINQ) */
	toList(predicate?: (value: TValue) => boolean) {
		return this.toArray(predicate).toList();
	}
}
