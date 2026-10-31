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
	zoomKey: 'shift' | 'control' | 'alt' | 'meta';
	showZoomHint: boolean;
	zoomPercent: number;
	titleTooltipLevel: number;
	zoomedFadeScrollSpeed: number;
	excludedFiles: string[];
}

export const DEFAULT_SETTINGS: NoteMinimapSettings = {
	side: 'right',
	width: 15,
	height: 60,
	yOffset: 5,
	verticalAnchor: 'top',
	showInReadingMode: true,
	zoomKey: 'shift',
	showZoomHint: true,
	zoomPercent: 50,
	titleTooltipLevel: 3,
	zoomedFadeScrollSpeed: 0.25,
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
				desc: 'Offset of the minimap from the top border of the note tab, as a percentage of the note tab height. The offset is applied to the point selected by vertical offset anchor.',
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
				type: 'group',
				heading: 'Zoom',
				cls: 'nm-zoom-group',
				items: [
					{
						name: 'Zoom key',
						desc: 'Modifier key that, while held, zooms the minimap when the pointer is over it.',
						control: {
							type: 'dropdown',
							key: 'zoomKey',
							defaultValue: 'shift',
							options: {
								shift: 'Shift',
								control: 'Control',
								alt: 'Alt',
								meta: 'Meta',
							},
						},
					},
					{
						name: 'Show zoom hint',
						desc: 'When enabled, a hint beside the minimap tells you which key to hold to zoom it.',
						control: {
							type: 'toggle',
							key: 'showZoomHint',
							defaultValue: true,
						},
					},
{
				name: 'Zoom',
				desc: 'Percentage by which the minimap grows while the zoom key is held. The zoomed minimap stays vertically centred and on its configured side.',
				control: {
					type: 'slider',
					key: 'zoomPercent',
					min: 10,
					max: 200,
					step: 5,
					displayFormat: (v) => `${v}%`,
				},
			},
			{
				name: 'Title tooltip level',
				desc: 'Deepest heading level that shows a tooltip while the minimap is zoomed. Level 3 shows tooltips for H1, H2, and H3 titles.',
				control: {
					type: 'slider',
					key: 'titleTooltipLevel',
					min: 1,
					max: 6,
					step: 1,
					displayFormat: (v) => `H${v}`,
				},
			},
			{
				name: 'Zoomed faded-zone scroll speed',
				desc: 'Speed at which the viewport moves while dragging in the faded zones of the zoomed minimap. Lower values move more slowly and precisely.',
				control: {
					type: 'slider',
					key: 'zoomedFadeScrollSpeed',
					min: 0.05,
					max: 1,
					step: 0.05,
					displayFormat: (v) => `${Math.round(v * 100)}%`,
				},
			},
		],
	},
			{
				type: 'group',
				heading: 'Exclusions',
				cls: 'nm-exclusion-group',
				items: [
					{
						name: 'Excluded files and folders',
						desc: 'Paths or glob patterns of files and folders that never show a minimap. Patterns ending with "/" match a folder and everything inside it.',
						render: (setting) => {
							setting.addButton((btn) =>
								btn
									.setButtonText('Add exclusion')
									.setCta()
									.onClick(() => this.openAddExclusionModal()),
							);
							setting.settingEl.addClass('nm-exclusion-setting');
							const tags = setting.settingEl.createDiv({ cls: 'nm-exclusion-tags' });
							this.renderExclusionTags(tags);
							return () => {
								tags.remove();
								setting.settingEl.removeClass('nm-exclusion-setting');
							};
						},
					},
				],
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
		else if (key === 'zoomKey') settings.zoomKey = value as NoteMinimapSettings['zoomKey'];
		else if (key === 'showZoomHint') settings.showZoomHint = value as boolean;
		else if (key === 'zoomPercent') settings.zoomPercent = value as number;
		else if (key === 'zoomedFadeScrollSpeed') settings.zoomedFadeScrollSpeed = value as number;
		else if (key === 'titleTooltipLevel') settings.titleTooltipLevel = value as number;
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

	private renderExclusionTags(container: HTMLElement): void {
		const patterns = this.plugin.settings.excludedFiles;
		if (patterns.length === 0) {
			container.createSpan({ cls: 'nm-exclusion-empty', text: 'No excluded files or folders.' });
			return;
		}
		patterns.forEach((pattern, index) => {
			const tag = container.createSpan({ cls: 'nm-exclusion-tag' });
			tag.createSpan({ cls: 'nm-exclusion-tag-text', text: pattern });
			const removeBtn = tag.createEl('button', {
				cls: 'nm-exclusion-tag-remove',
				text: '×',
				attr: { type: 'button', 'aria-label': 'Remove exclusion' },
			});
			removeBtn.addEventListener('click', () => {
				this.plugin.settings.excludedFiles.splice(index, 1);
				void this.plugin.saveSettings();
				this.plugin.updateSettings();
				this.update();
			});
		});
	}
}
