import { App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
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

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Minimap side',
				desc: 'Side of the note tab where the minimap is displayed.',
				control: {
					type: 'dropdown',
					key: 'side',
					defaultValue: 'right',
					options: {
						right: 'Right',
						left: 'Left',
					},
				},
			},
			{
				name: 'Minimap width',
				desc: 'Width of the minimap in pixels.',
				control: {
					type: 'slider',
					key: 'width',
					min: 80,
					max: 400,
					step: 5,
				},
			},
			{
				name: 'Minimap height',
				desc: 'Height of the minimap in pixels.',
				control: {
					type: 'slider',
					key: 'height',
					min: 120,
					max: 2000,
					step: 10,
				},
			},
			{
				name: 'Vertical offset',
				desc: 'Offset of the minimap from the top border of the note tab, in pixels.',
				control: {
					type: 'slider',
					key: 'yOffset',
					min: 0,
					max: 600,
					step: 5,
				},
			},
			{
				name: 'Cursor placement',
				desc: 'Where to place the text caret after navigating in edit or source mode.',
				control: {
					type: 'dropdown',
					key: 'cursorTarget',
					defaultValue: 'middle',
					options: {
						first: 'End of the first paragraph of the viewed section',
						middle: 'End of the middle paragraph of the viewed section',
						last: 'End of the last paragraph of the viewed section',
					},
				},
			},
		];
	}

	setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings;
		if (key === 'side') settings.side = value as NoteMinimapSettings['side'];
		else if (key === 'width') settings.width = value as number;
		else if (key === 'height') settings.height = value as number;
		else if (key === 'yOffset') settings.yOffset = value as number;
		else if (key === 'cursorTarget') settings.cursorTarget = value as NoteMinimapSettings['cursorTarget'];
		this.plugin.updateSettings();
		return this.plugin.saveSettings();
	}
}