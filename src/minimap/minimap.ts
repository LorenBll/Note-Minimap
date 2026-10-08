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
	private tooltipEl: HTMLElement | null = null;
	private enlarged = false;
	private enlargeFactor = 1;
	private repZoom = 1;
	private pendingBoxes: {
		fw: number;
		fh: number;
		ft: number;
		tw: number;
		th: number;
		tt: number;
	} | null = null;
	private elAnim: Animation | null = null;
	private pendingAnimRaf = 0;
	private manualWindow = false;
	private baseWidth = 0;
	private baseHeight = 0;
	private baseTop = 0;
	private largeWidth = 0;
	private largeHeight = 0;
	private largeTop = 0;

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
		this.cancelEnlargeAnim();
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

	getEnlargeKey(): 'shift' | 'control' | 'alt' | 'meta' {
		return this.plugin.settings.enlargeKey;
	}

	getTitleTooltipLevel(): number {
		return this.plugin.settings.titleTooltipLevel;
	}

	isEnlarged(): boolean {
		return this.enlarged;
	}

	setEnlarged(v: boolean): void {
		if (this.enlarged === v) return;
		const prevZoom = this.enlarged ? this.enlargeFactor : 1;
		const nextZoom = v ? this.enlargeFactor : 1;
		const fromWidth = this.widthPxOf(this.enlarged ? this.largeWidth : this.baseWidth);
		const fromHeight = this.heightPxOf(this.enlarged ? this.largeHeight : this.baseHeight);
		const fromTop = this.enlarged ? this.largeTop : this.baseTop;
		this.enlarged = v;
		this.manualWindow = false;
		this.el.toggleClass('note-minimap-enlarged', v);
		if (!v) this.hideTitleTooltip();
		if (prevZoom !== nextZoom) {
			this.pendingBoxes = {
				fw: fromWidth,
				fh: fromHeight,
				ft: fromTop,
				tw: this.widthPxOf(v ? this.largeWidth : this.baseWidth),
				th: this.heightPxOf(v ? this.largeHeight : this.baseHeight),
				tt: v ? this.largeTop : this.baseTop,
			};
		}
		// Rebuild the strip at the target zoom and set the container to its
		// target size immediately; one animation on the whole minimap element
		// then scales the box, bars, faded sections, and indicator together
		// with no per-element timing to drift.
		this.render();
		this.applySizeStyles();
		this.scheduleRender();
	}

	setManualWindow(v: boolean): void {
		this.manualWindow = v;
	}

	// Scrolls the note so a heading line ends up at the top of the viewport.
	// Returns false when the line is not a clickable title.
	scrollToTitle(i: number): boolean {
		const rep = this.rep;
		const heading = rep?.styles[i]?.heading;
		if (!rep || rep.scale <= 0 || !heading) return false;
		if (heading.level > this.plugin.settings.titleTooltipLevel) return false;
		this.host.scrollToPx((rep.cum[i] ?? 0) / rep.scale);
		this.manualWindow = false;
		this.scheduleRender();
		return true;
	}

	showTitleTooltip(text: string, topPx: number): void {
		const tip = this.tooltipEl ?? this.el.createDiv({ cls: 'note-minimap-title-tooltip' });
		this.tooltipEl = tip;
		if (tip.getText() !== text) tip.setText(text);
		tip.style.top = `${topPx}px`;
		tip.addClass('note-minimap-title-tooltip-visible');
	}

	hideTitleTooltip(): void {
		this.tooltipEl?.removeClass('note-minimap-title-tooltip-visible');
	}

	getHeight(): number {
		return this.el.clientHeight;
	}

	getBaseHeightPx(): number {
		return (this.baseHeight / 100) * Math.max(1, this.view.contentEl.clientHeight);
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
		this.baseWidth = s.width;
		this.baseHeight = heightPct;
		this.baseTop = topPct;
		const factor = 1 + Math.max(0, s.enlargePercent) / 100;
		this.enlargeFactor = factor;
		this.largeWidth = Math.min(100, s.width * factor);
		this.largeHeight = Math.min(100, heightPct * factor);
		this.largeTop = (100 - this.largeHeight) / 2;
		content.setCssProps({ '--nm-width': `${s.width}%` });
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
		this.applySizeStyles();
	}

	private applySizeStyles(): void {
		const width = this.enlarged ? this.largeWidth : this.baseWidth;
		const height = this.enlarged ? this.largeHeight : this.baseHeight;
		const top = this.enlarged ? this.largeTop : this.baseTop;
		this.el.style.width = `${width}%`;
		this.el.style.height = `${height}%`;
		this.el.style.top = `${top}%`;
	}

	private onScroll = (): void => {
		this.scheduleRender();
	};

	private setupResizeObserver(): void {
		this.teardownResizeObserver();
		this.resizeObserver = new ResizeObserver(this.onResize);
		this.resizeObserver.observe(this.view.contentEl);
		this.resizeObserver.observe(this.el);
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
		const zoom = this.enlarged ? this.enlargeFactor : 1;
		if (
			!this.rep ||
			src !== this.lastSource ||
			this.repZoom !== zoom ||
			(!interacting && version !== this.geomVersion)
		) {
			this.rep = buildRepresentation(src, this.host.getLineGeometry(), zoom);
			this.lastSource = src;
			this.geomVersion = version;
			this.repZoom = zoom;
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
		this.applyScaleAnimation();
	}

	// Animates the whole minimap element from the size, top, and zoom shown
	// before an enlargement change to the new ones. Because a single animation
	// scales the entire element, the bars, faded sections, and viewport
	// indicator all grow in lockstep with the border. The enlarged strip is
	// left at its scaled-down starting size for one frame before the animation
	// begins, so the freshly built masked layer is rasterised at that size
	// first and the fade's starting position does not jump on the first frame.
	private applyScaleAnimation(): void {
		const b = this.pendingBoxes;
		if (!b) return;
		this.pendingBoxes = null;
		if (b.tw <= 0 || b.th <= 0) return;
		if (
			Math.abs(b.fw - b.tw) < 0.5 &&
			Math.abs(b.fh - b.th) < 0.5 &&
			Math.abs(b.ft - b.tt) < 0.01
		) {
			return;
		}
		const sx = b.fw / b.tw;
		const sy = b.fh / b.th;
		const ch = Math.max(1, this.view.contentEl.clientHeight);
		const dy = ((b.ft - b.tt) / 100) * ch;
		const originX = this.plugin.settings.side === 'left' ? 0 : b.tw;
		this.cancelEnlargeAnim();
		this.el.style.transformOrigin = `${originX}px 0px`;
		const from = `translateY(${dy}px) scale(${sx}, ${sy})`;
		this.el.style.transform = from;
		this.el.addClass('note-minimap-animating');
		this.pendingAnimRaf = window.requestAnimationFrame(() => {
			this.pendingAnimRaf = 0;
			if (this.disposed) return;
			const anim = this.el.animate(
				[{ transform: from }, { transform: 'none' }],
				{ duration: 240, easing: 'ease', fill: 'both' },
			);
			this.elAnim = anim;
			const cleanup = (): void => {
				if (this.elAnim !== anim) return;
				this.elAnim = null;
				this.el.removeClass('note-minimap-animating');
				this.el.style.removeProperty('transform');
				this.el.style.removeProperty('transform-origin');
			};
			anim.onfinish = cleanup;
			anim.oncancel = cleanup;
		});
	}

	private cancelEnlargeAnim(): void {
		if (this.pendingAnimRaf) {
			window.cancelAnimationFrame(this.pendingAnimRaf);
			this.pendingAnimRaf = 0;
		}
		const anim = this.elAnim;
		if (anim) {
			anim.onfinish = null;
			anim.oncancel = null;
			this.elAnim = null;
			anim.cancel();
			this.el.removeClass('note-minimap-animating');
			this.el.style.removeProperty('transform');
			this.el.style.removeProperty('transform-origin');
		}
	}

	private widthPxOf(pct: number): number {
		return (pct / 100) * Math.max(1, this.view.contentEl.clientWidth);
	}

	private heightPxOf(pct: number): number {
		return (pct / 100) * Math.max(1, this.view.contentEl.clientHeight);
	}

	private targetWidthPx(): number {
		const widthPct = this.enlarged ? this.largeWidth : this.baseWidth;
		return (widthPct / 100) * Math.max(1, this.view.contentEl.clientWidth);
	}

	// The minimap's settled height, so window geometry stays consistent during
	// the enlargement animation instead of chasing the transitioning pixel
	// height and causing the mask and indicator to stutter.
	targetHeightPx(): number {
		const heightPct = this.enlarged ? this.largeHeight : this.baseHeight;
		return (heightPct / 100) * Math.max(1, this.view.contentEl.clientHeight);
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
		const indH = clamp(vpBot - vpTop, MIN_INDICATOR, H);
		const indTop = vpTop - this.winTop;
		// While the enlarged window is panned without moving the note, the
		// indicator stays glued to the motionless viewport's position in the
		// note and is allowed to leave the minimap's bounds.
		if (this.enlarged && this.manualWindow) {
			return { top: indTop, height: indH };
		}
		return { top: clamp(indTop, 0, Math.max(0, H - MIN_INDICATOR)), height: indH };
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
		const W = this.targetWidthPx();
		for (let i = startLine; i <= endLine && i < n; i++) {
			const bar = this.linesEl.createDiv({ cls: `note-minimap-line ${rep.styles[i]?.cls ?? ''}` });
			bar.dataset.line = String(i);
			const top = (rep.cum[i] ?? 0) - this.winTop;
			bar.setCssProps({
				'--nm-line-top': `${top}px`,
				'--nm-line-height': `${rep.sizes[i] ?? 2}px`,
				'--nm-line-width': `${this.barWidth(rep.styles[i]?.len ?? 0, W)}px`,
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
		const winH = this.targetHeightPx();
		// When the enlarged minimap has been panned with the wheel, the strip
		// window stays where the user left it instead of following the
		// viewport.
		if (!this.interaction.isDragging && !this.manualWindow) {
			const maxWin = Math.max(0, this.stripTotal() - winH);
			this.winTop = clamp(this.viewportTopRep() - winH * CONTEXT_ANCHOR, 0, maxWin);
		}
		const maxWin = Math.max(0, this.stripTotal() - winH);
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
			'--nm-fade-bot': `${this.winTop + winH}px`,
			// The gradual fade band scales with the zoom so it always covers the
			// same span of the note and grows proportionally with the minimap.
			'--nm-fade-band': `${40 * (this.enlarged ? this.enlargeFactor : 1)}px`,
		});
		this.renderPadding(true);
		const ind = this.interaction.isDragging
			? this.interaction.dragIndicator
			: this.viewportIndicator(winH);
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

	private barWidth(len: number, W: number): number {
		const zoom = this.enlarged ? this.enlargeFactor : 1;
		return Math.min(W, Math.max(2, len * CHAR_PX * zoom));
	}

	private buildFullStrip(rep: Representation): void {
		this.linesEl.empty();
		const W = this.targetWidthPx();
		for (let i = 0; i < rep.styles.length; i++) {
			const bar = this.linesEl.createDiv({ cls: `note-minimap-line ${rep.styles[i]?.cls ?? ''}` });
			bar.dataset.line = String(i);
			bar.setCssProps({
				'--nm-line-top': `${rep.cum[i] ?? 0}px`,
				'--nm-line-height': `${rep.sizes[i] ?? 2}px`,
				'--nm-line-width': `${this.barWidth(rep.styles[i]?.len ?? 0, W)}px`,
			});
			const heading = rep.styles[i]?.heading;
			if (this.enlarged && heading && heading.text) {
				bar.dataset.heading = heading.text;
				bar.dataset.level = String(heading.level);
			}
		}
	}
}
