export function filterUndef<T>(ts: (T | undefined)[]): T[] {
	return ts.filter((t: T | undefined): t is T => !!t);
}
