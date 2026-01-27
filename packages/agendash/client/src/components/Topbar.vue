<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SearchParams } from '../types';

const props = defineProps<{
	currentFilters: Partial<SearchParams>;
}>();

const emit = defineEmits<{
	search: [params: Partial<SearchParams>];
}>();

const name = ref('');
const property = ref('');
const search = ref('');
const isObjectId = ref(false);
const limit = ref(50);
const state = ref('');

// Sync local state with current filters when they change externally (e.g., from sidebar)
watch(
	() => props.currentFilters,
	(filters) => {
		name.value = filters.name || '';
		state.value = filters.state || '';
		property.value = filters.property || '';
		search.value = filters.search || '';
		isObjectId.value = filters.isObjectId || false;
		limit.value = filters.limit || 50;
	},
	{ immediate: true }
);

const stateOptions = [
	{ text: 'All', value: '', class: '' },
	{ text: 'Scheduled', value: 'scheduled', class: '' },
	{ text: 'Queued', value: 'queued', class: 'text-primary' },
	{ text: 'Running', value: 'running', class: 'text-warning' },
	{ text: 'Completed', value: 'completed', class: 'text-success' },
	{ text: 'Failed', value: 'failed', class: 'text-danger' },
	{ text: 'Repeating', value: 'repeating', class: 'text-info' }
];

function submit() {
	emit('search', {
		name: name.value,
		search: search.value,
		property: property.value,
		limit: limit.value,
		skip: 0,
		state: state.value,
		isObjectId: isObjectId.value
	});
}
</script>

<template>
	<form @submit.prevent="submit">
		<div class="row">
			<div class="col-xs-12 col-md-6">
				<div class="input-group mt-2 mb-2">
					<span class="input-group-text">Name</span>
					<input v-model="name" type="text" class="form-control" placeholder="job name" />
				</div>
				<div class="input-group mt-2 mb-2">
					<span class="input-group-text">Property</span>
					<input v-model="property" type="text" class="form-control" placeholder="data.color" />
				</div>
				<div class="input-group mt-2 mb-2">
					<span class="input-group-text">Value</span>
					<input v-model="search" class="form-control" placeholder="green" />
					<div class="form-check mx-2 pt-2">
						<input
							id="isObjectId"
							v-model="isObjectId"
							type="checkbox"
							class="form-check-input"
						/>
						<label class="form-check-label" for="isObjectId">Is ObjectId?</label>
					</div>
				</div>
			</div>
			<div class="col-xs-12 col-md-6">
				<div class="input-group mt-2 mb-2">
					<span class="input-group-text">Page Size</span>
					<input v-model.number="limit" type="number" class="form-control" />
				</div>
				<div class="input-group mt-2 mb-2">
					<span class="input-group-text">State</span>
					<select id="selectStateInput" v-model="state" class="form-select">
						<option
							v-for="option in stateOptions"
							:key="option.value"
							:value="option.value"
							:class="option.class"
						>
							{{ option.text }}
						</option>
					</select>
				</div>
			</div>
		</div>
		<div class="row mb-3">
			<div class="col-xs-12 col-md-3 ms-auto text-end">
				<button type="submit" class="d-none d-md-inline-block btn btn-success">Apply</button>
				<button type="submit" class="d-inline-block d-md-none btn btn-block w-100 btn-success">
					Apply
				</button>
			</div>
		</div>
	</form>
</template>
