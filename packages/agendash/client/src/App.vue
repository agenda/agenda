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
	fetchJobs,
	requeueJobs,
	deleteJobs,
	createJob,
	nextPage,
	prevPage,
	search
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
const showConfirmDeleteMulti = ref(false);
const showConfirmRequeueMulti = ref(false);

// Selected job/jobs for modals
const selectedJob = ref<FrontendJob | null>(null);
const selectedJobIds = ref<string[]>([]);

// View mode - jobs or stats
const showingStats = ref(false);

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

async function handleDelete() {
	if (selectedJob.value) {
		await deleteJobs([selectedJob.value.job._id]);
	}
	showConfirmDelete.value = false;
}

async function handleRequeue() {
	if (selectedJob.value) {
		await requeueJobs([selectedJob.value.job._id]);
	}
	showConfirmRequeue.value = false;
}

async function handleDeleteMulti() {
	await deleteJobs(selectedJobIds.value);
	showConfirmDeleteMulti.value = false;
	selectedJobIds.value = [];
}

async function handleRequeueMulti() {
	await requeueJobs(selectedJobIds.value);
	showConfirmRequeueMulti.value = false;
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
});

onUnmounted(() => {
	if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
	<div class="app-wrapper">
		<!-- Navbar -->
		<nav class="navbar navbar-custom navbar-dark sticky-top px-3 py-2">
			<span class="navbar-brand mb-0">Agendash</span>
			<div class="d-flex align-items-center gap-3">
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
						@confirm-delete-multi="handleConfirmDeleteMulti"
						@confirm-requeue-multi="handleConfirmRequeueMulti"
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

			<div v-if="showConfirmDelete && selectedJob" class="modal-overlay" @click.self="showConfirmDelete = false">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Delete Job"
						:message="`Delete job '${selectedJob.job.name}'?`"
						:details="[
							{ label: 'ID', value: selectedJob.job._id },
							{ label: 'Name', value: selectedJob.job.name }
						]"
						confirm-text="Delete"
						confirm-class="btn-danger"
						@confirm="handleDelete"
						@cancel="showConfirmDelete = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmRequeue && selectedJob" class="modal-overlay" @click.self="showConfirmRequeue = false">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Requeue Job"
						:message="`Requeue job '${selectedJob.job.name}'?`"
						:details="[
							{ label: 'ID', value: selectedJob.job._id },
							{ label: 'Name', value: selectedJob.job.name }
						]"
						confirm-text="Requeue"
						confirm-class="btn-primary"
						@confirm="handleRequeue"
						@cancel="showConfirmRequeue = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmDeleteMulti" class="modal-overlay" @click.self="showConfirmDeleteMulti = false">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Delete Multiple Jobs"
						:message="`Delete ${selectedJobIds.length} selected jobs?`"
						confirm-text="Delete All"
						confirm-class="btn-danger"
						@confirm="handleDeleteMulti"
						@cancel="showConfirmDeleteMulti = false"
					/>
				</div>
			</div>

			<div v-if="showConfirmRequeueMulti" class="modal-overlay" @click.self="showConfirmRequeueMulti = false">
				<div class="modal-container" style="width: 400px">
					<ConfirmDialog
						title="Requeue Multiple Jobs"
						:message="`Requeue ${selectedJobIds.length} selected jobs?`"
						confirm-text="Requeue All"
						confirm-class="btn-primary"
						@confirm="handleRequeueMulti"
						@cancel="showConfirmRequeueMulti = false"
					/>
				</div>
			</div>
		</Teleport>

		<!-- Toast notifications -->
		<Toast />
	</div>
</template>
