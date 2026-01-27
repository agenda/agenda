import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
	plugins: [vue()],
	base: './',
	root: resolve(__dirname),
	build: {
		outDir: resolve(__dirname, '../public'),
		emptyOutDir: true,
		rollupOptions: {
			input: resolve(__dirname, 'index.html')
		}
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src')
		}
	},
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true
			}
		}
	}
});
