export interface LineStyle {
	cls: string;
	len: number;
}

export interface Representation {
	styles: LineStyle[];
	cum: number[];
	sizes: number[];
	total: number;
	scale: number;
}

export interface LineGeometry {
	tops: number[];
	heights: number[];
	contentHeight: number;
	unitHeight: number;
}

export const LINE_PX = 2;

export function buildRepresentation(
	source: string,
	geometry: LineGeometry | null,
): Representation {
	const raw = source.replace(/\r\n/g, '\n');
	const lines = raw.split('\n');
	const n = lines.length;
	const frontmatterEnd = frontmatterRange(lines);
	const styles: LineStyle[] = [];
	let inCode = false;
	for (let i = 0; i < n; i++) {
		const line = lines[i] ?? '';
		if (i <= frontmatterEnd) {
			styles.push({ cls: 'nm-frontmatter', len: line.replace(/\t/g, '  ').length });
			continue;
		}
		styles.push(classify(line, inCode));
		if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
	}
	const cum: number[] = [];
	const sizes: number[] = [];
	if (geometry && geometry.tops.length === n && geometry.heights.length === n) {
		const scale = LINE_PX / Math.max(1, geometry.unitHeight);
		for (let i = 0; i < n; i++) {
			cum.push((geometry.tops[i] ?? 0) * scale);
			sizes.push(Math.max(1, (geometry.heights[i] ?? 0) * scale));
		}
		let total = Math.max(0, geometry.contentHeight) * scale;
		const lastBottom = (cum[n - 1] ?? 0) + (sizes[n - 1] ?? LINE_PX);
		if (lastBottom > total) total = lastBottom;
		return { styles, cum, sizes, total, scale };
	}
	let total = 0;
	for (let i = 0; i < n; i++) {
		cum.push(total);
		sizes.push(LINE_PX);
		total += LINE_PX;
	}
	return { styles, cum, sizes, total, scale: 1 };
}

// Returns the index of the last line of a leading YAML frontmatter block, or
// -1 when the source does not start with one.
function frontmatterRange(lines: string[]): number {
	if ((lines[0] ?? '').trim() !== '---') return -1;
	for (let i = 1; i < lines.length; i++) {
		const t = (lines[i] ?? '').trim();
		if (t === '---' || t === '...') return i;
	}
	return -1;
}

function classify(line: string, inCode: boolean): LineStyle {
	const t = line.trim();
	const len = line.replace(/\t/g, '  ').length;
	if (inCode || /^\s*(```|~~~)/.test(t)) return { cls: 'nm-code', len };
	if (t === '') return { cls: 'nm-blank', len: 0 };
	if (/^#{1,6}\s/.test(t)) {
		const level = Math.min(6, t.match(/^#+/)?.length ?? 1);
		return { cls: `nm-h${level}`, len };
	}
	if (/^>\s?/.test(t)) return { cls: 'nm-quote', len };
	if (/^\s*(?:[-*+]|\d+[.)])\s/.test(t)) return { cls: 'nm-list', len };
	if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(t)) return { cls: 'nm-hr', len };
	if (/^\s*(?:==|\*\*|__|`)/.test(t)) return { cls: 'nm-em', len };
	return { cls: 'nm-text', len };
}

export function lineAt(cum: number[], pixel: number): number {
	let lo = 0;
	let hi = cum.length - 1;
	let ans = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if ((cum[mid] ?? 0) <= pixel) {
			ans = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return ans;
}
