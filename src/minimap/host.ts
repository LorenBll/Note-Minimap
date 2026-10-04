import type { EditorView } from '@codemirror/view';
import { MarkdownView } from 'obsidian';

export interface VisibleRange {
	start: number;
	end: number;
}

export interface MinimapHost {
	isEditMode(): boolean;
	getTotalLines(): number;
	getVisibleRange(): VisibleRange;
	getVisibleLineCount(): number;
	scrollToLine(line: number): void;
	scrollToBottom(): void;
	getBottomPadding(): number;
	getSource(): string;
	getScrollElement(): HTMLElement | null;
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
	private cb: (() => void) | null = null;

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

	getVisibleRange(): VisibleRange {
		const cm = getCM(this.view);
		if (!cm) return { start: 0, end: 0 };
		const sd = cm.scrollDOM;
		const total = cm.state.doc.lines;
		if (total <= 0) return { start: 0, end: 0 };
		const doc = cm.state.doc;
		const lineAtHeight = (h: number): number => {
			const clamped = Math.max(0, Math.min(h, Math.max(0, sd.scrollHeight - 1)));
			try {
				const pos = cm.lineBlockAtHeight(clamped).from;
				return Math.max(0, Math.min(total - 1, doc.lineAt(pos).number - 1));
			} catch {
				return 0;
			}
		};
		const start = lineAtHeight(sd.scrollTop);
		const end = Math.max(start, lineAtHeight(sd.scrollTop + sd.clientHeight));
		return { start, end };
	}

	scrollToLine(line: number): void {
		const cm = getCM(this.view);
		if (!cm) return;
		const doc = cm.state.doc;
		const total = doc.lines;
		const l = Math.max(0, Math.min(line, total - 1));
		const pos = doc.line(l + 1).from;
		const block = cm.lineBlockAt(pos);
		cm.scrollDOM.scrollTop = block.top;
	}

	scrollToBottom(): void {
		const cm = getCM(this.view);
		if (!cm) return;
		cm.scrollDOM.scrollTop = cm.scrollDOM.scrollHeight;
	}

	getBottomPadding(): number {
		const cm = getCM(this.view);
		if (!cm) return 0;
		const contentHeight = cm.contentHeight;
		if (contentHeight <= 0) return 0;
		const padTop = parseFloat(window.getComputedStyle(cm.contentDOM).paddingTop) || 0;
		return Math.max(0, cm.scrollDOM.scrollHeight - contentHeight - padTop);
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
		this.cb = cb;
		el.addEventListener('scroll', cb, { passive: true });
	}

	offScroll(cb: () => void): void {
		if (this.subscribedEl) this.subscribedEl.removeEventListener('scroll', cb);
		this.subscribedEl = null;
		this.cb = null;
	}
}

export class PreviewHost implements MinimapHost {
	private subscribedEl: HTMLElement | null = null;
	private cb: (() => void) | null = null;

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

	getVisibleRange(): VisibleRange {
		const sc = this.scroller();
		const total = this.getTotalLines();
		if (!sc || total <= 1) return { start: 0, end: Math.min(0, total - 1) };
		const max = Math.max(1, sc.scrollHeight - sc.clientHeight);
		const p = Math.max(0, Math.min(1, sc.scrollTop / max));
		const frac = sc.clientHeight / Math.max(1, sc.scrollHeight);
		const start = Math.min(total - 1, Math.floor(p * total));
		const end = Math.min(total - 1, start + Math.max(1, Math.ceil(frac * total)));
		return { start, end };
	}

	scrollToLine(line: number): void {
		const sc = this.scroller();
		const total = this.getTotalLines();
		if (!sc || total <= 1) return;
		const max = sc.scrollHeight - sc.clientHeight;
		const p = Math.max(0, Math.min(1, line / (total - 1)));
		sc.scrollTop = p * max;
	}

	scrollToBottom(): void {
		const sc = this.scroller();
		if (!sc) return;
		sc.scrollTop = sc.scrollHeight;
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
		this.cb = cb;
		el.addEventListener('scroll', cb, { passive: true });
	}

	offScroll(cb: () => void): void {
		if (this.subscribedEl) this.subscribedEl.removeEventListener('scroll', cb);
		this.subscribedEl = null;
		this.cb = null;
	}
}