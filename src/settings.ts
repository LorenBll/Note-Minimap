import { App, PluginSettingTab, Setting } from 'obsidian';
import type NoteMinimapPlugin from './main';

export interface NoteMinimapSettings {
	side: 'left' | 'right';
	width: number;
	height: number;
	yOffset: number;
	cursorTarget: 'first' | 'middle' | 'last';
}

export const DEFAULT_SETTINGS: NoteMinimapSettings = {
	side: 'right',
	width: 140,
	height: 400,
	yOffset: 30,
	cursorTarget: 'middle',
};

export class NoteMinimapSettingTab extends PluginSettingTab {
	plugin: NoteMinimapPlugin;

	constructor(app: App, plugin: NoteMinimapPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Minimap side')
			.setDesc('Side of the note tab where the minimap is displayed.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('right', 'Right')
					.addOption('left', 'Left')
					.setValue(this.plugin.settings.side)
					.onChange(async (value) => {
						this.plugin.settings.side = value as NoteMinimapSettings['side'];
						await this.plugin.saveSettings();
						this.plugin.updateSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Minimap width')
			.setDesc('Width of the minimap in pixels.')
			.addSlider((slider) =>
				slider
					.setLimits(80, 400, 5)
					.setValue(this.plugin.settings.width)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.width = value;
						await this.plugin.saveSettings();
						this.plugin.updateSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Minimap height')
			.setDesc('Height of the minimap in pixels.')
			.addSlider((slider) =>
				slider
					.setLimits(120, 2000, 10)
					.setValue(this.plugin.settings.height)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.height = value;
						await this.plugin.saveSettings();
						this.plugin.updateSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Vertical offset')
			.setDesc('Offset of the minimap from the top border of the note tab, in pixels.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 600, 5)
					.setValue(this.plugin.settings.yOffset)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.yOffset = value;
						await this.plugin.saveSettings();
						this.plugin.updateSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Cursor placement')
			.setDesc('Where to place the text caret after navigating in edit or source mode.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('first', 'End of the first paragraph of the viewed section')
					.addOption('middle', 'End of the middle paragraph of the viewed section')
					.addOption('last', 'End of the last paragraph of the viewed section')
					.setValue(this.plugin.settings.cursorTarget)
					.onChange(async (value) => {
						this.plugin.settings.cursorTarget = value as NoteMinimapSettings['cursorTarget'];
						await this.plugin.saveSettings();
					}),
			);
	}
}