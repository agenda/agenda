export function getCallerFilePath(position = 2): string | undefined {
	if (position >= Error.stackTraceLimit) {
		throw new TypeError(
			`getCallerFile(position) requires position be less then Error.stackTraceLimit but position was: \`${position}\` and Error.stackTraceLimit was: \`${Error.stackTraceLimit}\``
		);
	}

	const oldPrepareStackTrace = Error.prepareStackTrace;
	Error.prepareStackTrace = (_, stack) => stack;
	// eslint-disable-next-line unicorn/error-message
	const { stack } = new Error();
	Error.prepareStackTrace = oldPrepareStackTrace;

	if (stack !== null && typeof stack === 'object') {
		// stack[0] holds this file
		// stack[1] holds where this function was called
		// stack[2] holds the file we're interested in
		return stack[position] ? (stack[position] as any).getFileName() : undefined;
	}
	return undefined;
}
