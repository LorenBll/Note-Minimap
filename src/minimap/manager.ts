import { MarkdownView } from 'obsidian';
import type NoteMinimapPlugin from '../main';
import { Minimap } from './minimap';

export class MinimapManager {
	private minimaps = new Map<MarkdownView, Minimap>();

	constructor(private plugin: NoteMinimapPlugin) {}

	attach(): void {
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('layout-change', () => this.reconcile()),
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('file-open', () => this.reconcile()),
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('editor-change', (_editor, info) => {
				const view = info instanceof MarkdownView ? info : null;
				const mm = view ? this.minimaps.get(view) : undefined;
				if (mm) mm.refresh();
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on('modify', (file) => {
				for (const [view, mm] of this.minimaps) {
					if (view.file === file) mm.refresh();
				}
			}),
		);
		this.reconcile();
	}

	detach(): void {
		for (const mm of this.minimaps.values()) mm.detach();
		this.minimaps.clear();
	}

	updateSettings(): void {
		for (const mm of this.minimaps.values()) mm.update();
	}

	private reconcile(): void {
		const seen = new Set<MarkdownView>();
		for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			seen.add(view);
			let mm = this.minimaps.get(view);
			if (!mm || !mm.isAttached()) {
				if (mm) mm.detach();
				mm = new Minimap(this.plugin, view);
				this.minimaps.set(view, mm);
				mm.attach();
			} else {
				mm.update();
			}
		}
		for (const [view, mm] of this.minimaps) {
			if (!seen.has(view)) {
				mm.detach();
				this.minimaps.delete(view);
			}
		}
	}
}