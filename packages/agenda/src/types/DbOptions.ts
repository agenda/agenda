/**
 * Sort direction for job queries
 * Compatible with MongoDB and other backends
 */
export type SortDirection = 1 | -1 | 'asc' | 'desc' | 'ascending' | 'descending';

/**
 * Database configuration options used internally by backends
 */
export interface IDbConfig {
	ensureIndex?: boolean;
	sort?: {
		[key: string]: SortDirection;
	};
}
