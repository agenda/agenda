<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { AgendaStats } from '../types';
import * as api from '../api/client';
import JobLogs from './JobLogs.vue';

const stats = ref<AgendaStats | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

let refreshInterval: ReturnType<typeof setInterval> | null = null;

async function fetchStats() {
	loading.value = true;
	error.value = null;
	try {
		stats.value = await api.getStats(true);
	} catch (err) {
		error.value = 'Failed to load stats';
		console.error('Failed to fetch stats:', err);
	} finally {
		loading.value = false;
	}
}

function formatProcessEvery(value: string | number): string {
	if (typeof value === 'number') {
		return `${value}ms`;
	}
	return value;
}

onMounted(() => {
	fetchStats();
	// Refresh stats every 5 seconds
	refreshInterval = setInterval(fetchStats, 5000);
});

onUnmounted(() => {
	if (refreshInterval) {
		clearInterval(refreshInterval);
	}
});
</script>

<template>
	<div class="stats-panel">
		<div v-if="loading && !stats" class="stats-loading-full">
			<div class="spinner-border"></div>
			<span>Loading stats...</span>
		</div>

		<div v-else-if="error" class="alert alert-danger">{{ error }}</div>

		<div v-else-if="stats" class="stats-content">
				<!-- Config Section -->
				<div class="stats-section">
					<div class="stats-section-title">Configuration</div>
					<div class="stats-grid">
						<div class="stat-item">
							<span class="stat-label">Version</span>
							<span class="stat-value">{{ stats.version }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Backend</span>
							<span class="stat-value">{{ stats.backend?.name || 'unknown' }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Notifications</span>
							<span class="stat-value" :class="{ 'stat-enabled': stats.backend?.hasNotificationChannel }">
								{{ stats.backend?.hasNotificationChannel ? 'enabled' : 'polling' }}
							</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Queue Name</span>
							<span class="stat-value">{{ stats.queueName || 'default' }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Process Every</span>
							<span class="stat-value">{{ formatProcessEvery(stats.config.processEvery) }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Max Concurrency</span>
							<span class="stat-value">{{ stats.config.maxConcurrency }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Lock Limit</span>
							<span class="stat-value">{{ stats.config.totalLockLimit || 'unlimited' }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Jobs Ready to Run</span>
							<span class="stat-value">{{ stats.totalQueueSizeDB }}</span>
						</div>
					</div>
				</div>

				<!-- Live Status Section -->
				<div class="stats-section">
					<div class="stats-section-title">Live Status</div>
					<div class="stats-grid">
						<div class="stat-item">
							<span class="stat-label">Running Jobs</span>
							<span class="stat-value stat-running">{{ typeof stats.runningJobs === 'number' ? stats.runningJobs : stats.runningJobs.length }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Queued Jobs</span>
							<span class="stat-value stat-queued">{{ typeof stats.queuedJobs === 'number' ? stats.queuedJobs : stats.queuedJobs.length }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Locked Jobs</span>
							<span class="stat-value stat-locked">{{ typeof stats.lockedJobs === 'number' ? stats.lockedJobs : stats.lockedJobs.length }}</span>
						</div>
						<div class="stat-item">
							<span class="stat-label">Local Queue Processing</span>
							<span class="stat-value">{{ stats.internal.localQueueProcessing }}</span>
						</div>
					</div>
				</div>

				<!-- Per-Job Status Section -->
				<div v-if="stats.jobStatus && Object.keys(stats.jobStatus).length > 0" class="stats-section">
					<div class="stats-section-title">Per-Job Status</div>
					<div class="job-status-list">
						<div v-for="(status, name) in stats.jobStatus" :key="name" class="job-status-item">
							<span class="job-status-name">{{ name }}</span>
							<div class="job-status-badges">
								<span class="stat-badge running">{{ status.running }} running</span>
								<span class="stat-badge locked">{{ status.locked }} locked</span>
								<span v-if="status.config.concurrency" class="stat-badge config">concurrency: {{ status.config.concurrency }}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Recent Job Logs -->
				<div class="stats-section">
					<div class="stats-section-title">Recent Job Logs</div>
					<JobLogs />
				</div>
		</div>
	</div>
</template>

<style scoped>
.stats-panel {
	background: white;
	border: 1px solid #e9ecef;
	border-radius: 8px;
	overflow: hidden;
}

.stats-loading-full {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 60px 20px;
	gap: 16px;
	color: #6c757d;
}

.stats-content {
	padding: 20px;
}

.stats-section {
	margin-bottom: 16px;
}

.stats-section:last-child {
	margin-bottom: 0;
}

.stats-section-title {
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	color: #6c757d;
	margin-bottom: 8px;
	letter-spacing: 0.5px;
}

.stats-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	gap: 12px;
}

.stat-item {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.stat-label {
	font-size: 0.75rem;
	color: #6c757d;
}

.stat-value {
	font-weight: 600;
	color: #293241;
}

.stat-running {
	color: #ffc107;
}

.stat-queued {
	color: #4a6fa5;
}

.stat-locked {
	color: #6c757d;
}

.stat-enabled {
	color: #28a745;
}

.stat-badge {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 12px;
	font-size: 0.75rem;
	font-weight: 500;
}

.stat-badge.running {
	background-color: #fff3cd;
	color: #856404;
}

.stat-badge.queued {
	background-color: #d4e5f7;
	color: #1a5fb4;
}

.stat-badge.locked {
	background-color: #e9ecef;
	color: #495057;
}

.stat-badge.config {
	background-color: #e7f5ff;
	color: #1971c2;
}

.job-status-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.job-status-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	background: #f8f9fa;
	border-radius: 6px;
}

.job-status-name {
	font-weight: 500;
	color: #293241;
}

.job-status-badges {
	display: flex;
	gap: 6px;
}
</style>
