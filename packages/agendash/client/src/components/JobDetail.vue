<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FrontendJob } from '../types';
import { formatDateTime } from '../utils/date';

const props = defineProps<{
	job: FrontendJob;
}>();

const emit = defineEmits<{
	close: [];
}>();

const activeTab = ref<'details' | 'raw'>('details');

const formattedData = computed(() => {
	try {
		return JSON.stringify(props.job.job.data, null, 2);
	} catch {
		return String(props.job.job.data);
	}
});

const rawJob = computed(() => {
	try {
		return JSON.stringify(props.job, null, 2);
	} catch {
		return String(props.job);
	}
});
</script>

<template>
	<div>
		<div class="modal-header">
			<h5 class="modal-title">{{ job.job.name }}</h5>
			<button type="button" class="btn-close" @click="$emit('close')"></button>
		</div>

		<!-- Tabs -->
		<div class="tab-nav">
			<button
				class="tab-btn"
				:class="{ active: activeTab === 'details' }"
				@click="activeTab = 'details'"
			>
				Details
			</button>
			<button
				class="tab-btn"
				:class="{ active: activeTab === 'raw' }"
				@click="activeTab = 'raw'"
			>
				Raw Data
			</button>
		</div>

		<div class="modal-body">
			<!-- Details Tab -->
			<div v-if="activeTab === 'details'">
				<div v-if="job.paused" class="alert alert-secondary mb-3">
					<strong>Status: Paused</strong>
					<div class="small">This job is paused and will not run until resumed.</div>
				</div>

				<div class="mb-3">
					<div class="row">
						<div class="col-6">
							<small class="text-muted d-block">Next run</small>
							<strong>{{ formatDateTime(job.job.nextRunAt) || 'Not scheduled' }}</strong>
						</div>
						<div class="col-6">
							<small class="text-muted d-block">Last run</small>
							<strong>{{ formatDateTime(job.job.lastRunAt) || 'Never' }}</strong>
						</div>
					</div>
				</div>

				<div class="mb-3">
					<div class="row">
						<div class="col-6">
							<small class="text-muted d-block">Last finished</small>
							<strong>{{ formatDateTime(job.job.lastFinishedAt) || 'Never' }}</strong>
						</div>
						<div class="col-6">
							<small class="text-muted d-block">Locked at</small>
							<strong>{{ formatDateTime(job.job.lockedAt) || 'Not locked' }}</strong>
						</div>
					</div>
				</div>

				<div v-if="job.job.repeatInterval" class="mb-3">
					<small class="text-muted d-block">Repeat Interval</small>
					<strong>{{ job.job.repeatInterval }}</strong>
					<span v-if="job.job.repeatTimezone" class="text-muted ms-2">({{ job.job.repeatTimezone }})</span>
				</div>

				<div class="mb-3">
					<small class="text-muted d-block">Priority</small>
					<strong>{{ job.job.priority ?? 0 }}</strong>
				</div>

				<div class="mb-3">
					<small class="text-muted d-block mb-1">Job Data</small>
					<pre class="json-editor">{{ formattedData }}</pre>
				</div>

				<div v-if="job.failed" class="alert alert-danger mb-0">
					<div class="row">
						<div class="col-6">
							<small class="d-block">Fail Count</small>
							<strong>{{ job.job.failCount }}</strong>
						</div>
						<div class="col-6">
							<small class="d-block">Failed At</small>
							<strong>{{ formatDateTime(job.job.failedAt) }}</strong>
						</div>
					</div>
					<hr class="my-2" />
					<small class="d-block">Reason</small>
					<code>{{ job.job.failReason }}</code>
				</div>
			</div>

			<!-- Raw Data Tab -->
			<div v-else-if="activeTab === 'raw'">
				<small class="text-muted d-block mb-2">Complete job object (for debugging)</small>
				<pre class="json-editor json-editor-large">{{ rawJob }}</pre>
			</div>
		</div>
		<div class="modal-footer">
			<small class="text-muted me-auto">ID: {{ job.job._id }}</small>
			<button type="button" class="btn btn-secondary" @click="$emit('close')">Close</button>
		</div>
	</div>
</template>

<style scoped>
.tab-nav {
	display: flex;
	border-bottom: 1px solid #e9ecef;
	background: #f8f9fa;
}

.tab-btn {
	padding: 10px 20px;
	border: none;
	background: transparent;
	cursor: pointer;
	font-weight: 500;
	color: #6c757d;
	border-bottom: 2px solid transparent;
	margin-bottom: -1px;
	transition: all 0.15s;
}

.tab-btn:hover {
	color: #293241;
	background: #e9ecef;
}

.tab-btn.active {
	color: #4a6fa5;
	border-bottom-color: #4a6fa5;
	background: white;
}

.json-editor-large {
	max-height: 400px;
}
</style>
