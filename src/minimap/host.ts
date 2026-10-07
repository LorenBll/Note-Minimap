import type { EditorView } from '@codemirror/view';
import { MarkdownView } from 'obsidian';
import type { LineGeometry } from './representation';

export interface MinimapHost {
	isEditMode(): boolean;
	getTotalLines(): number;
	getVisibleLineCount(): number;
	getBottomPadding(): number;
	getSource(): string;
	getScrollElement(): HTMLElement | null;
	getLineGeometry(): LineGeometry | null;
	getGeometryVersion(): string;
	getViewportTopPx(): number;
	getViewportHeightPx(): number;
	getContentHeightPx(): number;
	scrollToPx(y: number): void;
	onScroll(cb: () => void): void;
	offScroll(cb: () => void): void;
}

function getCM(view: MarkdownView): EditorView | null {
	try {
		return (view.editor as unknown as { cm?: EditorView }).cm ?? null;
	} catch {
		return null;
	}
}

export class EditHost implements MinimapHost {
	private subscribedEl: HTMLElement | null = null;

	constructor(private view: MarkdownView) {}

	isEditMode(): boolean {
		return true;
	}

	getScrollElement(): HTMLElement | null {
		return getCM(this.view)?.scrollDOM ?? null;
	}

	getTotalLines(): number {
		return getCM(this.view)?.state.doc.lines ?? 0;
	}

	getVisibleLineCount(): number {
		const cm = getCM(this.view);
		if (!cm) return 1;
		const lineHeight = cm.defaultLineHeight || 20;
		return Math.max(1, Math.round(cm.scrollDOM.clientHeight / lineHeight));
	}

	private padding(cm: EditorView): { top: number; bottom: number } {
		return cm.documentPadding;
	}

	// Distance from the scroll container's top edge to the top of the first
	// line, in scroll coordinates. This covers the editor's content padding
	// plus any surrounding offset introduced by Obsidian.
	private topOffset(cm: EditorView): number {
		const sd = cm.scrollDOM;
		const rect = sd.getBoundingClientRect();
		const offset = cm.documentTop - rect.top + sd.scrollTop;
		return Number.isFinite(offset) ? Math.max(0, offset) : 0;
	}

	private contentHeightPx(cm: EditorView): number {
		const pad = this.padding(cm);
		const docHeight = Math.max(0, cm.contentHeight - pad.top - pad.bottom);
		return Math.max(1, this.topOffset(cm) + docHeight);
	}

	// Returns the 0-based index of the last line of a leading YAML frontmatter
	// block, or -1 when the document does not start with one.
	private frontmatterLastLine(cm: EditorView): number {
		const doc = cm.state.doc;
		if (doc.line(1).text.trim() !== '---') return -1;
		for (let ln = 2; ln <= doc.lines; ln++) {
			const t = doc.line(ln).text.trim();
			if (t === '---' || t === '...') return ln - 1;
		}
		return -1;
	}

	// Region occupied by the rendered properties UI, in scroll coordinates, or
	// null when the properties are shown as source or not rendered.
	private propertiesRegion(cm: EditorView): { top: number; bottom: number } | null {
		const el = this.view.contentEl.querySelector('.metadata-container');
		if (!(el instanceof HTMLElement)) return null;
		const rect = el.getBoundingClientRect();
		if (rect.height <= 0) return null;
		const sd = cm.scrollDOM;
		const scRect = sd.getBoundingClientRect();
		return {
			top: rect.top - scRect.top + sd.scrollTop,
			bottom: rect.bottom - scRect.top + sd.scrollTop,
		};
	}

	getBottomPadding(): number {
		const cm = getCM(this.view);
		if (!cm) return 0;
		return Math.max(0, cm.scrollDOM.scrollHeight - this.contentHeightPx(cm));
	}

	getLineGeometry(): LineGeometry | null {
		const cm = getCM(this.view);
		if (!cm) return null;
		try {
			const doc = cm.state.doc;
			const n = doc.lines;
			const top = this.topOffset(cm);
			const from: number[] = new Array<number>(n);
			const rawTop: number[] = new Array<number>(n);
			const rawHeight: number[] = new Array<number>(n);
			for (let i = 0; i < n; i++) {
				const block = cm.lineBlockAt(doc.line(i + 1).from);
				from[i] = block.from;
				rawTop[i] = block.top;
				rawHeight[i] = block.height;
			}
			const tops: number[] = new Array<number>(n);
			const heights: number[] = new Array<number>(n);
			// Several source lines can belong to one collapsed block (for
			// example the rendered YAML properties widget). Distribute such a
			// block's height evenly over its lines so they map to distinct
			// positions instead of overlapping.
			let i = 0;
			while (i < n) {
				let j = i;
				while (j + 1 < n && from[j + 1] === from[i]) j++;
				const slice = (rawHeight[i] ?? 0) / (j - i + 1);
				for (let k = i; k <= j; k++) {
					tops[k] = top + (rawTop[i] ?? 0) + (k - i) * slice;
					heights[k] = slice;
				}
				i = j + 1;
			}
			// When properties are rendered (not shown as source), Obsidian hides
			// the frontmatter lines with a zero-height decoration and draws the
			// properties UI in a sibling element above the editor. Place the
			// frontmatter lines across that element's region so they are visible
			// instead of leaving a blank gap. When the YAML is shown as source
			// the region is absent and the measured heights are used as-is.
			const fmLast = this.frontmatterLastLine(cm);
			if (fmLast >= 0) {
				const region = this.propertiesRegion(cm);
				let fmTop = -1;
				let fmBottom = -1;
				if (region) {
					fmTop = region.top;
					fmBottom = region.bottom;
				} else {
					let collapsedHeight = 0;
					for (let k = 0; k <= fmLast; k++) collapsedHeight += rawHeight[k] ?? 0;
					if (collapsedHeight < (cm.defaultLineHeight || 20) * 0.5) {
						fmTop = 0;
						fmBottom = top;
					}
				}
				if (fmTop >= 0 && fmBottom > fmTop) {
					const count = fmLast + 1;
					const slice = (fmBottom - fmTop) / count;
					for (let k = 0; k <= fmLast; k++) {
						tops[k] = fmTop + k * slice;
						heights[k] = slice;
					}
				}
			}
			return {
				tops,
				heights,
				contentHeight: this.contentHeightPx(cm),
				unitHeight: cm.defaultLineHeight || 20,
			};
		} catch {
			return null;
		}
	}

	getGeometryVersion(): string {
		const cm = getCM(this.view);
		if (!cm) return '';
		return `${cm.state.doc.lines}|${cm.contentDOM.clientWidth}|${Math.round(cm.contentHeight)}|${Math.round(this.topOffset(cm))}`;
	}

	getViewportTopPx(): number {
		const cm = getCM(this.view);
		return cm ? cm.scrollDOM.scrollTop : 0;
	}

	getViewportHeightPx(): number {
		const cm = getCM(this.view);
		return cm ? cm.scrollDOM.clientHeight : 0;
	}

	getContentHeightPx(): number {
		const cm = getCM(this.view);
		return cm ? this.contentHeightPx(cm) : 0;
	}

	scrollToPx(y: number): void {
		const cm = getCM(this.view);
		if (!cm) return;
		const sd = cm.scrollDOM;
		sd.scrollTop = Math.max(0, Math.min(y, sd.scrollHeight - sd.clientHeight));
	}

	getSource(): string {
		try {
			return this.view.editor.getValue();
		} catch {
			return '';
		}
	}

	onScroll(cb: () => void): void {
		const el = this.getScrollElement();
		if (!el) return;
		this.subscribedEl = el;
		el.addEventListener('scroll', cb, { passive: true });
	}

	offScroll(cb: () => void): void {
		if (this.subscribedEl) this.subscribedEl.removeEventListener('scroll', cb);
		this.subscribedEl = null;
	}
}

export class PreviewHost implements MinimapHost {
	private subscribedEl: HTMLElement | null = null;

	constructor(private view: MarkdownView) {}

	private scroller(): HTMLElement | null {
		return this.view.contentEl.querySelector('.markdown-preview-view');
	}

	isEditMode(): boolean {
		return false;
	}

	getScrollElement(): HTMLElement | null {
		return this.scroller();
	}

	getTotalLines(): number {
		return this.getSource().split('\n').length;
	}

	getVisibleLineCount(): number {
		const sc = this.scroller();
		const total = this.getTotalLines();
		if (!sc || total <= 0) return 1;
		const frac = sc.clientHeight / Math.max(1, sc.scrollHeight);
		return Math.max(1, Math.round(frac * total));
	}

	getBottomPadding(): number {
		const sc = this.scroller();
		if (!sc) return 0;
		const scTop = sc.getBoundingClientRect().top;
		const sizer = sc.querySelector('.markdown-preview-sizer');
		const section = sizer?.querySelector('.markdown-preview-section');
		const root = (section ?? sizer ?? sc) as HTMLElement;
		const last = root.lastElementChild as HTMLElement | null;
		if (!last) return 0;
		const contentBottom = last.getBoundingClientRect().bottom - scTop;
		return Math.max(0, sc.scrollHeight - contentBottom);
	}

	getLineGeometry(): LineGeometry | null {
		const sc = this.scroller();
		const total = this.getTotalLines();
		if (!sc || total <= 0) return null;
		const contentHeight = Math.max(1, sc.scrollHeight - this.getBottomPadding());
		const unit = contentHeight / total;
		const tops: number[] = new Array<number>(total);
		const heights: number[] = new Array<number>(total);
		for (let i = 0; i < total; i++) {
			tops[i] = i * unit;
			heights[i] = unit;
		}
		return { tops, heights, contentHeight, unitHeight: unit };
	}

	getGeometryVersion(): string {
		const sc = this.scroller();
		if (!sc) return '';
		return `${sc.scrollHeight}|${sc.clientWidth}`;
	}

	getViewportTopPx(): number {
		const sc = this.scroller();
		return sc ? sc.scrollTop : 0;
	}

	getViewportHeightPx(): number {
		const sc = this.scroller();
		return sc ? sc.clientHeight : 0;
	}

	getContentHeightPx(): number {
		const sc = this.scroller();
		if (!sc) return 0;
		return Math.max(1, sc.scrollHeight - this.getBottomPadding());
	}

	scrollToPx(y: number): void {
		const sc = this.scroller();
		if (!sc) return;
		sc.scrollTop = Math.max(0, Math.min(y, sc.scrollHeight - sc.clientHeight));
	}

	getSource(): string {
		try {
			return this.view.getViewData();
		} catch {
			return '';
		}
	}

	onScroll(cb: () => void): void {
		const el = this.scroller();
		if (!el) return;
		this.subscribedEl = el;
		el.addEventListener('scroll', cb, { passive: true });
	}

	offScroll(cb: () => void): void {
		if (this.subscribedEl) this.subscribedEl.removeEventListener('scroll', cb);
		this.subscribedEl = null;
	}
}
