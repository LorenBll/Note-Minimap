import {
	AbstractInputSuggest,
	App,
	ButtonComponent,
	Modal,
	TFolder,
	TextComponent,
} from 'obsidian';

class PathSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.limit = 50;
	}

	getSuggestions(query: string): string[] {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		const out: string[] = [];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			const path = file instanceof TFolder ? `${file.path}/` : file.path;
			if (path.toLowerCase().includes(q)) out.push(path);
		}
		return out.slice(0, this.limit || 50);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}
}

export class AddExclusionModal extends Modal {
	private inputEl: HTMLInputElement | null = null;
	private suggest: PathSuggest | null = null;
	private errorTimer = 0;
	private errorInput: HTMLInputElement | null = null;
	private errorTooltip: HTMLElement | null = null;
	private errorScrollContainer: HTMLElement | null = null;

	constructor(
		app: App,
		private onAdd: (pattern: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: 'Add exclusion' });
		contentEl.createEl('p', {
			cls: 'nm-modal-desc',
			text: 'Select a file or folder from the vault, or type a path or glob pattern. Patterns ending with "/" match a folder and everything inside it.',
		});

		const inputWrap = contentEl.createDiv({ cls: 'nm-exclusion-input-wrap' });
		const input = new TextComponent(inputWrap);
		input.setPlaceholder('e.g. dashboards/ or **/templates/*.md');
		input.inputEl.addClass('nm-exclusion-input');
		this.inputEl = input.inputEl;

		this.suggest = new PathSuggest(this.app, input.inputEl);
		this.suggest.onSelect((value) => {
			input.setValue(value);
			input.inputEl.focus();
		});

		input.inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.submit();
			}
		});

		const buttons = contentEl.createDiv({ cls: 'modal-button-container' });
		new ButtonComponent(buttons)
			.setButtonText('Cancel')
			.onClick(() => this.close());
		new ButtonComponent(buttons)
			.setButtonText('Add')
			.setCta()
			.onClick(() => this.submit());
	}

	onClose(): void {
		this.clearError();
		this.suggest?.close();
		this.contentEl.empty();
	}

	private submit(): void {
		const input = this.inputEl;
		if (!input) return;
		const value = input.value.trim();
		if (!value) {
			this.showRequiredError(input, 'Path is required.');
			return;
		}
		this.onAdd(value);
		this.close();
	}

	private getScrollContainer(el: HTMLElement): HTMLElement | null {
		let node: HTMLElement | null = el;
		while (node) {
			const overflowY = window.getComputedStyle(node).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') return node;
			node = node.parentElement;
		}
		return null;
	}

	private onErrorScroll = (): void => {
		const input = this.errorInput;
		const container = this.errorScrollContainer;
		if (!input || !container) return;
		const rect = input.getBoundingClientRect();
		const cRect = container.getBoundingClientRect();
		const visible =
			rect.bottom >= cRect.top &&
			rect.top <= cRect.bottom &&
			rect.right >= cRect.left &&
			rect.left <= cRect.right;
		if (!visible) this.clearError();
	};

	private showRequiredError(input: HTMLInputElement, message: string): void {
		this.clearError();
		const parent = input.parentElement;
		if (!parent) return;
		parent.addClass('nm-validation-relative');
		input.addClass('nm-input-error');

		const tooltip = parent.createDiv({ cls: 'nm-validation-tooltip' });
		tooltip.setText(message);

		const container = this.getScrollContainer(input);
		if (container) {
			this.errorScrollContainer = container;
			container.addEventListener('scroll', this.onErrorScroll);
			const cRect = container.getBoundingClientRect();
			const tRect = tooltip.getBoundingClientRect();
			let left = input.offsetLeft;
			let top = (parent.clientHeight ?? 0) + 4;
			if (tRect.left < cRect.left) left += cRect.left - tRect.left;
			if (tRect.right > cRect.right) left -= tRect.right - cRect.right;
			if (tRect.bottom > cRect.bottom) top -= tRect.bottom - cRect.bottom;
			tooltip.setCssProps({
				'--nm-vt-left': `${left}px`,
				'--nm-vt-top': `${top}px`,
			});
		}

		this.errorInput = input;
		this.errorTooltip = tooltip;

		this.errorTimer = window.setTimeout(() => this.clearError(), 3000);

		input.addEventListener('input', () => this.clearError(), { once: true });
		input.addEventListener('blur', () => this.clearError(), { once: true });
	}

	private clearError(): void {
		window.clearTimeout(this.errorTimer);
		if (this.errorInput) {
			this.errorInput.removeClass('nm-input-error');
			this.errorInput = null;
		}
		if (this.errorTooltip && this.errorTooltip.parentElement) {
			this.errorTooltip.parentElement.removeChild(this.errorTooltip);
		}
		this.errorTooltip = null;
		if (this.errorScrollContainer) {
			this.errorScrollContainer.removeEventListener('scroll', this.onErrorScroll);
			this.errorScrollContainer = null;
		}
	}
}