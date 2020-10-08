export const isValidDate = function (date: Date) {
	// An invalid date object returns NaN for getTime() and NaN is the only
	// object not strictly equal to itself.
	// eslint-disable-next-line no-self-compare
	return new Date(date).getTime() === new Date(date).getTime();
};
