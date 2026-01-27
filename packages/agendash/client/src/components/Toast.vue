<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts, remove } = useToast();
</script>

<template>
	<Teleport to="body">
		<div class="toast-container">
			<TransitionGroup name="toast">
				<div
					v-for="toast in toasts"
					:key="toast.id"
					class="toast-item"
					:class="{
						'toast-success': toast.type === 'success',
						'toast-error': toast.type === 'error',
						'toast-info': toast.type === 'info'
					}"
				>
					<span class="flex-grow-1">{{ toast.message }}</span>
					<button type="button" class="btn-close btn-close-sm" @click="remove(toast.id)"></button>
				</div>
			</TransitionGroup>
		</div>
	</Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
	transition: all 0.2s ease;
}

.toast-enter-from {
	opacity: 0;
	transform: translateX(30px);
}

.toast-leave-to {
	opacity: 0;
	transform: translateX(30px);
}

.btn-close-sm {
	font-size: 0.65rem;
	padding: 0.5rem;
}
</style>
