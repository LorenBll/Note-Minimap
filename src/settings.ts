import { App, PluginSettingTab, SettingGroup } from 'obsidian';
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
	private settingsScrollEl: HTMLElement | null = null;

	constructor(app: App, plugin: NoteMinimapPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		this.settingsScrollEl = this.getScrollContainer();
		if (this.settingsScrollEl) {
			this.settingsScrollEl.addClass('nm-settings-scroll');
		}
		const scrollTop = this.settingsScrollEl ? this.settingsScrollEl.scrollTop : 0;
		containerEl.empty();

		new SettingGroup(containerEl)
			.addSetting((setting) => {
				setting
					.setName('Minimap side')
					.setDesc('Side of the note tab where the minimap is displayed.')
					.addDropdown((dropdown) => {
						dropdown
							.addOption('right', 'Right')
							.addOption('left', 'Left')
							.setValue(this.plugin.settings.side)
							.onChange((value) => {
								this.plugin.settings.side = value as NoteMinimapSettings['side'];
								this.commit();
							});
					});
			})
			.addSetting((setting) => {
				setting
					.setName('Show minimap in reading mode')
					.setDesc('When enabled, the minimap is displayed in reading mode as well as in editing mode.')
					.addToggle((toggle) => {
						toggle
							.setValue(this.plugin.settings.showInReadingMode)
							.onChange((value) => {
								this.plugin.settings.showInReadingMode = value;
								this.commit();
							});
					});
			})
			.addSetting((setting) => {
				setting
					.setName('Minimap width')
					.setDesc('Width of the minimap as a percentage of the note tab width.')
					.addSlider((slider) => {
						slider
							.setLimits(5, 50, 1)
							.setValue(this.plugin.settings.width)
							.setDisplayFormat((value) => `${value}%`)
							.onChange((value) => {
								this.plugin.settings.width = value;
								this.commit();
							});
					});
			})
			.addSetting((setting) => {
				setting
					.setName('Minimap height')
					.setDesc('Height of the minimap as a percentage of the note tab height. The effective height never exceeds the tab height above the vertical offset.')
					.addSlider((slider) => {
						slider
							.setLimits(10, 100, 1)
							.setValue(this.plugin.settings.height)
							.setDisplayFormat((value) => `${value}%`)
							.onChange((value) => {
								this.plugin.settings.height = value;
								this.commit();
							});
					});
			})
			.addSetting((setting) => {
				setting
					.setName('Vertical offset')
					.setDesc('Offset of the minimap from the top border of the note tab, as a percentage of the note tab height. The offset is applied to the point selected by vertical offset anchor.')
					.addSlider((slider) => {
						slider
							.setLimits(0, 50, 1)
							.setValue(this.plugin.settings.yOffset)
							.setDisplayFormat((value) => `${value}%`)
							.onChange((value) => {
								this.plugin.settings.yOffset = value;
								this.commit();
							});
					});
			})
			.addSetting((setting) => {
				setting
					.setName('Vertical offset anchor')
					.setDesc('Point of the minimap from which the vertical offset is measured: the minimap top, centre, or bottom. The offset is always measured from the top border of the note tab.')
					.addDropdown((dropdown) => {
						dropdown
							.addOption('top', 'Top')
							.addOption('centre', 'Centre')
							.addOption('bottom', 'Bottom')
							.setValue(this.plugin.settings.verticalAnchor)
							.onChange((value) => {
								this.plugin.settings.verticalAnchor = value as NoteMinimapSettings['verticalAnchor'];
								this.commit();
							});
					});
			});

		const exclusionGroup = new SettingGroup(containerEl)
			.setHeading('Exclusions')
			.addClass('nm-exclusion-group');
		exclusionGroup.listEl.addClass('nm-exclusion-list');
		exclusionGroup.addSetting((setting) => {
			setting.settingEl.addClass('nm-exclusion-setting');
			setting
				.setName('Excluded files and folders')
				.setDesc('Paths or glob patterns of files and folders that never show a minimap. Patterns ending with "/" match a folder and everything inside it.')
				.addButton((btn) => {
					btn
						.setButtonText('Add exclusion')
						.setCta()
						.onClick(() => this.openAddExclusionModal());
				});
		});
		this.renderExclusionTags(exclusionGroup.listEl);

		if (this.settingsScrollEl) {
			this.settingsScrollEl.scrollTop = scrollTop;
		}
	}

	hide(): void {
		if (this.settingsScrollEl) {
			this.settingsScrollEl.removeClass('nm-settings-scroll');
			this.settingsScrollEl = null;
		}
		super.hide();
	}

	private commit(): void {
		void this.plugin.saveSettings();
		this.plugin.updateSettings();
	}

	private getScrollContainer(): HTMLElement | null {
		let node: HTMLElement = this.containerEl;
		while (node) {
			const overflowY = window.getComputedStyle(node).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') {
				return node;
			}
			node = node.parentElement as HTMLElement;
		}
		return null;
	}

	private openAddExclusionModal(): void {
		new AddExclusionModal(this.app, (pattern) => {
			this.plugin.settings.excludedFiles.push(pattern);
			void this.plugin.saveSettings();
			this.plugin.updateSettings();
			this.display();
		}).open();
	}

	private renderExclusionTags(listEl: HTMLElement): void {
		const patterns = this.plugin.settings.excludedFiles;
		const tagsContainer = listEl.createDiv({ cls: 'nm-exclusion-tags' });
		if (patterns.length === 0) {
			tagsContainer.createSpan({ cls: 'nm-exclusion-empty', text: 'No excluded files or folders.' });
			return;
		}
		patterns.forEach((pattern, index) => {
			const tag = tagsContainer.createSpan({ cls: 'nm-exclusion-tag' });
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
				this.display();
			});
		});
	}
}