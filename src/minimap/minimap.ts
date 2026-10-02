import { MarkdownView } from 'obsidian';
import type NoteMinimapPlugin from '../main';
import { EditHost, PreviewHost, type MinimapHost } from './host';
import { buildRepresentation, lineAt, type Representation } from './representation';
import { MinimapInteraction } from './interaction';

const MIN_INDICATOR = 6;
const CHAR_PX = 1.5;

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

export class Minimap {
	readonly el: HTMLElement;
	private host: MinimapHost;
	private linesEl: HTMLElement;
	private viewportEl: HTMLElement;
	private interaction: MinimapInteraction;
	private rep: Representation | null = null;
	private lastSource: string | null = null;
	private winTop = 0;
	private rafId = 0;
	private disposed = false;
	private fullStripSource: string | null = null;

	constructor(
		private plugin: NoteMinimapPlugin,
		private view: MarkdownView,
	) {
		this.host = this.makeHost();
		this.el = view.contentEl.createDiv({ cls: 'note-minimap' });
		this.linesEl = this.el.createDiv({ cls: 'note-minimap-lines' });
		this.viewportEl = this.el.createDiv({ cls: 'note-minimap-viewport' });
		this.interaction = new MinimapInteraction(this);
	}

	private makeHost(): MinimapHost {
		return this.view.getMode() === 'source'
			? new EditHost(this.view)
			: new PreviewHost(this.view);
	}

	attach(): void {
		this.view.contentEl.addClass('note-minimap-host');
		this.host.onScroll(this.onScroll);
		this.interaction.bind();
		this.applyGeometry();
		this.render();
	}

	update(): void {
		if (!this.el.isConnected) {
			this.view.contentEl.appendChild(this.el);
		}
		const mode = this.view.getMode();
		const modeChanged = this.host.isEditMode() !== (mode === 'source');
		if (modeChanged) {
			this.host.offScroll(this.onScroll);
			this.host = this.makeHost();
			this.host.onScroll(this.onScroll);
			this.lastSource = null;
			this.winTop = 0;
		} else {
			this.host.offScroll(this.onScroll);
			this.host.onScroll(this.onScroll);
		}
		this.applyGeometry();
		this.render();
	}

	refresh(): void {
		this.lastSource = null;
		this.render();
	}

	detach(): void {
		this.disposed = true;
		this.host.offScroll(this.onScroll);
		this.interaction.unbind();
		if (this.rafId) window.cancelAnimationFrame(this.rafId);
		this.el.remove();
		const content = this.view.contentEl;
		content.removeClass('note-minimap-host');
		content.removeClass('note-minimap-pad-left');
		content.removeClass('note-minimap-pad-right');
		content.style.removeProperty('--nm-width');
		content.style.removeProperty('--nm-height');
		content.style.removeProperty('--nm-top');
	}

	isAttached(): boolean {
		return this.el.isConnected;
	}

	getRep(): Representation | null {
		return this.rep;
	}

	getHost(): MinimapHost {
		return this.host;
	}

	getHeight(): number {
		return this.el.clientHeight;
	}

	getWinTop(): number {
		return this.winTop;
	}

	setWinTop(v: number): void {
		this.winTop = v;
	}

	scrollToLine(line: number): void {
		this.host.scrollToLine(line);
	}

	private applyGeometry(): void {
		const s = this.plugin.settings;
		const content = this.view.contentEl;
		const maxH = Math.max(80, content.clientHeight - s.yOffset);
		const height = Math.min(s.height, maxH);
		content.setCssProps({
			'--nm-width': `${s.width}px`,
			'--nm-height': `${height}px`,
			'--nm-top': `${s.yOffset}px`,
		});
		if (s.side === 'left') {
			this.el.addClass('note-minimap-left');
			this.el.removeClass('note-minimap-right');
			content.addClass('note-minimap-pad-left');
			content.removeClass('note-minimap-pad-right');
		} else {
			this.el.addClass('note-minimap-right');
			this.el.removeClass('note-minimap-left');
			content.addClass('note-minimap-pad-right');
			content.removeClass('note-minimap-pad-left');
		}
	}

	private onScroll = (): void => {
		this.scheduleRender();
	};

	private scheduleRender(): void {
		if (this.rafId) return;
		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = 0;
			this.render();
		});
	}

	render(): void {
		if (this.disposed) return;
		const src = this.host.getSource();
		if (src !== this.lastSource) {
			this.lastSource = src;
			this.rep = buildRepresentation(src);
			this.winTop = 0;
			this.fullStripSource = null;
		}
		if (!this.rep || this.rep.styles.length === 0) {
			this.linesEl.empty();
			this.viewportEl.hide();
			return;
		}
		const H = this.el.clientHeight;
		if (H <= 0) return;
		if (this.interaction.isDragging || this.interaction.isHovering) this.renderDrag(H);
		else this.renderIdle(H);
	}

	private renderIdle(H: number): void {
		const rep = this.rep;
		if (!rep) return;
		const n = rep.styles.length;
		const range = this.host.getVisibleRange();
		const vs = clamp(range.start, 0, n - 1);
		const maxWin = Math.max(0, rep.total - H);
		this.winTop = clamp((rep.cum[vs] ?? 0) - H * 0.4, 0, maxWin);
		this.el.removeClass('note-minimap-dragging');
		this.fullStripSource = null;
		this.linesEl.setCssProps({
			'--nm-strip-top': '0px',
			'--nm-strip-height': `${H}px`,
		});
		const startLine = lineAt(rep.cum, this.winTop);
		const endLine = lineAt(rep.cum, this.winTop + H);
		this.linesEl.empty();
		const W = this.el.clientWidth;
		for (let i = startLine; i <= endLine; i++) {
			const bar = this.linesEl.createDiv({ cls: `note-minimap-line ${rep.styles[i]?.cls ?? ''}` });
			const top = (rep.cum[i] ?? 0) - this.winTop;
			const width = Math.min(W, Math.max(2, (rep.styles[i]?.len ?? 0) * CHAR_PX));
			bar.setCssProps({
				'--nm-line-top': `${top}px`,
				'--nm-line-height': `${rep.styles[i]?.px ?? 2}px`,
				'--nm-line-width': `${width}px`,
			});
		}
		const ind = this.viewportIndicator(vs, H);
		this.viewportEl.show();
		this.viewportEl.setCssProps({
			'--nm-vp-top': `${ind.top}px`,
			'--nm-vp-height': `${ind.height}px`,
		});
	}

	private renderDrag(H: number): void {
		const rep = this.rep;
		if (!rep) return;
		const n = rep.styles.length;
		if (!this.interaction.isDragging) {
			const range = this.host.getVisibleRange();
			const vs = clamp(range.start, 0, n - 1);
			const maxWin = Math.max(0, rep.total - H);
			this.winTop = clamp((rep.cum[vs] ?? 0) - H * 0.4, 0, maxWin);
		}
		const maxWin = Math.max(0, rep.total - H);
		this.winTop = clamp(this.winTop, 0, maxWin);
		this.el.addClass('note-minimap-dragging');
		if (this.fullStripSource !== this.lastSource) {
			this.buildFullStrip(rep);
			this.fullStripSource = this.lastSource;
		}
		this.linesEl.setCssProps({
			'--nm-strip-top': `${-this.winTop}px`,
			'--nm-strip-height': `${rep.total}px`,
			'--nm-fade-top': `${this.winTop}px`,
			'--nm-fade-bot': `${this.winTop + H}px`,
		});
		const vs2 = this.interaction.isDragging
			? clamp(this.interaction.currentDragLine, 0, n - 1)
			: this.host.getVisibleRange().start;
		const ind = this.viewportIndicator(vs2, H);
		this.viewportEl.show();
		this.viewportEl.setCssProps({
			'--nm-vp-top': `${ind.top}px`,
			'--nm-vp-height': `${ind.height}px`,
		});
	}

	private viewportIndicator(startLine: number, H: number): { top: number; height: number } {
		const rep = this.rep;
		if (!rep) return { top: 0, height: H };
		const n = rep.styles.length;
		const vs = clamp(startLine, 0, n - 1);
		const count = Math.max(1, this.host.getVisibleLineCount());
		const ve = Math.min(n - 1, vs + count - 1);
		const topPx = rep.cum[vs] ?? 0;
		const botPx = (rep.cum[ve] ?? 0) + (rep.styles[ve]?.px ?? 2);
		const indTop = clamp(topPx - this.winTop, 0, H - MIN_INDICATOR);
		const indH = clamp(botPx - topPx, MIN_INDICATOR, H);
		return { top: indTop, height: indH };
	}

	private buildFullStrip(rep: Representation): void {
		this.linesEl.empty();
		const W = this.el.clientWidth;
		for (let i = 0; i < rep.styles.length; i++) {
			const bar = this.linesEl.createDiv({ cls: `note-minimap-line ${rep.styles[i]?.cls ?? ''}` });
			const width = Math.min(W, Math.max(2, (rep.styles[i]?.len ?? 0) * CHAR_PX));
			bar.setCssProps({
				'--nm-line-top': `${rep.cum[i] ?? 0}px`,
				'--nm-line-height': `${rep.styles[i]?.px ?? 2}px`,
				'--nm-line-width': `${width}px`,
			});
		}
	}
}