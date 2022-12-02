export function isValidDate(date: unknown): date is Date {
	// An invalid date object returns NaN for getTime()
	return date !== null && Number.isNaN(new Date(date as string).getTime()) === false;
}
