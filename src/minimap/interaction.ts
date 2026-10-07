import type { Minimap } from './minimap';

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

export class MinimapInteraction {
	private dragging = false;
	private hovering = false;
	private lastY = 0;
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
		if (!this.dragging || e.pointerId !== this.pointerId) return;
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

	private onPointerEnter = (): void => {
		if (this.hovering) return;
		this.hovering = true;
		this.mm.render();
	};

	private onPointerLeave = (): void => {
		this.hovering = false;
		if (!this.dragging) this.mm.render();
	};

	private onWheel = (e: WheelEvent): void => {
		const rep = this.mm.getRep();
		if (!rep || rep.scale <= 0) return;
		e.preventDefault();
		const delta = (e.deltaY / rep.scale) * this.speedFactor();
		this.mm.scrollToPx(this.mm.getViewportTopPx() + delta);
		this.mm.render();
	};

	private speedFactor(): number {
		const count = Math.max(1, this.mm.getHost().getVisibleLineCount());
		return Math.max(0.25, Math.min(4, count / 20));
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
