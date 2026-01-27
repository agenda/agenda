import { ref, computed } from 'vue';
import type { FrontendJob, FrontendOverview, SearchParams } from '../types';
import * as api from '../api/client';
import { useToast } from './useToast';

const jobs = ref<FrontendJob[]>([]);
const overview = ref<FrontendOverview[]>([]);
const loading = ref(false);
const showLoading = ref(false);
const totalPages = ref(0);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(50);
const currentFilters = ref<Partial<SearchParams>>({});

let loadingTimer: ReturnType<typeof setTimeout> | null = null;

export function useJobs() {
	const { success, error } = useToast();

	const sortedOverview = computed(() => {
		return [...overview.value].sort((a, b) => {
			const nameA = a.displayName.toLowerCase();
			const nameB = b.displayName.toLowerCase();
			if (nameA === 'all jobs') return -1;
			if (nameB === 'all jobs') return 1;
			return nameA.localeCompare(nameB);
		});
	});

	// Current filter display text
	const currentFilterDisplay = computed(() => {
		const parts: string[] = [];
		if (currentFilters.value.name) {
			parts.push(currentFilters.value.name);
		}
		if (currentFilters.value.state) {
			parts.push(currentFilters.value.state);
		}
		return parts.length > 0 ? parts.join(' / ') : 'All Jobs';
	});

	async function fetchJobs(params: Partial<SearchParams> = {}) {
		loading.value = true;

		// Only show loading indicator after 200ms delay
		if (loadingTimer) clearTimeout(loadingTimer);
		loadingTimer = setTimeout(() => {
			if (loading.value) {
				showLoading.value = true;
			}
		}, 200);

		// Merge with current filters
		const mergedParams = { ...currentFilters.value, ...params };
		currentFilters.value = mergedParams;

		try {
			const response = await api.getJobs({
				name: mergedParams.name,
				search: mergedParams.search,
				property: mergedParams.property,
				isObjectId: mergedParams.isObjectId ? 'true' : undefined,
				state: mergedParams.state,
				skip: mergedParams.skip,
				limit: mergedParams.limit || pageSize.value
			});

			jobs.value = response.jobs;
			overview.value = response.overview;
			totalPages.value = response.totalPages;
			total.value = response.total;
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to fetch jobs:', err);
			jobs.value = [];
			error('Failed to fetch jobs');
		} finally {
			loading.value = false;
			showLoading.value = false;
			if (loadingTimer) {
				clearTimeout(loadingTimer);
				loadingTimer = null;
			}
		}
	}

	async function requeueJobs(jobIds: string[]) {
		try {
			await api.requeueJobs(jobIds);
			success('Jobs requeued successfully');
			await fetchJobs();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to requeue jobs:', err);
			error('Failed to requeue jobs');
		}
	}

	async function deleteJobs(jobIds: string[]) {
		try {
			await api.deleteJobs(jobIds);
			success('Jobs deleted successfully');
			await fetchJobs();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to delete jobs:', err);
			error('Failed to delete jobs');
		}
	}

	async function pauseJobs(jobIds: string[]) {
		try {
			await api.pauseJobs(jobIds);
			success('Jobs paused successfully');
			await fetchJobs();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to pause jobs:', err);
			error('Failed to pause jobs');
		}
	}

	async function resumeJobs(jobIds: string[]) {
		try {
			await api.resumeJobs(jobIds);
			success('Jobs resumed successfully');
			await fetchJobs();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to resume jobs:', err);
			error('Failed to resume jobs');
		}
	}

	async function createJob(
		jobName: string,
		jobSchedule?: string,
		jobRepeatEvery?: string,
		jobData?: unknown
	) {
		try {
			await api.createJob({ jobName, jobSchedule, jobRepeatEvery, jobData });
			success('Job created successfully');
			await fetchJobs();
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('Failed to create job:', err);
			error('Failed to create job');
		}
	}

	function setPage(page: number) {
		currentPage.value = page;
		const skip = (page - 1) * pageSize.value;
		fetchJobs({ ...currentFilters.value, skip });
	}

	function nextPage() {
		if (currentPage.value < totalPages.value) {
			setPage(currentPage.value + 1);
		}
	}

	function prevPage() {
		if (currentPage.value > 1) {
			setPage(currentPage.value - 1);
		}
	}

	function setPageSize(size: number) {
		pageSize.value = size;
		currentPage.value = 1;
		fetchJobs({ ...currentFilters.value, skip: 0, limit: size });
	}

	function search(params: Partial<SearchParams>) {
		currentPage.value = 1;
		fetchJobs({ ...params, skip: 0 });
	}

	return {
		jobs,
		overview,
		sortedOverview,
		loading,
		showLoading,
		totalPages,
		total,
		currentPage,
		pageSize,
		currentFilters,
		currentFilterDisplay,
		fetchJobs,
		requeueJobs,
		deleteJobs,
		pauseJobs,
		resumeJobs,
		createJob,
		setPage,
		nextPage,
		prevPage,
		setPageSize,
		search
	};
}
