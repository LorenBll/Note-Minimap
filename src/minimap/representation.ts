export interface LineStyle {
	cls: string;
	px: number;
	len: number;
}

export interface Representation {
	styles: LineStyle[];
	cum: number[];
	total: number;
}

const LINE_PX = 2;

export function buildRepresentation(source: string): Representation {
	const raw = source.replace(/\r\n/g, '\n');
	const lines = raw.split('\n');
	const n = lines.length;
	const styles: LineStyle[] = [];
	const cum: number[] = [];
	let total = 0;
	let inCode = false;
	for (let i = 0; i < n; i++) {
		cum.push(total);
		const line = lines[i] ?? '';
		styles.push(classify(line, inCode));
		total += LINE_PX;
		if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
	}
	return { styles, cum, total };
}

function classify(line: string, inCode: boolean): LineStyle {
	const t = line.trim();
	const len = line.replace(/\t/g, '  ').length;
	if (inCode || /^\s*(```|~~~)/.test(t)) return { cls: 'nm-code', px: LINE_PX, len };
	if (t === '') return { cls: 'nm-blank', px: LINE_PX, len: 0 };
	if (/^#{1,6}\s/.test(t)) {
		const level = Math.min(6, t.match(/^#+/)?.length ?? 1);
		return { cls: `nm-h${level}`, px: LINE_PX, len };
	}
	if (/^>\s?/.test(t)) return { cls: 'nm-quote', px: LINE_PX, len };
	if (/^\s*(?:[-*+]|\d+[.)])\s/.test(t)) return { cls: 'nm-list', px: LINE_PX, len };
	if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(t)) return { cls: 'nm-hr', px: LINE_PX, len };
	if (/^\s*(?:==|\*\*|__|`)/.test(t)) return { cls: 'nm-em', px: LINE_PX, len };
	return { cls: 'nm-text', px: LINE_PX, len };
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