import type {
	ApiQueryParams,
	ApiResponse,
	CreateJobRequest,
	CreateJobResponse,
	DeleteResponse,
	RequeueResponse,
	PauseResponse,
	ResumeResponse,
	AgendaStats
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
