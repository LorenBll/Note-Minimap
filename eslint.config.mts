import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// This tab renders imperatively with SettingGroup so the exclusion
		// section can mirror the sibling plugin's tag-cloud DOM: a declarative
		// render hook cannot place the tag list as a sibling of the setting row
		// (the framework discards group.listEl writes). The imperative refresh
		// and display() calls are intentional and mirror the sibling plugin.
		files: ['src/settings.ts'],
		rules: {
			'obsidianmd/settings-tab/prefer-setting-definitions': 'off',
			'obsidianmd/settings-tab/prefer-update-over-display': 'off',
			'@typescript-eslint/no-deprecated': 'off',
		},
	},
);
