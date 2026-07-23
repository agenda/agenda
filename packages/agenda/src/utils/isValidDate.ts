export function isValidDate(date: unknown): date is Date {
	// A Date instance is valid only if getTime() returns a finite number.
	return date instanceof Date && Number.isFinite(date.getTime());
}
