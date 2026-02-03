<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import type { FrontendLogEntry, LogsQueryParams } from '../types';
import { getLogs } from '../api/client';
import { formatDateTime, formatRelative } from '../utils/date';

const props = defineProps<{
	jobId?: string;
	jobName?: string;
}>();

const entries = ref<FrontendLogEntry[]>([]);
const total = ref(0);
const loggingEnabled = ref<boolean | null>(null);
const loading = ref(false);
const offset = ref(0);
const limit = ref(50);
const levelFilter = ref('');
const eventFilter = ref('');

const totalPages = computed(() => Math.ceil(total.value / limit.value) || 1);
const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1);

async function fetchLogs() {
	loading.value = true;
	try {
		const params: LogsQueryParams = {
			limit: limit.value,
			offset: offset.value,
			sort: 'desc'
		};
		if (props.jobId) params.jobId = props.jobId;
		if (props.jobName) params.jobName = props.jobName;
		if (levelFilter.value) params.level = levelFilter.value;
		if (eventFilter.value) params.event = eventFilter.value;

		const result = await getLogs(params);
		entries.value = result.entries;
		total.value = result.total;
		loggingEnabled.value = result.loggingEnabled;
	} catch {
		entries.value = [];
		total.value = 0;
	} finally {
		loading.value = false;
	}
}

function nextPage() {
	if (currentPage.value < totalPages.value) {
		offset.value += limit.value;
		fetchLogs();
	}
}

function prevPage() {
	if (offset.value > 0) {
		offset.value = Math.max(0, offset.value - limit.value);
		fetchLogs();
	}
}

function applyFilters() {
	offset.value = 0;
	fetchLogs();
}

function levelClass(level: string): string {
	switch (level) {
		case 'error': return 'badge-error';
		case 'warn': return 'badge-warn';
		case 'info': return 'badge-info';
		case 'debug': return 'badge-debug';
		default: return '';
	}
}

function eventClass(event: string): string {
	switch (event) {
		case 'start': return 'badge-event-start';
		case 'success': return 'badge-event-success';
		case 'complete': return 'badge-event-complete';
		case 'fail': return 'badge-event-fail';
		case 'retry': return 'badge-event-retry';
		case 'retry:exhausted': return 'badge-event-fail';
		case 'locked': return 'badge-event-locked';
		case 'expired': return 'badge-event-warn';
		default: return '';
	}
}

watch([() => props.jobId, () => props.jobName], () => {
	offset.value = 0;
	fetchLogs();
});

onMounted(() => {
	fetchLogs();
});
</script>

<template>
	<div class="job-logs">
		<div v-if="loggingEnabled === false" class="logs-disabled">
			<p>Logging is not enabled.</p>
			<p class="text-muted small">
				Enable persistent logging by setting <code>logging: true</code> in your Agenda config.
			</p>
		</div>

		<div v-else>
			<!-- Filters -->
			<div class="logs-filters">
				<select v-model="levelFilter" class="form-select form-select-sm" @change="applyFilters">
					<option value="">All Levels</option>
					<option value="info">Info</option>
					<option value="warn">Warn</option>
					<option value="error">Error</option>
					<option value="debug">Debug</option>
				</select>
				<select v-model="eventFilter" class="form-select form-select-sm" @change="applyFilters">
					<option value="">All Events</option>
					<option value="start">Start</option>
					<option value="success">Success</option>
					<option value="fail">Fail</option>
					<option value="complete">Complete</option>
					<option value="retry">Retry</option>
					<option value="retry:exhausted">Retry Exhausted</option>
					<option value="locked">Locked</option>
					<option value="expired">Expired</option>
				</select>
				<span class="text-muted small">{{ total }} entries</span>
			</div>

			<!-- Loading -->
			<div v-if="loading" class="text-center py-3">
				<span class="text-muted">Loading logs...</span>
			</div>

			<!-- Empty state -->
			<div v-else-if="entries.length === 0" class="text-center py-3">
				<span class="text-muted">No log entries found.</span>
			</div>

			<!-- Logs table -->
			<div v-else class="logs-table-wrapper">
				<table class="logs-table">
					<thead>
						<tr>
							<th>Time</th>
							<th>Level</th>
							<th>Event</th>
							<th v-if="!jobName">Job</th>
							<th>Message</th>
							<th>Duration</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="entry in entries" :key="entry._id" :class="{ 'row-error': entry.level === 'error', 'row-warn': entry.level === 'warn' }">
							<td class="col-time" :title="entry.timestamp">
								{{ formatRelative(entry.timestamp) }}
							</td>
							<td>
								<span class="badge" :class="levelClass(entry.level)">{{ entry.level }}</span>
							</td>
							<td>
								<span class="badge" :class="eventClass(entry.event)">{{ entry.event }}</span>
							</td>
							<td v-if="!jobName" class="col-job">{{ entry.jobName }}</td>
							<td class="col-message">
								{{ entry.message }}
								<div v-if="entry.error" class="error-detail">{{ entry.error }}</div>
							</td>
							<td class="col-duration">
								<span v-if="entry.duration != null">{{ entry.duration }}ms</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div v-if="totalPages > 1" class="logs-pagination">
				<button class="btn btn-sm btn-outline" :disabled="currentPage <= 1" @click="prevPage">Prev</button>
				<span class="text-muted small">Page {{ currentPage }} of {{ totalPages }}</span>
				<button class="btn btn-sm btn-outline" :disabled="currentPage >= totalPages" @click="nextPage">Next</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.job-logs {
	font-size: 0.875rem;
}

.logs-disabled {
	text-align: center;
	padding: 2rem 1rem;
	color: #6c757d;
}

.logs-filters {
	display: flex;
	gap: 0.5rem;
	align-items: center;
	padding: 0.75rem 0;
}

.form-select-sm {
	padding: 0.25rem 2rem 0.25rem 0.5rem;
	font-size: 0.8125rem;
	border: 1px solid #dee2e6;
	border-radius: 4px;
	background: white;
	max-width: 160px;
}

.logs-table-wrapper {
	overflow-x: auto;
	border: 1px solid #e9ecef;
	border-radius: 6px;
}

.logs-table {
	width: 100%;
	border-collapse: collapse;
}

.logs-table th {
	padding: 0.5rem 0.75rem;
	text-align: left;
	font-weight: 600;
	font-size: 0.75rem;
	text-transform: uppercase;
	color: #6c757d;
	background: #f8f9fa;
	border-bottom: 2px solid #dee2e6;
	white-space: nowrap;
}

.logs-table td {
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid #f0f0f0;
	vertical-align: top;
}

.logs-table tbody tr:hover {
	background: #f8f9fa;
}

.row-error {
	background: #fff5f5;
}

.row-warn {
	background: #fffdf0;
}

.col-time {
	white-space: nowrap;
	color: #6c757d;
	font-size: 0.8125rem;
}

.col-job {
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-weight: 500;
}

.col-message {
	max-width: 400px;
	word-break: break-word;
}

.col-duration {
	white-space: nowrap;
	color: #6c757d;
	font-family: monospace;
	font-size: 0.8125rem;
}

.error-detail {
	margin-top: 0.25rem;
	padding: 0.25rem 0.5rem;
	background: #f8d7da;
	border-radius: 3px;
	font-size: 0.8125rem;
	color: #842029;
	font-family: monospace;
	word-break: break-all;
}

.badge {
	display: inline-block;
	padding: 0.15rem 0.5rem;
	border-radius: 3px;
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
}

.badge-error { background: #f8d7da; color: #842029; }
.badge-warn { background: #fff3cd; color: #664d03; }
.badge-info { background: #cff4fc; color: #055160; }
.badge-debug { background: #e2e3e5; color: #41464b; }

.badge-event-start { background: #cff4fc; color: #055160; }
.badge-event-success { background: #d1e7dd; color: #0f5132; }
.badge-event-complete { background: #d1e7dd; color: #0f5132; }
.badge-event-fail { background: #f8d7da; color: #842029; }
.badge-event-retry { background: #fff3cd; color: #664d03; }
.badge-event-locked { background: #e2e3e5; color: #41464b; }
.badge-event-warn { background: #fff3cd; color: #664d03; }

.logs-pagination {
	display: flex;
	gap: 0.75rem;
	align-items: center;
	justify-content: center;
	padding: 0.75rem 0;
}

.btn-outline {
	border: 1px solid #dee2e6;
	background: white;
	color: #293241;
	padding: 0.25rem 0.75rem;
	border-radius: 4px;
	cursor: pointer;
	font-size: 0.8125rem;
}

.btn-outline:hover:not(:disabled) {
	background: #f8f9fa;
	border-color: #adb5bd;
}

.btn-outline:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
