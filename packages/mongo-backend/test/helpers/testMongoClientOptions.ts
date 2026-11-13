import { ServerApiVersion, type MongoClientOptions } from 'mongodb';

/**
 * MongoDB client options used by all test connections.
 *
 * Enforces strict Stable API conformance, so that any command not included
 * in Stable API V1 (e.g. `distinct`) fails immediately with an
 * APIStrictError instead of slipping through unnoticed.
 */
export const testMongoClientOptions: MongoClientOptions = {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true
	}
};
