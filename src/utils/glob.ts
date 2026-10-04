export function globToRegex(glob: string): RegExp {
	let pattern = glob.trim().replace(/\\/g, '/');
	let folderOnly = false;
	if (pattern.endsWith('/')) {
		folderOnly = true;
		pattern = pattern.slice(0, -1);
	}
	let re = '';
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern.charAt(i);
		if (c === '*') {
			if (pattern.charAt(i + 1) === '*') {
				i++;
				if (pattern.charAt(i + 1) === '/') {
					// "**/" matches zero or more path segments
					i++;
					re += '(?:.*/)?';
				} else {
					re += '.*';
				}
			} else {
				re += '[^/]*';
			}
		} else if (c === '?') {
			re += '[^/]';
		} else {
			re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}
	}
	if (folderOnly) {
		return new RegExp('^' + re + '(?:/.*)?$');
	}
	return new RegExp('^' + re + '$');
}