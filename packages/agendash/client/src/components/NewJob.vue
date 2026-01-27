<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
	close: [];
	create: [jobName: string, jobSchedule: string, jobRepeatEvery: string, jobData: unknown];
}>();

const jobName = ref('');
const jobSchedule = ref('');
const jobRepeatEvery = ref('');
const jobData = ref('{}');
const jobDataParseError = ref('');

function clear() {
	jobName.value = '';
	jobSchedule.value = '';
	jobRepeatEvery.value = '';
	jobData.value = '{}';
	jobDataParseError.value = '';
}

function create() {
	let parsedData: unknown;
	try {
		parsedData = JSON.parse(jobData.value);
		jobDataParseError.value = '';
	} catch (err) {
		jobDataParseError.value = err instanceof Error ? err.message : 'Invalid JSON';
		return;
	}

	emit('create', jobName.value, jobSchedule.value, jobRepeatEvery.value, parsedData);
	clear();
}

function cancel() {
	clear();
	emit('close');
}
</script>

<template>
	<div>
		<div class="modal-header">
			<h5 class="modal-title">Create Job</h5>
			<button type="button" class="btn-close" @click="cancel"></button>
		</div>
		<div class="modal-body">
			<form @submit.prevent="create">
				<div class="mb-3">
					<label for="jobname" class="form-label">Job Name <span class="text-danger">*</span></label>
					<input
						id="jobname"
						v-model="jobName"
						type="text"
						class="form-control"
						placeholder="e.g., send-email"
						required
					/>
				</div>
				<div class="mb-3">
					<label for="jobSchedule" class="form-label">Schedule (when to run)</label>
					<input
						id="jobSchedule"
						v-model="jobSchedule"
						type="text"
						class="form-control"
						placeholder="e.g., in 5 minutes"
					/>
					<small class="text-muted">Human interval: "in 5 minutes", "tomorrow at 9am"</small>
				</div>
				<div class="mb-3">
					<label for="jobRepeatEvery" class="form-label">Repeat Every</label>
					<input
						id="jobRepeatEvery"
						v-model="jobRepeatEvery"
						type="text"
						class="form-control"
						placeholder="e.g., 1 hour"
					/>
					<small class="text-muted">Interval: "1 hour", "5 minutes", or cron: "0 * * * *"</small>
				</div>
				<div class="mb-3">
					<label for="jobData" class="form-label">Job Data (JSON)</label>
					<textarea
						id="jobData"
						v-model="jobData"
						class="form-control json-textarea"
						rows="4"
						placeholder='{"key": "value"}'
					></textarea>
					<small v-if="jobDataParseError" class="text-danger">{{ jobDataParseError }}</small>
				</div>
			</form>
		</div>
		<div class="modal-footer">
			<button type="button" class="btn btn-secondary" @click="cancel">Cancel</button>
			<button type="button" class="btn btn-primary" :disabled="!jobName" @click="create">
				Create Job
			</button>
		</div>
	</div>
</template>
