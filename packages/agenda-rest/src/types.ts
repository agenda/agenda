/**
 * Configuration options for the agenda-rest server
 */
export interface IAgendaRestConfig {
	/** Agenda instance to use */
	agenda?: import('agenda').Agenda;
	/** MongoDB connection URI */
	mongoUri?: string;
	/** MongoDB database name */
	dbName?: string;
	/** MongoDB collection for jobs */
	collection?: string;
	/** API key for authentication (X-API-Key header) */
	apiKey?: string;
	/** Request timeout in milliseconds */
	timeout?: number;
	/** Port to listen on (for CLI) */
	port?: number;
}

/**
 * Job definition request body
 */
export interface IJobDefinitionRequest {
	name: string;
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	callback?: {
		url: string;
		method?: string;
		headers?: Record<string, string>;
	};
}

/**
 * Schedule job request body
 */
export interface IScheduleJobRequest {
	name: string;
	data?: unknown;
	interval?: string;
	when?: string | Date;
}

/**
 * Cancel job request body
 */
export interface ICancelJobRequest {
	name?: string;
	data?: unknown;
}

/**
 * API response types
 */
export interface IApiSuccessResponse {
	success: boolean;
	message?: string;
}

export interface IApiErrorResponse {
	error: string;
}

export interface IJobListResponse {
	jobs: Array<{
		name: string;
		url?: string;
		method?: string;
	}>;
}
