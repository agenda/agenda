<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Sidebar from './components/Sidebar.vue';
import Topbar from './components/Topbar.vue';
import JobList from './components/JobList.vue';
import JobDetail from './components/JobDetail.vue';
import NewJob from './components/NewJob.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import Toast from './components/Toast.vue';
import StatsPanel from './components/StatsPanel.vue';
import { useJobs } from './composables/useJobs';
import type { FrontendJob, SearchParams } from './types';

const {
	jobs,
	sortedOverview,
	loading,
	showLoading,
	totalPages,
	currentPage,
	pageSize,
	currentFilters,
	currentFilterDisplay,
	realTimeConnected,
	fetchJobs,
	requeueJobs,
	deleteJobs,
	pauseJobs,
	resumeJobs,
	createJob,
	nextPage,
	prevPage,
	search,
	startRealTimeUpdates,
	stopRealTimeUpdates
} = useJobs();

// Mobile sidebar state
const mobileMenuOpen = ref(false);

// Auto-refresh
const refreshInterval = ref(30);
const secondsUntilRefresh = ref(30);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// Modal states
const showJobDetail = ref(false);
const showNewJob = ref(false);
const showConfirmDelete = ref(false);
const showConfirmRequeue = ref(false);
const showConfirmPause = ref(false);
const showConfirmResume = ref(false);
const showConfirmDeleteMulti = ref(false);
const showConfirmRequeueMulti = ref(false);
const showConfirmPauseMulti = ref(false);
const showConfirmResumeMulti = ref(false);

// Selected job/jobs for modals
const selectedJob = ref<FrontendJob | null>(null);
const selectedJobIds = ref<string[]>([]);

// Loading state for modal actions
const actionLoading = ref(false);

// View mode - jobs or stats
const showingStats = ref(false);

// Helper to format job data for display (full JSON, pretty-printed)
function formatJobData(data: unknown): string {
	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

function startRefreshTimer() {
	if (refreshTimer) clearInterval(refreshTimer);
	secondsUntilRefresh.value = refreshInterval.value;

	refreshTimer = setInterval(() => {
		secondsUntilRefresh.value--;
		if (secondsUntilRefresh.value <= 0) {
			fetchJobs();
			secondsUntilRefresh.value = refreshInterval.value;
		}
	}, 1000);
}

function manualRefresh() {
	fetchJobs();
	secondsUntilRefresh.value = refreshInterval.value;
}

function openNav() {
	mobileMenuOpen.value = true;
}

function closeNav() {
	mobileMenuOpen.value = false;
}

function handleShowJobDetail(job: FrontendJob) {
	selectedJob.value = job;
	showJobDetail.value = true;
}

function handleConfirmDelete(job: FrontendJob) {
	selectedJob.value = job;
	showConfirmDelete.value = true;
}

function handleConfirmRequeue(job: FrontendJob) {
	selectedJob.value = job;
	showConfirmRequeue.value = true;
}

function handleConfirmDeleteMulti(jobIds: string[]) {
	selectedJobIds.value = jobIds;
	showConfirmDeleteMulti.value = true;
}

function handleConfirmRequeueMulti(jobIds: string[]) {
	selectedJobIds.value = jobIds;
	showConfirmRequeueMulti.value = true;
}

function handleConfirmPause(job: FrontendJob) {
	selectedJob.value = job;
	showConfirmPause.value = true;
}

function handleConfirmResume(job: FrontendJob) {
	selectedJob.value = job;
	showConfirmResume.value = true;
}

function handleConfirmPauseMulti(jobIds: string[]) {
	selectedJobIds.value = jobIds;
	showConfirmPauseMulti.value = true;
}

function handleConfirmResumeMulti(jobIds: string[]) {
	selectedJobIds.value = jobIds;
	showConfirmResumeMulti.value = true;
}

async function handleDelete() {
	if (selectedJob.value) {
		actionLoading.value = true;
		try {
			await deleteJobs([selectedJob.value.job._id]);
		} finally {
			actionLoading.value = false;
		}
	}
	showConfirmDelete.value = false;
}

async function handleRequeue() {
	if (selectedJob.value) {
		actionLoading.value = true;
		try {
			await requeueJobs([selectedJob.value.job._id]);
		} finally {
			actionLoading.value = false;
		}
	}
	showConfirmRequeue.value = false;
}

async function handleDeleteMulti() {
	actionLoading.value = true;
	try {
		await deleteJobs(selectedJobIds.value);
	} finally {
		actionLoading.value = false;
	}
	showConfirmDeleteMulti.value = false;
	selectedJobIds.value = [];
}

async function handleRequeueMulti() {
	actionLoading.value = true;
	try {
		await requeueJobs(selectedJobIds.value);
	} finally {
		actionLoading.value = false;
	}
	showConfirmRequeueMulti.value = false;
	selectedJobIds.value = [];
}

async function handlePause() {
	if (selectedJob.value) {
		actionLoading.value = true;
		try {
			await pauseJobs([selectedJob.value.job._id]);
		} finally {
			actionLoading.value = false;
		}
	}
	showConfirmPause.value = false;
}

async function handleResume() {
	if (selectedJob.value) {
		actionLoading.value = true;
		try {
			await resumeJobs([selectedJob.value.job._id]);
		} finally {
			actionLoading.value = false;
		}
	}
	showConfirmResume.value = false;
}

async function handlePauseMulti() {
	actionLoading.value = true;
	try {
		await pauseJobs(selectedJobIds.value);
	} finally {
		actionLoading.value = false;
	}
	showConfirmPauseMulti.value = false;
	selectedJobIds.value = [];
}

async function handleResumeMulti() {
	actionLoading.value = true;
	try {
		await resumeJobs(selectedJobIds.value);
	} finally {
		actionLoading.value = false;
	}
	showConfirmResumeMulti.value = false;
	selectedJobIds.value = [];
}

function handleSearch(params: Partial<SearchParams>) {
	search(params);
	closeNav();
	secondsUntilRefresh.value = refreshInterval.value;
}

function handleSidebarSearch(name: string, state: string) {
	showingStats.value = false;
	search({ name: name === 'All Jobs' ? '' : name, state, skip: 0 });
	closeNav();
	secondsUntilRefresh.value = refreshInterval.value;
}

function handleShowStats() {
	showingStats.value = true;
	// Clear job filters so no job entry shows as selected
	currentFilters.value = {};
	closeNav();
}

async function handleCreateJob(
	jobName: string,
	jobSchedule: string,
	jobRepeatEvery: string,
	jobData: unknown
) {
	await createJob(jobName, jobSchedule || undefined, jobRepeatEvery || undefined, jobData);
	showNewJob.value = false;
}

onMounted(() => {
	fetchJobs();
	startRefreshTimer();
	// Try to start real-time updates (will gracefully fail if not supported)
	startRealTimeUpdates();
});

onUnmounted(() => {
	if (refreshTimer) clearInterval(refreshTimer);
	stopRealTimeUpdates();
});
</script>

<template>
	<div class="app-wrapper">
		<!-- Navbar -->
		<nav class="navbar navbar-custom navbar-dark sticky-top px-3 py-2">
			<span class="navbar-brand mb-0">Agendash</span>
			<div class="d-flex align-items-center gap-3">
				<!-- Real-time indicator -->
				<div v-if="realTimeConnected" class="d-none d-md-flex align-items-center gap-1 text-success" title="Real-time updates active">
					<span class="realtime-dot"></span>
					<small>Live</small>
				</div>
				<!-- Refresh indicator -->
				<div class="d-none d-md-flex align-items-center gap-2 text-white-50">
					<button
						class="btn btn-sm btn-outline-light"
						:disabled="loading"
						title="Refresh now"
						@click="manualRefresh"
					>
						<span v-if="loading" class="spinner-border spinner-border-sm"></span>
						<span v-else>&#x21BB;</span>
					</button>
					<small>{{ secondsUntilRefresh }}s</small>
				</div>
				<!-- Mobile menu button -->
				<button class="mobile-menu-btn d-md-none" @click="openNav">&#9776;</button>
			</div>
		</nav>

		<!-- Mobile Sidebar -->
		<div :class="['sidebar-mobile', { open: mobileMenuOpen }]">
			<button class="sidebar-mobile-close" @click="closeNav">&times;</button>
			<Sidebar
				v-if="mobileMenuOpen"
				:overview="sortedOverview"
				:page-size="pageSize"
				:loading="loading"
				:current-filters="currentFilters"
				:showing-stats="showingStats"
				@search="handleSidebarSearch"
				@new-job="showNewJob = true"
				@show-stats="handleShowStats"
			/>
		</div>

		<!-- Main Layout -->
		<div class="d-flex flex-grow-1" style="min-height: 0">
			<!-- Desktop Sidebar -->
			<aside class="sidebar d-none d-md-block">
				<Sidebar
					:overview="sortedOverview"
					:page-size="pageSize"
					:loading="loading"
					:current-filters="currentFilters"
					:showing-stats="showingStats"
					@search="handleSidebarSearch"
					@new-job="showNewJob = true"
					@show-stats="handleShowStats"
				/>
			</aside>

			<!-- Main Content -->
			<main class="flex-grow-1 p-4">
				<!-- Mobile refresh button -->
				<div class="d-md-none d-flex justify-content-end mb-3">
					<button
						class="btn btn-sm btn-outline-secondary"
						:disabled="loading"
						@click="manualRefresh"
					>
						<span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
						<span v-else class="me-1">&#x21BB;</span>
						Refresh ({{ secondsUntilRefresh }}s)
					</button>
				</div>

				<!-- Stats View -->
				<div v-if="showingStats">
					<h4 class="mb-4">Agenda Status</h4>
					<StatsPanel />
				</div>

				<!-- Jobs View -->
				<div v-else>
					<!-- Current filter display -->
					<div class="current-filter-display mb-3">
						<span class="text-muted">Showing:</span>
						<span class="filter-badge">{{ currentFilters.name || 'All Jobs' }}</span>
						<span v-if="currentFilters.state" class="filter-state-badge" :class="`state-${currentFilters.state}`">
							{{ currentFilters.state }}
						</span>
					</div>

					<Topbar :current-filters="currentFilters" @search="handleSearch" />

					<JobList
						:jobs="jobs"
						:page-size="pageSize"
						:page-number="currentPage"
						:total-pages="totalPages"
						:loading="showLoading"
						:filter-display="currentFilterDisplay"
						@show-job-detail="handleShowJobDetail"
						@confirm-delete="handleConfirmDelete"
						@confirm-requeue="handleConfirmRequeue"
						@confirm-pause="handleConfirmPause"
						@confirm-resume="handleConfirmResume"
						@confirm-delete-multi="handleConfirmDeleteMulti"
						@confirm-requeue-multi="handleConfirmRequeueMulti"
						@confirm-pause-multi="handleConfirmPauseMulti"
						@confirm-resume-multi="handleConfirmResumeMulti"
						@page-next="nextPage"
						@page-prev="prevPage"
					/>
				</div>
			</main>
		</div>

		<!-- Modals -->
		<Teleport to="body">
			<div v-if="showJobDetail && selectedJob" class="modal-overlay" @click.self="showJobDetail = false">
				<div class="modal-container" style="width: 600px">
					<JobDetail :job="selectedJob" @close="showJobDetail = false" />
				</div>
			</div>

			<div v-if="showNewJob" class="modal-overlay" @click.self="showNewJob = false">
				<div class="modal-container" style="width: 500px">
					<NewJob @close="showNewJob = false" @create="handleCreateJob" />
				</div>
			</div>

			<div v-if="showConfirmDelete && selectedJob" class="modal-overlay" @click.self="!actionLoading && (showConfirmDelete = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Delete Job"
						:message="`Delete job '${selectedJob.job.name}'?`"
						:details="[
							{ label: 'ID', value: selectedJob.job._id, type: 'code' },
							{ label: 'Name', value: selectedJob.job.name },
							{ label: 'Data', value: formatJobData(selectedJob.job.data), type: 'json' }
						]"
						confirm-text="Delete"
						confirm-class="btn-danger"
						:loading="actionLoading"
						@confirm="handleDelete"
						@cancel="showConfirmDelete = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmRequeue && selectedJob" class="modal-overlay" @click.self="!actionLoading && (showConfirmRequeue = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Requeue Job"
						:message="`Requeue job '${selectedJob.job.name}'?`"
						:details="[
							{ label: 'ID', value: selectedJob.job._id, type: 'code' },
							{ label: 'Name', value: selectedJob.job.name },
							{ label: 'Data', value: formatJobData(selectedJob.job.data), type: 'json' }
						]"
						confirm-text="Requeue"
						confirm-class="btn-primary"
						:loading="actionLoading"
						@confirm="handleRequeue"
						@cancel="showConfirmRequeue = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmDeleteMulti" class="modal-overlay" @click.self="!actionLoading && (showConfirmDeleteMulti = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Delete Multiple Jobs"
						:message="`Delete ${selectedJobIds.length} selected jobs?`"
						confirm-text="Delete All"
						confirm-class="btn-danger"
						:loading="actionLoading"
						@confirm="handleDeleteMulti"
						@cancel="showConfirmDeleteMulti = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmRequeueMulti" class="modal-overlay" @click.self="!actionLoading && (showConfirmRequeueMulti = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Requeue Multiple Jobs"
						:message="`Requeue ${selectedJobIds.length} selected jobs?`"
						confirm-text="Requeue All"
						confirm-class="btn-primary"
						:loading="actionLoading"
						@confirm="handleRequeueMulti"
						@cancel="showConfirmRequeueMulti = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmPause && selectedJob" class="modal-overlay" @click.self="!actionLoading && (showConfirmPause = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Pause Job"
						:message="`Pause job '${selectedJob.job.name}'?`"
						:details="[
							{ label: 'ID', value: selectedJob.job._id, type: 'code' },
							{ label: 'Name', value: selectedJob.job.name },
							{ label: 'Data', value: formatJobData(selectedJob.job.data), type: 'json' }
						]"
						confirm-text="Pause"
						confirm-class="btn-secondary"
						:loading="actionLoading"
						@confirm="handlePause"
						@cancel="showConfirmPause = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmResume && selectedJob" class="modal-overlay" @click.self="!actionLoading && (showConfirmResume = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Resume Job"
						:message="`Resume job '${selectedJob.job.name}'?`"
						:details="[
							{ label: 'ID', value: selectedJob.job._id, type: 'code' },
							{ label: 'Name', value: selectedJob.job.name },
							{ label: 'Data', value: formatJobData(selectedJob.job.data), type: 'json' }
						]"
						confirm-text="Resume"
						confirm-class="btn-success"
						:loading="actionLoading"
						@confirm="handleResume"
						@cancel="showConfirmResume = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmPauseMulti" class="modal-overlay" @click.self="!actionLoading && (showConfirmPauseMulti = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Pause Multiple Jobs"
						:message="`Pause ${selectedJobIds.length} selected jobs?`"
						confirm-text="Pause All"
						confirm-class="btn-secondary"
						:loading="actionLoading"
						@confirm="handlePauseMulti"
						@cancel="showConfirmPauseMulti = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmResumeMulti" class="modal-overlay" @click.self="!actionLoading && (showConfirmResumeMulti = false)">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Resume Multiple Jobs"
						:message="`Resume ${selectedJobIds.length} selected jobs?`"
						confirm-text="Resume All"
						confirm-class="btn-success"
						:loading="actionLoading"
						@confirm="handleResumeMulti"
						@cancel="showConfirmResumeMulti = false"
					/>
				</div>
			</div>
		</Teleport>

		<!-- Toast notifications -->
		<Toast />
	</div>
</template>
