import type { Minimap } from './minimap';
import { lineAt } from './representation';

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

export class MinimapInteraction {
	private dragging = false;
	private hovering = false;
	private lastY = 0;
	private dragLine = 0;
	private pointerId: number | null = null;

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

	get currentDragLine(): number {
		return this.dragLine;
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
		if (!rep) return;
		e.preventDefault();
		const n = rep.styles.length;
		if (n <= 0) return;
		const range = this.mm.getHost().getVisibleRange();
		const vs = clamp(range.start, 0, n - 1);
		const pxPerLine = rep.styles[0]?.px ?? 2;
		const lineDelta = Math.round(e.deltaY / pxPerLine);
		const target = clamp(vs + lineDelta, 0, n - 1);
		this.dragLine = target;
		this.mm.scrollToLine(target);
		this.mm.render();
	};

	private applyDrag(): void {
		const H = this.mm.getHeight();
		const rep = this.mm.getRep();
		if (!rep || H <= 0) return;
		const rect = this.mm.el.getBoundingClientRect();
		const y = this.lastY - rect.top;
		const yy = clamp(y, 0, H);
		const maxRep = Math.max(0, rep.total - 1);
		const clickRepY = clamp(this.mm.getWinTop() + y, 0, maxRep);
		const count = Math.max(1, this.mm.getHost().getVisibleLineCount());
		const viewportPx = count * (rep.styles[0]?.px ?? 2);
		const topRepY = clickRepY - viewportPx / 2;
		const target = lineAt(rep.cum, clamp(topRepY, 0, maxRep));
		this.dragLine = target;
		this.mm.scrollToLine(target);
		const indH = viewportPx;
		const indTop = clamp(yy - indH / 2, 0, Math.max(0, H - indH));
		this.mm.setWinTop(clamp((rep.cum[target] ?? 0) - indTop, 0, Math.max(0, rep.total - H)));
		this.mm.render();
	}
}