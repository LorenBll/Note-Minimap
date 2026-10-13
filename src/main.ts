import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	NoteMinimapSettings,
	NoteMinimapSettingTab,
} from './settings';
import { MinimapManager } from './minimap/manager';
import { globToRegex } from './utils/glob';

export default class NoteMinimapPlugin extends Plugin {
	settings!: NoteMinimapSettings;
	private manager!: MinimapManager;
	private excludedPatterns: RegExp[] = [];
	private excludedPatternsCache = '';

	async onload() {
		await this.loadSettings();
		this.manager = new MinimapManager(this);
		this.addSettingTab(new NoteMinimapSettingTab(this.app, this));
		// Defer attaching the manager until the workspace is ready. Attaching
		// reconciles every open markdown leaf, building a minimap and measuring
		// layout for each, so keeping it out of onload avoids blocking startup.
		this.app.workspace.onLayoutReady(() => {
			this.manager.attach();
		});
	}

	onunload() {
		this.manager?.detach();
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<NoteMinimapSettings> & {
			enlargeKey?: NoteMinimapSettings['zoomKey'];
			enlargePercent?: number;
		};
		// Migrate the pre-1.3.1 "enlarge" settings to their "zoom" names.
		if (data.enlargeKey !== undefined && data.zoomKey === undefined) {
			data.zoomKey = data.enlargeKey;
		}
		if (data.enlargePercent !== undefined && data.zoomPercent === undefined) {
			data.zoomPercent = data.enlargePercent;
		}
		delete data.enlargeKey;
		delete data.enlargePercent;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		if (this.settings.height > 100) {
			// Migrate 1.0.x pixel-based dimensions to percentage-based dimensions.
			this.settings.width = DEFAULT_SETTINGS.width;
			this.settings.height = DEFAULT_SETTINGS.height;
			this.settings.yOffset = DEFAULT_SETTINGS.yOffset;
		}
		this.compileExcludedPatterns();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateSettings() {
		this.manager?.updateSettings();
	}

	isExcluded(filePath: string): boolean {
		if (!this.settings.excludedFiles || this.settings.excludedFiles.length === 0) {
			return false;
		}
		const cacheKey = JSON.stringify(this.settings.excludedFiles);
		if (cacheKey !== this.excludedPatternsCache) {
			this.compileExcludedPatterns();
			this.excludedPatternsCache = cacheKey;
		}
		return this.excludedPatterns.some((re) => re.test(filePath));
	}

	private compileExcludedPatterns() {
		this.excludedPatterns = (this.settings.excludedFiles || [])
			.map((pattern) => {
				const trimmed = pattern.trim();
				if (!trimmed) return null;
				try {
					return globToRegex(trimmed);
				} catch {
					return null;
				}
			})
			.filter((re): re is RegExp => re !== null);
	}
}