/**
 * Content Security Policy configuration for Agendash
 */
const CSP: Record<string, string[]> = {
	'default-src': ["'self'"],
	'script-src': [
		'https://code.jquery.com',
		'https://cdn.jsdelivr.net',
		'https://cdnjs.cloudflare.com',
		'https://stackpath.bootstrapcdn.com',
		"'unsafe-inline'",
		"'unsafe-eval'",
		"'self'"
	],
	'style-src': [
		'https://cdn.jsdelivr.net',
		'https://stackpath.bootstrapcdn.com',
		'https://fonts.googleapis.com',
		'https://unpkg.com',
		"'unsafe-inline'",
		"'self'"
	],
	'font-src': ['https://fonts.gstatic.com'],
	'img-src': ["'self'", 'data:']
};

export const cspHeader = Object.entries(CSP)
	.map(([type, values]) => `${type} ${values.join(' ')}`)
	.join('; ');
