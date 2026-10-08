import type { Minimap } from './minimap';

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

// Enlarged-mode wheel panning is deliberately slow so the minimap window can
// be positioned precisely with each gesture.
const ENLARGED_WHEEL_SPEED = 0.25;

export class MinimapInteraction {
	private dragging = false;
	private hovering = false;
	private keyHeld = false;
	private lastY = 0;
	private lastClientX = 0;
	private lastClientY = 0;
	private pointerId: number | null = null;
	private dragInd = { top: 0, height: 0 };

	constructor(private mm: Minimap) {}

	bind(): void {
		const el = this.mm.el;
		el.addEventListener('pointerdown', this.onPointerDown);
		el.addEventListener('pointermove', this.onPointerMove);
		el.addEventListener('pointerup', this.onPointerUp);
		el.addEventListener('pointercancel', this.onPointerUp);
		el.addEventListener('pointerenter', this.onPointerEnter);
		el.addEventListener('pointerleave', this.onPointerLeave);
		el.addEventListener('wheel', this.onWheel, { passive: false });
		window.addEventListener('keydown', this.onKey, true);
		window.addEventListener('keyup', this.onKey, true);
		window.addEventListener('blur', this.onWindowBlur);
	}

	unbind(): void {
		const el = this.mm.el;
		el.removeEventListener('pointerdown', this.onPointerDown);
		el.removeEventListener('pointermove', this.onPointerMove);
		el.removeEventListener('pointerup', this.onPointerUp);
		el.removeEventListener('pointercancel', this.onPointerUp);
		el.removeEventListener('pointerenter', this.onPointerEnter);
		el.removeEventListener('pointerleave', this.onPointerLeave);
		el.removeEventListener('wheel', this.onWheel);
		window.removeEventListener('keydown', this.onKey, true);
		window.removeEventListener('keyup', this.onKey, true);
		window.removeEventListener('blur', this.onWindowBlur);
	}

	get isDragging(): boolean {
		return this.dragging;
	}

	get isHovering(): boolean {
		return this.hovering;
	}

	get dragIndicator(): { top: number; height: number } {
		return this.dragInd;
	}

	private onPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		e.preventDefault();
		// Clicking a title while the minimap is enlarged jumps the note so the
		// clicked title ends up at the top of the viewport, instead of dragging.
		if (this.mm.isEnlarged()) {
			const raw = e.target instanceof HTMLElement ? e.target.closest('.note-minimap-line') : null;
			const bar = raw instanceof HTMLElement ? raw : null;
			const line = bar ? Number(bar.dataset.line) : NaN;
			if (Number.isFinite(line) && this.mm.scrollToTitle(line)) {
				this.mm.hideTitleTooltip();
				return;
			}
		}
		this.mm.hideTitleTooltip();
		this.dragging = true;
		this.pointerId = e.pointerId;
		try {
			this.mm.el.setPointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		this.lastY = e.clientY;
		this.applyDrag();
	};

	private onPointerMove = (e: PointerEvent): void => {
		this.capturePoint(e);
		if (!this.dragging) {
			this.updateTooltip(e.target);
			return;
		}
		if (e.pointerId !== this.pointerId) return;
		e.preventDefault();
		this.lastY = e.clientY;
		this.applyDrag();
	};

	private onPointerUp = (e: PointerEvent): void => {
		if (e.pointerId !== this.pointerId) return;
		this.dragging = false;
		this.pointerId = null;
		try {
			this.mm.el.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		this.mm.render();
	};

	private onPointerEnter = (e: PointerEvent): void => {
		if (this.hovering) return;
		this.hovering = true;
		this.capturePoint(e);
		this.syncEnlarged();
		this.updateTooltip(e.target);
		this.mm.render();
	};

	private onPointerLeave = (): void => {
		this.hovering = false;
		this.mm.hideTitleTooltip();
		this.syncEnlarged();
		if (!this.dragging) this.mm.render();
	};

	private onKey = (e: KeyboardEvent): void => {
		const held = this.modifierHeld(e);
		if (held === this.keyHeld) return;
		this.keyHeld = held;
		this.syncEnlarged();
	};

	private onWindowBlur = (): void => {
		if (!this.keyHeld) return;
		this.keyHeld = false;
		this.syncEnlarged();
	};

	// The enlarge key configured in settings: only modifier keys are supported,
	// since they can be held on their own without typing a character.
	private modifierHeld(e: KeyboardEvent): boolean {
		switch (this.mm.getEnlargeKey()) {
			case 'control':
				return e.ctrlKey;
			case 'alt':
				return e.altKey;
			case 'meta':
				return e.metaKey;
			default:
				return e.shiftKey;
		}
	}

	private capturePoint(e: PointerEvent): void {
		this.lastClientX = e.clientX;
		this.lastClientY = e.clientY;
	}

	private syncEnlarged(): void {
		this.mm.setEnlarged(this.hovering && this.keyHeld);
		if (this.hovering && this.mm.isEnlarged()) {
			// Run after the scheduled re-render has rebuilt the title bars so
			// the tooltip can appear immediately when the key is pressed.
			window.requestAnimationFrame(() => {
				if (this.hovering && this.mm.isEnlarged()) {
					this.updateTooltip(
						document.elementFromPoint(this.lastClientX, this.lastClientY),
					);
				}
			});
		}
	}

	// While the minimap is enlarged, hovering a title bar at or above the
	// configured title tooltip level shows that title's text beside the bar.
	private updateTooltip(target: EventTarget | null): void {
		if (!this.mm.isEnlarged()) {
			this.mm.hideTitleTooltip();
			return;
		}
		const raw = target instanceof HTMLElement ? target.closest('.note-minimap-line') : null;
		const bar = raw instanceof HTMLElement ? raw : null;
		const text = bar?.dataset.heading;
		const level = bar ? Number(bar.dataset.level) : NaN;
		if (text && Number.isFinite(level) && level <= this.mm.getTitleTooltipLevel()) {
			const elRect = this.mm.el.getBoundingClientRect();
			const barRect = bar.getBoundingClientRect();
			const top = barRect.top - elRect.top + barRect.height / 2;
			this.mm.showTitleTooltip(text, top);
		} else {
			this.mm.hideTitleTooltip();
		}
	}

	private onWheel = (e: WheelEvent): void => {
		const rep = this.mm.getRep();
		if (!rep || rep.scale <= 0) return;
		e.preventDefault();
		if (this.mm.isEnlarged()) {
			// While enlarged, the wheel pans the minimap's own window instead of
			// scrolling the note, so the viewport stays put. The panning is slow
			// so the window can be positioned precisely.
			this.mm.hideTitleTooltip();
			const H = this.mm.targetHeightPx();
			const maxWin = Math.max(0, this.mm.getStripTotal() - H);
			const delta = e.deltaY * ENLARGED_WHEEL_SPEED;
			this.mm.setWinTop(clamp(this.mm.getWinTop() + delta, 0, maxWin));
			this.mm.setManualWindow(true);
			this.mm.render();
			return;
		}
		const delta = (e.deltaY / rep.scale) * this.speedFactor();
		this.mm.scrollToPx(this.mm.getViewportTopPx() + delta);
		this.mm.render();
	};

	private speedFactor(): number {
		const count = Math.max(1, this.mm.getHost().getVisibleLineCount());
		let factor = Math.max(0.25, Math.min(4, count / 20));
		// While the minimap is enlarged, pan faster in proportion to its extra
		// height so the viewport indicator advances the same fraction of the
		// (now taller) window per gesture as it does at normal size.
		const baseH = this.mm.getBaseHeightPx();
		if (baseH > 0) factor *= Math.max(1, this.mm.getHeight() / baseH);
		return factor;
	}

	private applyDrag(): void {
		const H = this.mm.getHeight();
		const rep = this.mm.getRep();
		if (!rep || H <= 0 || rep.scale <= 0) return;
		const rect = this.mm.el.getBoundingClientRect();
		const y = this.lastY - rect.top;
		const yy = clamp(y, 0, H);
		const vpRep = this.mm.getViewportRepHeight();
		const indH = clamp(vpRep, 1, H);
		const dy = this.dampPointerY(y, vpRep);
		const strip = this.mm.getStripTotal();
		const clickRepY = clamp(this.mm.getWinTop() + dy, 0, Math.max(0, strip - 1));
		const topRepY = clickRepY - vpRep / 2;
		const indTop = clamp(yy - indH / 2, 0, Math.max(0, H - indH));
		this.dragInd = { top: indTop, height: indH };
		this.mm.scrollToPx(topRepY / rep.scale);
		const actualTopRep = this.mm.getViewportTopPx() * rep.scale;
		this.mm.setWinTop(clamp(actualTopRep - indTop, 0, Math.max(0, strip - H)));
		this.mm.render();
	}

	// Dampens the pointer position once it reaches the faded edge sections of
	// the minimap, where continued dragging pans the strip. The panning speed is
	// proportionate to the viewport size, so a small viewport pans slowly enough
	// to track the location while a large one moves faster.
	private dampPointerY(y: number, vpRep: number): number {
		const H = this.mm.getHeight();
		if (H <= 0 || vpRep >= H) return y;
		const pinTop = vpRep / 2;
		const pinBottom = H - vpRep / 2;
		const f = this.speedFactor();
		if (y < pinTop) return pinTop + (y - pinTop) * f;
		if (y > pinBottom) return pinBottom + (y - pinBottom) * f;
		return y;
	}
}
