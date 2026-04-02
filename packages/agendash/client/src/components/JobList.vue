<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FrontendJob } from '../types';
import { formatRelative, formatTitle } from '../utils/date';

const props = defineProps<{
	jobs: FrontendJob[];
	pageSize: number;
	pageNumber: number;
	totalPages: number;
	loading: boolean;
	filterDisplay?: string;
}>();

const emit = defineEmits<{
	'show-job-detail': [job: FrontendJob];
	'confirm-delete': [job: FrontendJob];
	'confirm-requeue': [job: FrontendJob];
	'confirm-retry': [job: FrontendJob];
	'confirm-pause': [job: FrontendJob];
	'confirm-resume': [job: FrontendJob];
	'confirm-delete-multi': [jobIds: string[]];
	'confirm-requeue-multi': [jobIds: string[]];
	'confirm-retry-multi': [jobIds: string[]];
	'confirm-pause-multi': [jobIds: string[]];
	'confirm-resume-multi': [jobIds: string[]];
	'page-next': [];
	'page-prev': [];
}>();

const selectedIds = ref<string[]>([]);
const currentSort = ref<'name' | 'lastRunAt' | 'nextRunAt' | 'lastFinishedAt'>('name');
const currentSortDir = ref<'asc' | 'desc'>('asc');

// Reset selection when jobs change
watch(
	() => props.jobs,
	() => {
		selectedIds.value = [];
	}
);

const sortedJobs = computed(() => {
	const sorted = [...props.jobs].sort((a, b) => {
		let displayA: string | number;
		let displayB: string | number;

		if (currentSort.value === 'name') {
			displayA = (a.job.name || '').toLowerCase();
			displayB = (b.job.name || '').toLowerCase();
		} else {
			displayA = a.job[currentSort.value] ? new Date(a.job[currentSort.value]!).getTime() : 0;
			displayB = b.job[currentSort.value] ? new Date(b.job[currentSort.value]!).getTime() : 0;
		}

		const modifier = currentSortDir.value === 'desc' ? -1 : 1;
		if (displayA < displayB) return -1 * modifier;
		if (displayA > displayB) return 1 * modifier;
		return 0;
	});

	// Show recurring jobs first
	return [
		...sorted.filter((job) => job.repeating),
		...sorted.filter((job) => !job.repeating)
	];
});

function sort(column: typeof currentSort.value) {
	if (column === currentSort.value) {
		currentSortDir.value = currentSortDir.value === 'asc' ? 'desc' : 'asc';
	} else {
		currentSort.value = column;
		currentSortDir.value = 'asc';
	}
}

function toggleSelection(job: FrontendJob) {
	const id = job.job._id;
	const index = selectedIds.value.indexOf(id);
	if (index === -1) {
		selectedIds.value.push(id);
	} else {
		selectedIds.value.splice(index, 1);
	}
}

function toggleAll() {
	if (selectedIds.value.length === props.jobs.length) {
		selectedIds.value = [];
	} else {
		selectedIds.value = props.jobs.map((j) => j.job._id);
	}
}

function isSelected(job: FrontendJob): boolean {
	return selectedIds.value.includes(job.job._id);
}

function sendRequeue() {
	emit('confirm-requeue-multi', [...selectedIds.value]);
}

const retryEligibleIds = computed(() =>
	selectedIds.value.filter((id) => {
		const job = props.jobs.find((j) => j.job._id === id);
		return job && job.failed && !job.job.nextRunAt;
	})
);

function sendRetry() {
	emit('confirm-retry-multi', [...retryEligibleIds.value]);
}

function sendDelete() {
	emit('confirm-delete-multi', [...selectedIds.value]);
}

function sendPause() {
	emit('confirm-pause-multi', [...selectedIds.value]);
}

function sendResume() {
	emit('confirm-resume-multi', [...selectedIds.value]);
}

function getSortIcon(column: string): string {
	if (currentSort.value !== column) return '';
	return currentSortDir.value === 'asc' ? '\u25B2' : '\u25BC';
}
</script>

<template>
	<div>
		<!-- Multi-select actions -->
		<div class="d-flex justify-content-end mb-2 flex-wrap gap-2">
			<span class="me-2 align-self-center">{{ selectedIds.length }} jobs selected</span>
			<button
				:disabled="!selectedIds.length"
				class="btn btn-primary"
				title="Requeue list of selected jobs (creates new jobs)"
				@click="sendRequeue"
			>
				Multiple Requeue
			</button>
			<button
				:disabled="!retryEligibleIds.length"
				class="btn btn-outline-primary"
				title="Retry list of selected failed jobs (reruns existing jobs)"
				@click="sendRetry"
			>
				Multiple Retry
			</button>
			<button
				:disabled="!selectedIds.length"
				class="btn btn-secondary"
				title="Pause list of selected jobs"
				@click="sendPause"
			>
				Multiple Pause
			</button>
			<button
				:disabled="!selectedIds.length"
				class="btn btn-success"
				title="Resume list of selected jobs"
				@click="sendResume"
			>
				Multiple Resume
			</button>
			<button
				:disabled="!selectedIds.length"
				class="btn btn-danger"
				title="Delete list of selected jobs"
				@click="sendDelete"
			>
				Multiple Delete
			</button>
		</div>

		<!-- Job Table -->
		<div class="table-responsive">
		<table class="table table-striped">
			<thead class="table-dark">
				<tr>
					<th scope="col" @click="toggleAll">
						<input type="checkbox" :checked="selectedIds.length === jobs.length && jobs.length > 0" />
					</th>
					<th scope="col">Status</th>
					<th scope="col" @click="sort('name')">
						Name
						<span v-if="currentSort === 'name'" class="sort-icon">{{ getSortIcon('name') }}</span>
					</th>
					<th scope="col" @click="sort('lastRunAt')">
						Last run started
						<span v-if="currentSort === 'lastRunAt'" class="sort-icon">{{
							getSortIcon('lastRunAt')
						}}</span>
					</th>
					<th scope="col" @click="sort('nextRunAt')">
						Next run starts
						<span v-if="currentSort === 'nextRunAt'" class="sort-icon">{{
							getSortIcon('nextRunAt')
						}}</span>
					</th>
					<th scope="col" @click="sort('lastFinishedAt')">
						Last finished
						<span v-if="currentSort === 'lastFinishedAt'" class="sort-icon">{{
							getSortIcon('lastFinishedAt')
						}}</span>
					</th>
					<th scope="col">Locked</th>
					<th scope="col">Actions</th>
				</tr>
			</thead>
			<tbody v-if="loading">
				<tr>
					<td colspan="8" scope="row">
						<div class="col-12 my-5 ms-auto text-center">
							<div class="text-center my-5 py-5">
								<div class="spinner-border" role="status">
									<span class="visually-hidden">Loading...</span>
								</div>
								<div>
									<span>Loading Jobs...</span>
								</div>
							</div>
						</div>
					</td>
				</tr>
			</tbody>
			<tbody v-else-if="jobs.length === 0">
				<tr>
					<td colspan="8" scope="row">
						<div class="text-center py-5 text-muted">
							<div class="mb-2" style="font-size: 2rem;">&#128269;</div>
							<div v-if="filterDisplay">
								<strong>No jobs found</strong> for filter "{{ filterDisplay }}"
							</div>
							<div v-else>
								<strong>No jobs found</strong>
							</div>
							<small class="d-block mt-2">Try adjusting your filter criteria</small>
						</div>
					</td>
				</tr>
			</tbody>
			<tbody v-else>
				<tr v-for="job in sortedJobs" :key="job.job._id">
					<td width="10" class="mult-select">
						<input
							type="checkbox"
							:checked="isSelected(job)"
							@change="toggleSelection(job)"
						/>
					</td>
					<td scope="row" class="job-name">
						<span v-if="job.paused" class="pill-own bg-secondary pill-without-icon">
							<span>Paused</span>
						</span>
						<span v-if="job.repeating" class="pill-own bg-info">
							<span>{{ job.job.repeatInterval }}</span>
						</span>
						<span v-if="job.scheduled" class="pill-own bg-info pill-without-icon">
							<span>Scheduled</span>
						</span>
						<span v-if="job.completed" class="pill-own bg-success pill-without-icon">
							<span>Completed</span>
						</span>
						<span v-if="job.queued" class="pill-own bg-primary pill-without-icon">
							<span>Queued</span>
						</span>
						<span v-if="job.failed" class="pill-own bg-danger pill-without-icon">
							<span>Failed</span>
						</span>
						<span v-if="job.job.failCount" class="pill-own bg-danger pill-without-icon" :title="job.job.failReason">
							<span>{{ job.job.failCount }} {{ job.job.failCount === 1 ? 'error' : 'errors' }}</span>
						</span>
						<span v-if="job.running" class="pill-own bg-warning pill-without-icon">
							<span>Running</span>
						</span>
						<div v-if="job.running && job.job.progress != null" class="progress mt-1" style="height: 4px; min-width: 60px;">
							<div
								class="progress-bar progress-bar-striped progress-bar-animated"
								role="progressbar"
								:style="{ width: job.job.progress + '%' }"
								:aria-valuenow="job.job.progress"
								aria-valuemin="0"
								aria-valuemax="100"
							></div>
						</div>
						<div v-if="job.failed && job.job.failReason" class="fail-reason-text mt-1">
							{{ job.job.failReason }}
						</div>
					</td>
					<td class="job-name" @click="toggleSelection(job)">{{ job.job.name }}</td>
					<td
						class="job-lastRunAt"
						:title="formatTitle(job.job.lastRunAt)"
						@click="toggleSelection(job)"
					>
						{{ formatRelative(job.job.lastRunAt) }}
					</td>
					<td
						class="job-nextRunAt"
						:title="formatTitle(job.job.nextRunAt)"
						@click="toggleSelection(job)"
					>
						{{ formatRelative(job.job.nextRunAt) }}
					</td>
					<td
						class="job-finishedAt"
						:title="formatTitle(job.job.lastFinishedAt)"
						@click="toggleSelection(job)"
					>
						{{ formatRelative(job.job.lastFinishedAt) }}
					</td>
					<td
						class="job-lockedAt"
						:title="formatTitle(job.job.lockedAt)"
						@click="toggleSelection(job)"
					>
						{{ formatRelative(job.job.lockedAt) }}
					</td>
					<td class="job-actions">
						<span
							class="action-btn text-primary"
							title="Requeue (create new job)"
							@click="$emit('confirm-requeue', job)"
							>&#x21BB;</span
						>
						<span
							v-if="job.failed && !job.job.nextRunAt"
							class="action-btn text-info"
							title="Retry (rerun existing job)"
							@click="$emit('confirm-retry', job)"
							>&#x21BA;</span
						>
						<span
							v-if="job.paused"
							class="action-btn text-success"
							title="Resume job"
							@click="$emit('confirm-resume', job)"
							>&#x25B6;</span
						>
						<span
							v-else
							class="action-btn text-secondary"
							title="Pause job"
							@click="$emit('confirm-pause', job)"
							>&#x23F8;</span
						>
						<span
							class="action-btn text-success"
							title="Job Data"
							@click="$emit('show-job-detail', job)"
							>&#x1F441;</span
						>
						<span
							class="action-btn text-danger"
							title="Delete permanently"
							@click="$emit('confirm-delete', job)"
							>&#x1F5D1;</span
						>
					</td>
				</tr>
			</tbody>
		</table>
		</div>

		<!-- Pagination -->
		<div class="row mt-3">
			<div class="col d-flex justify-content-center">
				<nav aria-label="Page navigation">
					<ul class="pagination">
						<li class="page-item" :class="{ disabled: pageNumber === 1 }">
							<a class="page-link" href="#" @click.prevent="$emit('page-prev')">Previous</a>
						</li>
						<li class="page-item" :class="{ disabled: pageNumber >= totalPages }">
							<a class="page-link" href="#" @click.prevent="$emit('page-next')">Next</a>
						</li>
					</ul>
				</nav>
			</div>
		</div>
		<div class="row">
			<div class="col d-flex justify-content-center">Page: {{ pageNumber }} / {{ totalPages }}</div>
		</div>
	</div>
</template>
