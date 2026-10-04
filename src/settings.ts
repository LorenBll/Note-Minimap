import { App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type NoteMinimapPlugin from './main';
import { AddExclusionModal } from './ui/add-exclusion-modal';

export interface NoteMinimapSettings {
	side: 'left' | 'right';
	width: number;
	height: number;
	yOffset: number;
	verticalAnchor: 'top' | 'centre' | 'bottom';
	showInReadingMode: boolean;
	excludedFiles: string[];
}

export const DEFAULT_SETTINGS: NoteMinimapSettings = {
	side: 'right',
	width: 15,
	height: 60,
	yOffset: 5,
	verticalAnchor: 'top',
	showInReadingMode: true,
	excludedFiles: [],
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
				name: 'Show minimap in reading mode',
				desc: 'When enabled, the minimap is displayed in reading mode as well as in editing mode.',
				control: {
					type: 'toggle',
					key: 'showInReadingMode',
					defaultValue: true,
				},
			},
			{
				name: 'Minimap width',
				desc: 'Width of the minimap as a percentage of the note tab width.',
				control: {
					type: 'slider',
					key: 'width',
					min: 5,
					max: 50,
					step: 1,
					displayFormat: (v) => `${v}%`,
				},
			},
			{
				name: 'Minimap height',
				desc: 'Height of the minimap as a percentage of the note tab height. The effective height never exceeds the tab height above the vertical offset.',
				control: {
					type: 'slider',
					key: 'height',
					min: 10,
					max: 100,
					step: 1,
					displayFormat: (v) => `${v}%`,
				},
			},
			{
				name: 'Vertical offset',
				desc: 'Offset of the minimap from the top border of the note tab, as a percentage of the note tab height. The offset is applied to the point selected by Vertical offset anchor.',
				control: {
					type: 'slider',
					key: 'yOffset',
					min: 0,
					max: 50,
					step: 1,
					displayFormat: (v) => `${v}%`,
				},
			},
			{
				name: 'Vertical offset anchor',
				desc: 'Point of the minimap from which the vertical offset is measured: the minimap top, centre, or bottom. The offset is always measured from the top border of the note tab.',
				control: {
					type: 'dropdown',
					key: 'verticalAnchor',
					defaultValue: 'top',
					options: {
						top: 'Top',
						centre: 'Centre',
						bottom: 'Bottom',
					},
				},
			},
			{
				type: 'list',
				heading: 'Exclusions',
				emptyState: 'No excluded files or folders.',
				addItem: {
					name: 'Add exclusion',
					action: () => this.openAddExclusionModal(),
				},
				onDelete: (index) => {
					this.plugin.settings.excludedFiles.splice(index, 1);
					void this.plugin.saveSettings();
					this.plugin.updateSettings();
					this.update();
				},
				items: this.plugin.settings.excludedFiles.map((pattern) => ({
					name: pattern,
					searchable: false,
				})),
			},
		];
	}

	setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings;
		if (key === 'side') settings.side = value as NoteMinimapSettings['side'];
		else if (key === 'showInReadingMode') settings.showInReadingMode = value as boolean;
		else if (key === 'width') settings.width = value as number;
		else if (key === 'height') settings.height = value as number;
		else if (key === 'yOffset') settings.yOffset = value as number;
		else if (key === 'verticalAnchor')
			settings.verticalAnchor = value as NoteMinimapSettings['verticalAnchor'];
		this.plugin.updateSettings();
		return this.plugin.saveSettings();
	}

	private openAddExclusionModal(): void {
		new AddExclusionModal(this.app, (pattern) => {
			this.plugin.settings.excludedFiles.push(pattern);
			void this.plugin.saveSettings();
			this.plugin.updateSettings();
			this.update();
		}).open();
	}
}