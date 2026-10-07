import { MarkdownView } from 'obsidian';
import type NoteMinimapPlugin from '../main';
import { EditHost, PreviewHost, type MinimapHost } from './host';
import { buildRepresentation, lineAt, type Representation } from './representation';
import { MinimapInteraction } from './interaction';

const MIN_INDICATOR = 6;
const CHAR_PX = 1.5;
const CONTEXT_ANCHOR = 0.4;

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
	private geomVersion = '';
	private winTop = 0;
	private rafId = 0;
	private disposed = false;
	private fullStripSource: string | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private paddingEl: HTMLElement | null = null;

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
		this.setupResizeObserver();
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
			this.geomVersion = '';
			this.winTop = 0;
		} else {
			this.host.offScroll(this.onScroll);
			this.host.onScroll(this.onScroll);
		}
		this.setupResizeObserver();
		this.applyGeometry();
		this.render();
	}

	refresh(): void {
		this.lastSource = null;
		this.render();
	}

	detach(): void {
		this.disposed = true;
		this.teardownResizeObserver();
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

	getViewportTopPx(): number {
		return this.host.getViewportTopPx();
	}

	getViewportRepHeight(): number {
		const rep = this.rep;
		return rep ? this.host.getViewportHeightPx() * rep.scale : 0;
	}

	getContentRep(): number {
		return this.rep?.total ?? 0;
	}

	scrollToPx(y: number): void {
		this.host.scrollToPx(y);
	}

	private applyGeometry(): void {
		const s = this.plugin.settings;
		const content = this.view.contentEl;
		const tabH = Math.max(1, content.clientHeight);
		const yOffsetPx = (s.yOffset / 100) * tabH;
		const availPx = (() => {
			switch (s.verticalAnchor) {
				case 'centre':
					return Math.min(2 * yOffsetPx, 2 * (tabH - yOffsetPx));
				case 'bottom':
					return yOffsetPx;
				default:
					return tabH - yOffsetPx;
			}
		})();
		const maxHPx = Math.max(80, availPx);
		const heightPct = Math.min(s.height, (maxHPx / tabH) * 100);
		const topPct = (() => {
			switch (s.verticalAnchor) {
				case 'centre':
					return s.yOffset - heightPct / 2;
				case 'bottom':
					return s.yOffset - heightPct;
				default:
					return s.yOffset;
			}
		})();
		content.setCssProps({
			'--nm-width': `${s.width}%`,
			'--nm-height': `${heightPct}%`,
			'--nm-top': `${topPct}%`,
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

	private setupResizeObserver(): void {
		this.teardownResizeObserver();
		this.resizeObserver = new ResizeObserver(this.onResize);
		this.resizeObserver.observe(this.view.contentEl);
		const scrollEl = this.host.getScrollElement();
		if (scrollEl && scrollEl !== this.view.contentEl) {
			this.resizeObserver.observe(scrollEl);
		}
	}

	private teardownResizeObserver(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	private onResize = (): void => {
		if (this.disposed) return;
		this.applyGeometry();
		this.scheduleRender();
	};

	private scheduleRender(): void {
		if (this.rafId) return;
		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = 0;
			this.render();
		});
	}

	private ensureRep(): Representation {
		const src = this.host.getSource();
		const version = this.host.getGeometryVersion();
		const interacting = this.interaction.isDragging || this.interaction.isHovering;
		if (
			!this.rep ||
			src !== this.lastSource ||
			(!interacting && version !== this.geomVersion)
		) {
			this.rep = buildRepresentation(src, this.host.getLineGeometry());
			this.lastSource = src;
			this.geomVersion = version;
			this.fullStripSource = null;
		}
		return this.rep;
	}

	render(): void {
		if (this.disposed) return;
		const H = this.el.clientHeight;
		if (H <= 0) return;
		const rep = this.ensureRep();
		if (!rep || rep.styles.length === 0) {
			this.linesEl.empty();
			this.viewportEl.hide();
			return;
		}
		if (this.interaction.isDragging || this.interaction.isHovering) this.renderDrag(H);
		else this.renderIdle(H);
	}

	private viewportTopRep(): number {
		const rep = this.rep;
		if (!rep) return 0;
		return this.host.getViewportTopPx() * rep.scale;
	}

	private viewportBottomRep(): number {
		const rep = this.rep;
		if (!rep) return 0;
		const top = this.host.getViewportTopPx();
		const bottom = top + this.host.getViewportHeightPx();
		const content = this.host.getContentHeightPx();
		if (bottom <= content) return bottom * rep.scale;
		const padRep = this.padRep();
		return rep.total + Math.min(padRep, (bottom - content) * rep.scale);
	}

	private viewportIndicator(H: number): { top: number; height: number } {
		const vpTop = this.viewportTopRep();
		const vpBot = this.viewportBottomRep();
		const indTop = clamp(vpTop - this.winTop, 0, Math.max(0, H - MIN_INDICATOR));
		const indH = clamp(vpBot - vpTop, MIN_INDICATOR, H);
		return { top: indTop, height: indH };
	}

	private renderIdle(H: number): void {
		const rep = this.rep;
		if (!rep) return;
		const n = rep.styles.length;
		const maxWin = Math.max(0, this.stripTotal() - H);
		this.winTop = clamp(this.viewportTopRep() - H * CONTEXT_ANCHOR, 0, maxWin);
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
		for (let i = startLine; i <= endLine && i < n; i++) {
			const bar = this.linesEl.createDiv({ cls: `note-minimap-line ${rep.styles[i]?.cls ?? ''}` });
			const top = (rep.cum[i] ?? 0) - this.winTop;
			const width = Math.min(W, Math.max(2, (rep.styles[i]?.len ?? 0) * CHAR_PX));
			bar.setCssProps({
				'--nm-line-top': `${top}px`,
				'--nm-line-height': `${rep.sizes[i] ?? 2}px`,
				'--nm-line-width': `${width}px`,
			});
		}
		this.renderPadding(false);
		const ind = this.viewportIndicator(H);
		this.viewportEl.show();
		this.viewportEl.setCssProps({
			'--nm-vp-top': `${ind.top}px`,
			'--nm-vp-height': `${ind.height}px`,
		});
	}

	private renderDrag(H: number): void {
		const rep = this.rep;
		if (!rep) return;
		if (!this.interaction.isDragging) {
			const maxWin = Math.max(0, this.stripTotal() - H);
			this.winTop = clamp(this.viewportTopRep() - H * CONTEXT_ANCHOR, 0, maxWin);
		}
		const maxWin = Math.max(0, this.stripTotal() - H);
		this.winTop = clamp(this.winTop, 0, maxWin);
		this.el.addClass('note-minimap-dragging');
		if (this.fullStripSource !== this.lastSource) {
			this.buildFullStrip(rep);
			this.fullStripSource = this.lastSource;
		}
		this.linesEl.setCssProps({
			'--nm-strip-top': `${-this.winTop}px`,
			'--nm-strip-height': `${this.stripTotal()}px`,
			'--nm-fade-top': `${this.winTop}px`,
			'--nm-fade-bot': `${this.winTop + H}px`,
		});
		this.renderPadding(true);
		const ind = this.interaction.isDragging
			? this.interaction.dragIndicator
			: this.viewportIndicator(H);
		this.viewportEl.show();
		this.viewportEl.setCssProps({
			'--nm-vp-top': `${ind.top}px`,
			'--nm-vp-height': `${ind.height}px`,
		});
	}

	private padRep(): number {
		const rep = this.rep;
		if (!rep || rep.styles.length === 0) return 0;
		const padReal = this.host.getBottomPadding();
		if (padReal <= 0) return 0;
		return padReal * rep.scale;
	}

	private stripTotal(): number {
		return (this.rep?.total ?? 0) + this.padRep();
	}

	getStripTotal(): number {
		return this.stripTotal();
	}

	private renderPadding(stripCoords: boolean): void {
		const rep = this.rep;
		if (!rep) return;
		const padRep = this.padRep();
		let paddingEl = this.paddingEl;
		if (!paddingEl) {
			paddingEl = this.linesEl.createDiv({ cls: 'note-minimap-padding' });
			this.paddingEl = paddingEl;
		}
		if (padRep <= 0 || rep.styles.length === 0) {
			paddingEl.detach();
			return;
		}
		if (paddingEl.parentElement !== this.linesEl) {
			this.linesEl.appendChild(paddingEl);
		}
		paddingEl.setCssProps({
			'--nm-pad-top': `${stripCoords ? rep.total : rep.total - this.winTop}px`,
			'--nm-pad-height': `${padRep}px`,
		});
	}

	private buildFullStrip(rep: Representation): void {
		this.linesEl.empty();
		const W = this.el.clientWidth;
		for (let i = 0; i < rep.styles.length; i++) {
			const bar = this.linesEl.createDiv({ cls: `note-minimap-line ${rep.styles[i]?.cls ?? ''}` });
			const width = Math.min(W, Math.max(2, (rep.styles[i]?.len ?? 0) * CHAR_PX));
			bar.setCssProps({
				'--nm-line-top': `${rep.cum[i] ?? 0}px`,
				'--nm-line-height': `${rep.sizes[i] ?? 2}px`,
				'--nm-line-width': `${width}px`,
			});
		}
	}
}
