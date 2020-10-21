export function isValidDate(date: unknown): date is Date {
	// An invalid date object returns NaN for getTime() and NaN is the only
	// object not strictly equal to itself.
	// eslint-disable-next-line no-self-compare
	return date !== null && new Date(date as string).getTime() === new Date(date as string).getTime();
}
