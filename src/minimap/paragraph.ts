export function pickParagraph(
	lines: string[],
	vs: number,
	ve: number,
	target: 'first' | 'middle' | 'last',
): number | null {
	if (target === 'middle') {
		const mid = Math.floor((vs + ve) / 2);
		let start = mid;
		if ((lines[mid] ?? '').trim() === '') {
			let p = mid;
			while (p <= ve && (lines[p] ?? '').trim() === '') p++;
			if (p > ve) p = mid;
			start = p;
		}
		while (start > 0 && (lines[start - 1] ?? '').trim() !== '') start--;
		return paragraphEnd(lines, start);
	}
	if (target === 'last') {
		let p = ve;
		while (p > 0 && (lines[p] ?? '').trim() === '') p--;
		if ((lines[p] ?? '').trim() === '') return ve;
		let start = p;
		while (start > 0 && (lines[start - 1] ?? '').trim() !== '') start--;
		return paragraphEnd(lines, start);
	}
	let p = vs;
	while (p <= ve && (lines[p] ?? '').trim() === '') p++;
	if (p > ve) p = vs;
	return paragraphEnd(lines, p);
}

function paragraphEnd(lines: string[], start: number): number {
	let end = start;
	while (end + 1 < lines.length && (lines[end + 1] ?? '').trim() !== '') end++;
	return end;
}