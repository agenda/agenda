<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';

export interface DetailItem {
	label: string;
	value: string;
	type?: 'text' | 'code' | 'json';
}

const props = defineProps<{
	title: string;
	message: string;
	details?: DetailItem[];
	confirmText?: string;
	confirmClass?: string;
	loading?: boolean;
}>();

const emit = defineEmits<{
	confirm: [];
	cancel: [];
}>();

function handleKeydown(e: KeyboardEvent) {
	if (props.loading) return;
	if (e.key === 'Enter') {
		e.preventDefault();
		emit('confirm');
	} else if (e.key === 'Escape') {
		e.preventDefault();
		emit('cancel');
	}
}

onMounted(() => {
	document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener('keydown', handleKeydown);
});

// Separate regular details from JSON details
const regularDetails = computed(() => props.details?.filter(d => d.type !== 'json') ?? []);
const jsonDetails = computed(() => props.details?.filter(d => d.type === 'json') ?? []);
</script>

<template>
	<div>
		<div class="modal-header">
			<h5 class="modal-title">{{ title }}</h5>
			<button type="button" class="btn-close" :disabled="loading" @click="$emit('cancel')"></button>
		</div>
		<div class="modal-body">
			<p class="mb-3">{{ message }}</p>
			<div v-if="regularDetails.length" class="bg-light rounded p-3 mb-3">
				<div v-for="detail in regularDetails" :key="detail.label" class="d-flex justify-content-between mb-1">
					<span class="text-muted">{{ detail.label }}:</span>
					<code v-if="detail.type === 'code'">{{ detail.value }}</code>
					<span v-else>{{ detail.value }}</span>
				</div>
			</div>
			<div v-for="detail in jsonDetails" :key="detail.label">
				<small class="text-muted d-block mb-1">{{ detail.label }}</small>
				<pre class="json-editor json-editor-compact">{{ detail.value }}</pre>
			</div>
		</div>
		<div class="modal-footer">
			<button type="button" class="btn btn-secondary" :disabled="loading" @click="$emit('cancel')">Cancel</button>
			<button type="button" class="btn" :class="confirmClass || 'btn-primary'" :disabled="loading" @click="$emit('confirm')">
				<span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
				{{ confirmText || 'Confirm' }}
			</button>
		</div>
	</div>
</template>

<style scoped>
.json-editor-compact {
	min-height: auto;
	max-height: 150px;
}
</style>
