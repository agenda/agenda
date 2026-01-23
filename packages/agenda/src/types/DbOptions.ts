import type { SortDirection } from 'mongodb';

/**
 * Database configuration options used internally by backends
 */
export interface IDbConfig {
	ensureIndex?: boolean;
	sort?: {
		[key: string]: SortDirection;
	};
}
