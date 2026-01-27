<script setup lang="ts">
defineProps<{
	title: string;
	message: string;
	details?: Array<{ label: string; value: string }>;
	confirmText?: string;
	confirmClass?: string;
}>();

const emit = defineEmits<{
	confirm: [];
	cancel: [];
}>();
</script>

<template>
	<div>
		<div class="modal-header">
			<h5 class="modal-title">{{ title }}</h5>
			<button type="button" class="btn-close" @click="$emit('cancel')"></button>
		</div>
		<div class="modal-body">
			<p class="mb-3">{{ message }}</p>
			<div v-if="details" class="bg-light rounded p-3">
				<div v-for="detail in details" :key="detail.label" class="d-flex justify-content-between mb-1">
					<span class="text-muted">{{ detail.label }}:</span>
					<code>{{ detail.value }}</code>
				</div>
			</div>
		</div>
		<div class="modal-footer">
			<button type="button" class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
			<button type="button" class="btn" :class="confirmClass || 'btn-primary'" @click="$emit('confirm')">
				{{ confirmText || 'Confirm' }}
			</button>
		</div>
	</div>
</template>
