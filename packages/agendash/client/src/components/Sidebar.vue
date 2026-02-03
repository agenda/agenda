<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { FrontendOverview, AgendaStats } from '../types';
import type { SearchParams } from '../types';
import * as api from '../api/client';

const props = defineProps<{
	overview: FrontendOverview[];
	pageSize: number;
	loading: boolean;
	currentFilters: Partial<SearchParams>;
	showingStats: boolean;
}>();

const emit = defineEmits<{
	search: [name: string, state: string];
	'new-job': [];
	'show-stats': [];
	'show-job-logs': [name: string];
}>();

const expandedItems = ref<Set<string>>(new Set(['All Jobs']));
const stats = ref<AgendaStats | null>(null);
const statsLoading = ref(false);
let statsInterval: ReturnType<typeof setInterval> | null = null;

async function fetchStats() {
	statsLoading.value = true;
	try {
		stats.value = await api.getStats(false);
	} catch (err) {
		console.error('Failed to fetch stats:', err);
	} finally {
		statsLoading.value = false;
	}
}

onMounted(() => {
	fetchStats();
	statsInterval = setInterval(fetchStats, 5000);
});

onUnmounted(() => {
	if (statsInterval) clearInterval(statsInterval);
});

function isSelectedJob(displayName: string): boolean {
	// Nothing is selected when showing stats
	if (props.showingStats) return false;

	const currentName = props.currentFilters.name || '';
	if (displayName === 'All Jobs') {
		return currentName === '' || currentName === 'All Jobs';
	}
	return currentName === displayName;
}

function isSelectedState(displayName: string, state: string): boolean {
	if (!isSelectedJob(displayName)) return false;
	const currentState = props.currentFilters.state || '';
	return currentState === state;
}

function isExpanded(name: string): boolean {
	return expandedItems.value.has(name);
}

function handleJobClick(name: string) {
	const isCurrentlySelected = isSelectedJob(name);
	const hasStateFilter = !!props.currentFilters.state;

	// Only collapse if already selected with no state filter
	if (isCurrentlySelected && !hasStateFilter) {
		// Toggle collapse
		if (expandedItems.value.has(name)) {
			expandedItems.value.delete(name);
		} else {
			expandedItems.value.add(name);
		}
	} else {
		// Expand and select (clearing any state filter)
		expandedItems.value.add(name);
	}

	emit('search', name, '');
}

function searchJob(name: string, state = '') {
	emit('search', name, state);
}

function getStatusColor(type: string): string {
	const colors: Record<string, string> = {
		scheduled: '#17a2b8',
		queued: '#4a6fa5',
		running: '#ffc107',
		completed: '#28a745',
		failed: '#dc3545',
		repeating: '#98c1d9',
		paused: '#6c757d'
	};
	return colors[type] || '#6c757d';
}
</script>

<template>
	<div class="p-3 sidebar-container">
		<!-- Loading indicator (small, positioned, when we have data) -->
		<div v-if="loading && overview.length > 0" class="sidebar-loading-indicator">
			<div class="spinner-border spinner-border-sm"></div>
		</div>

		<!-- New Job Button -->
		<button class="btn btn-success btn-sm w-100 mb-3" @click="$emit('new-job')">
			+ New Job
		</button>

		<!-- Agenda Status Summary -->
		<div
			class="stats-summary-card mb-3"
			:class="{ 'stats-selected': showingStats }"
			@click="$emit('show-stats')"
		>
			<div class="stats-summary-header">
				<span class="stats-summary-title">Agenda Status</span>
				<span v-if="statsLoading" class="spinner-border spinner-border-sm"></span>
			</div>
			<div v-if="stats" class="stats-summary-badges">
				<span class="stats-badge running">{{ typeof stats.runningJobs === 'number' ? stats.runningJobs : stats.runningJobs.length }} running</span>
				<span class="stats-badge queued">{{ typeof stats.queuedJobs === 'number' ? stats.queuedJobs : stats.queuedJobs.length }} queued</span>
				<span class="stats-badge locked">{{ typeof stats.lockedJobs === 'number' ? stats.lockedJobs : stats.lockedJobs.length }} locked</span>
			</div>
		</div>

		<!-- Initial Loading State (only when no data yet) -->
		<div v-if="loading && overview.length === 0" class="text-center py-4 text-muted">
			<div class="spinner-border spinner-border-sm mb-2"></div>
			<small class="d-block">Loading...</small>
		</div>

		<!-- Job Overview List (show when we have data, even while loading) -->
		<div v-if="overview.length > 0" class="job-list">
			<div v-for="item in overview" :key="item.displayName" class="job-item mb-1">
				<!-- Job Header Row -->
				<div class="job-header d-flex align-items-center" :class="{ 'job-header-selected': isSelectedJob(item.displayName) && !currentFilters.state }" @click="handleJobClick(item.displayName)">
					<!-- Expand Toggle -->
					<span class="expand-icon" :class="{ rotated: isExpanded(item.displayName) }">&#9658;</span>

					<!-- Job Name -->
					<span class="job-name flex-grow-1" :class="{ 'job-name-selected': isSelectedJob(item.displayName) }">{{ item.displayName }}</span>

					<!-- Status dots (collapsed view) -->
					<span v-if="!isExpanded(item.displayName)" class="status-dots">
						<span v-if="item.scheduled" class="status-dot" :style="{ backgroundColor: getStatusColor('scheduled') }" :title="`${item.scheduled} scheduled`"></span>
						<span v-if="item.queued" class="status-dot" :style="{ backgroundColor: getStatusColor('queued') }" :title="`${item.queued} queued`"></span>
						<span v-if="item.running" class="status-dot" :style="{ backgroundColor: getStatusColor('running') }" :title="`${item.running} running`"></span>
						<span v-if="item.completed" class="status-dot" :style="{ backgroundColor: getStatusColor('completed') }" :title="`${item.completed} completed`"></span>
						<span v-if="item.failed" class="status-dot" :style="{ backgroundColor: getStatusColor('failed') }" :title="`${item.failed} failed`"></span>
						<span v-if="item.repeating" class="status-dot" :style="{ backgroundColor: getStatusColor('repeating') }" :title="`${item.repeating} repeating`"></span>
						<span v-if="item.paused" class="status-dot" :style="{ backgroundColor: getStatusColor('paused') }" :title="`${item.paused} paused`"></span>
					</span>

					<!-- Total Count -->
					<span class="job-total">{{ item.total }}</span>
				</div>

				<!-- Mini Progress Bar (expanded view only) -->
				<div v-if="isExpanded(item.displayName)" class="mini-progress mx-4 mb-1">
					<div
						v-if="item.scheduled"
						class="mini-bar"
						:style="{ flex: item.scheduled, backgroundColor: getStatusColor('scheduled') }"
					></div>
					<div
						v-if="item.queued"
						class="mini-bar"
						:style="{ flex: item.queued, backgroundColor: getStatusColor('queued') }"
					></div>
					<div
						v-if="item.running"
						class="mini-bar"
						:style="{ flex: item.running, backgroundColor: getStatusColor('running') }"
					></div>
					<div
						v-if="item.completed"
						class="mini-bar"
						:style="{ flex: item.completed, backgroundColor: getStatusColor('completed') }"
					></div>
					<div
						v-if="item.failed"
						class="mini-bar"
						:style="{ flex: item.failed, backgroundColor: getStatusColor('failed') }"
					></div>
					<div
						v-if="item.paused"
						class="mini-bar"
						:style="{ flex: item.paused, backgroundColor: getStatusColor('paused') }"
					></div>
				</div>

				<!-- Expanded Details -->
				<div v-if="isExpanded(item.displayName)" class="job-details">
					<div class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'scheduled') }" @click="searchJob(item.displayName, 'scheduled')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('scheduled') }"></span>
						<span class="label">Scheduled</span>
						<span class="count">{{ item.scheduled }}</span>
					</div>
					<div class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'queued') }" @click="searchJob(item.displayName, 'queued')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('queued') }"></span>
						<span class="label">Queued</span>
						<span class="count">{{ item.queued }}</span>
					</div>
					<div class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'running') }" @click="searchJob(item.displayName, 'running')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('running') }"></span>
						<span class="label">Running</span>
						<span class="count">{{ item.running }}</span>
					</div>
					<div class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'completed') }" @click="searchJob(item.displayName, 'completed')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('completed') }"></span>
						<span class="label">Completed</span>
						<span class="count">{{ item.completed }}</span>
					</div>
					<div class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'failed') }" @click="searchJob(item.displayName, 'failed')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('failed') }"></span>
						<span class="label">Failed</span>
						<span class="count">{{ item.failed }}</span>
					</div>
					<div class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'repeating') }" @click="searchJob(item.displayName, 'repeating')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('repeating') }"></span>
						<span class="label">Repeating</span>
						<span class="count">{{ item.repeating }}</span>
					</div>
					<div v-if="item.paused" class="detail-row" :class="{ 'detail-row-selected': isSelectedState(item.displayName, 'paused') }" @click="searchJob(item.displayName, 'paused')">
						<span class="dot" :style="{ backgroundColor: getStatusColor('paused') }"></span>
						<span class="label">Paused</span>
						<span class="count">{{ item.paused }}</span>
					</div>
					<div v-if="item.displayName !== 'All Jobs'" class="detail-row logs-row" @click.stop="$emit('show-job-logs', item.displayName)">
						<span class="logs-icon">&#128220;</span>
						<span class="label">Logs</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.sidebar-container {
	position: relative;
}

.sidebar-loading-indicator {
	position: absolute;
	top: 8px;
	right: 8px;
	padding: 4px;
	background-color: rgba(255, 255, 255, 0.9);
	border-radius: 50%;
	color: #1976d2;
	z-index: 10;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sidebar-loading-indicator .spinner-border {
	width: 16px;
	height: 16px;
	border-width: 2px;
}

.job-list {
	font-size: 0.875rem;
}

.job-item {
	border-radius: 6px;
	overflow: hidden;
}

.job-header {
	padding: 6px 8px;
	cursor: pointer;
	border-radius: 6px;
	transition: background-color 0.15s;
}

.job-header:hover {
	background-color: #e9ecef;
}

.job-header-selected {
	background-color: #d4e5f7;
}

.job-header-selected:hover {
	background-color: #c5daf3;
}

.expand-icon {
	color: #6c757d;
	font-size: 10px;
	margin-right: 6px;
	transition: transform 0.15s;
}

.expand-icon.rotated {
	transform: rotate(90deg);
}

.job-name {
	font-weight: 500;
	color: #293241;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	margin-right: 8px;
}

.job-name-selected {
	color: #1a5fb4;
	font-weight: 600;
}

.status-dots {
	display: flex;
	gap: 3px;
	margin-right: 8px;
}

.status-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.job-total {
	background-color: #4a6fa5;
	color: white;
	padding: 1px 8px;
	border-radius: 10px;
	font-size: 0.75rem;
	font-weight: 500;
	min-width: 28px;
	text-align: center;
}

.mini-progress {
	display: flex;
	height: 3px;
	border-radius: 2px;
	overflow: hidden;
	background-color: #e9ecef;
}

.mini-bar {
	min-width: 2px;
}

.job-details {
	padding: 4px 8px 8px 24px;
}

.detail-row {
	display: flex;
	align-items: center;
	padding: 3px 8px;
	border-radius: 4px;
	cursor: pointer;
	font-size: 0.8rem;
}

.detail-row:hover {
	background-color: #e9ecef;
}

.detail-row-selected {
	background-color: #d4e5f7;
	font-weight: 500;
}

.detail-row-selected:hover {
	background-color: #c5daf3;
}

.dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	margin-right: 8px;
	flex-shrink: 0;
}

.label {
	flex-grow: 1;
	color: #495057;
}

.count {
	color: #6c757d;
	font-weight: 500;
	min-width: 24px;
	text-align: right;
}

/* Stats Summary Card */
.stats-summary-card {
	background: linear-gradient(135deg, #4a6fa5 0%, #3d5a80 100%);
	border-radius: 8px;
	padding: 10px 12px;
	cursor: pointer;
	transition: transform 0.15s, box-shadow 0.15s;
}

.stats-summary-card:hover {
	transform: translateY(-1px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.stats-summary-card.stats-selected {
	box-shadow: 0 0 0 2px #1a5fb4;
}

.stats-summary-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
}

.stats-summary-title {
	font-weight: 600;
	font-size: 0.85rem;
	color: white;
}

.stats-summary-header .spinner-border {
	width: 14px;
	height: 14px;
	border-width: 2px;
	color: rgba(255, 255, 255, 0.7);
}

.stats-summary-badges {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}

.stats-badge {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 0.7rem;
	font-weight: 500;
}

.stats-badge.running {
	background-color: rgba(255, 193, 7, 0.9);
	color: #293241;
}

.stats-badge.queued {
	background-color: rgba(255, 255, 255, 0.25);
	color: white;
}

.stats-badge.locked {
	background-color: rgba(255, 255, 255, 0.15);
	color: rgba(255, 255, 255, 0.9);
}

/* Logs row in job details */
.logs-row {
	margin-top: 4px;
	border-top: 1px solid #e9ecef;
	padding-top: 6px;
}

.logs-icon {
	font-size: 12px;
	margin-right: 8px;
	flex-shrink: 0;
}
</style>
