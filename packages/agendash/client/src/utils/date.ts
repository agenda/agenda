import { formatDistanceToNow, format, parseISO } from 'date-fns';

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 */
export function formatRelative(date: string | Date | null | undefined): string {
	if (!date) return '';

	const dateObj = typeof date === 'string' ? parseISO(date) : date;

	// Check for invalid date
	if (isNaN(dateObj.getTime())) return '';

	return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Format a date as absolute datetime (e.g., "27-01-2026 14:30:00")
 */
export function formatDateTime(date: string | Date | null | undefined): string {
	if (!date) return '';

	const dateObj = typeof date === 'string' ? parseISO(date) : date;

	// Check for invalid date
	if (isNaN(dateObj.getTime())) return '';

	return format(dateObj, 'dd-MM-yyyy HH:mm:ss');
}

/**
 * Format a date as ISO string for title attributes
 */
export function formatTitle(date: string | Date | null | undefined): string {
	if (!date) return '';

	const dateObj = typeof date === 'string' ? parseISO(date) : date;

	// Check for invalid date
	if (isNaN(dateObj.getTime())) return '';

	return dateObj.toISOString();
}
