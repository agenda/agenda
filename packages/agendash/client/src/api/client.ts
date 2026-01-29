import type {
	ApiQueryParams,
	ApiResponse,
	CreateJobRequest,
	CreateJobResponse,
	DeleteResponse,
	RequeueResponse,
	PauseResponse,
	ResumeResponse,
	AgendaStats,
	JobStateNotification,
	LogsQueryParams,
	LogsResponse
} from '../types';

const BASE_URL = 'api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		headers: {
			'Content-Type': 'application/json',
			...options?.headers
		},
		...options
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export async function getJobs(params: ApiQueryParams = {}): Promise<ApiResponse> {
	const searchParams = new URLSearchParams();

	if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
	if (params.name) searchParams.set('job', params.name);
	if (params.skip !== undefined) searchParams.set('skip', String(params.skip));
	if (params.property) searchParams.set('property', params.property);
	if (params.isObjectId === 'true') searchParams.set('isObjectId', 'true');
	if (params.state) searchParams.set('state', params.state);
	if (params.search) searchParams.set('q', params.search);

	const url = `${BASE_URL}?${searchParams.toString()}`;
	return fetchJson<ApiResponse>(url);
}

export async function requeueJobs(jobIds: string[]): Promise<RequeueResponse> {
	return fetchJson<RequeueResponse>(`${BASE_URL}/jobs/requeue`, {
		method: 'POST',
		body: JSON.stringify({ jobIds })
	});
}

export async function deleteJobs(jobIds: string[]): Promise<DeleteResponse> {
	return fetchJson<DeleteResponse>(`${BASE_URL}/jobs/delete`, {
		method: 'POST',
		body: JSON.stringify({ jobIds })
	});
}

export async function createJob(options: CreateJobRequest): Promise<CreateJobResponse> {
	return fetchJson<CreateJobResponse>(`${BASE_URL}/jobs/create`, {
		method: 'POST',
		body: JSON.stringify(options)
	});
}

export async function pauseJobs(jobIds: string[]): Promise<PauseResponse> {
	return fetchJson<PauseResponse>(`${BASE_URL}/jobs/pause`, {
		method: 'POST',
		body: JSON.stringify({ jobIds })
	});
}

export async function resumeJobs(jobIds: string[]): Promise<ResumeResponse> {
	return fetchJson<ResumeResponse>(`${BASE_URL}/jobs/resume`, {
		method: 'POST',
		body: JSON.stringify({ jobIds })
	});
}

export async function getStats(fullDetails = false): Promise<AgendaStats> {
	const url = fullDetails ? `${BASE_URL}/stats?fullDetails=true` : `${BASE_URL}/stats`;
	return fetchJson<AgendaStats>(url);
}

export async function getLogs(params: LogsQueryParams = {}): Promise<LogsResponse> {
	const searchParams = new URLSearchParams();

	if (params.jobId) searchParams.set('jobId', params.jobId);
	if (params.jobName) searchParams.set('jobName', params.jobName);
	if (params.level) searchParams.set('level', params.level);
	if (params.event) searchParams.set('event', params.event);
	if (params.from) searchParams.set('from', params.from);
	if (params.to) searchParams.set('to', params.to);
	if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
	if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
	if (params.sort) searchParams.set('sort', params.sort);

	const url = `${BASE_URL}/logs?${searchParams.toString()}`;
	return fetchJson<LogsResponse>(url);
}

/**
 * Subscribe to real-time job state notifications via Server-Sent Events.
 *
 * @param onEvent - Callback function called for each state notification
 * @param onError - Optional callback for error handling
 * @param onConnect - Optional callback when connection is established
 * @returns Unsubscribe function to close the connection
 */
export function subscribeToEvents(
	onEvent: (notification: JobStateNotification) => void,
	onError?: (error: Event) => void,
	onConnect?: () => void
): () => void {
	const eventSource = new EventSource(`${BASE_URL}/events`);

	eventSource.onmessage = (event) => {
		try {
			const notification = JSON.parse(event.data) as JobStateNotification;
			onEvent(notification);
		} catch {
			// Ignore parse errors (e.g., heartbeat messages)
		}
	};

	eventSource.addEventListener('connected', () => {
		onConnect?.();
	});

	eventSource.onerror = (error) => {
		onError?.(error);
	};

	return () => {
		eventSource.close();
	};
}
