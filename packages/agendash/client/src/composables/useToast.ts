import { ref } from 'vue';
import type { Toast, ToastType } from '../types';

const toasts = ref<Toast[]>([]);
let nextId = 0;

export function useToast() {
	function show(message: string, type: ToastType = 'success', duration = 3000) {
		const id = nextId++;
		const toast: Toast = { id, message, type };
		toasts.value.push(toast);

		setTimeout(() => {
			remove(id);
		}, duration);
	}

	function remove(id: number) {
		const index = toasts.value.findIndex((t) => t.id === id);
		if (index !== -1) {
			toasts.value.splice(index, 1);
		}
	}

	function success(message: string) {
		show(message, 'success');
	}

	function error(message: string) {
		show(message, 'error');
	}

	function info(message: string) {
		show(message, 'info');
	}

	return {
		toasts,
		show,
		remove,
		success,
		error,
		info
	};
}
