/**
 * Content Security Policy configuration for Agendash
 * Since we now bundle all frontend assets with Vite, we only need 'self'
 */
const CSP: Record<string, string[]> = {
	'default-src': ["'self'"],
	'script-src': ["'self'"],
	'style-src': ["'self'", "'unsafe-inline'"],
	'font-src': ["'self'"],
	'img-src': ["'self'", 'data:']
};

export const cspHeader = Object.entries(CSP)
	.map(([type, values]) => `${type} ${values.join(' ')}`)
	.join('; ');
