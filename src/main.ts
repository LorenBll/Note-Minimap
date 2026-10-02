import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	NoteMinimapSettings,
	NoteMinimapSettingTab,
} from './settings';
import { MinimapManager } from './minimap/manager';

export default class NoteMinimapPlugin extends Plugin {
	settings!: NoteMinimapSettings;
	private manager!: MinimapManager;

	async onload() {
		await this.loadSettings();
		this.manager = new MinimapManager(this);
		this.manager.attach();
		this.addSettingTab(new NoteMinimapSettingTab(this.app, this));
	}

	onunload() {
		this.manager?.detach();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NoteMinimapSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateSettings() {
		this.manager?.updateSettings();
	}
}