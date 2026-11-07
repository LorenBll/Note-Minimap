import { describe, expect, it } from 'vitest'
import { globToRegex } from '../src/utils/glob'

describe('globToRegex', () => {
  it('matches an exact file name', () => {
    expect(globToRegex('dashboard.md').test('dashboard.md')).toBe(true)
    expect(globToRegex('dashboard.md').test('other.md')).toBe(false)
  })

  it('matches a folder and everything inside it', () => {
    const re = globToRegex('dashboards/')
    expect(re.test('dashboards')).toBe(true)
    expect(re.test('dashboards/note.md')).toBe(true)
    expect(re.test('other/note.md')).toBe(false)
  })

  it('supports **/ for any number of path segments', () => {
    const re = globToRegex('**/templates/*.md')
    expect(re.test('templates/x.md')).toBe(true)
    expect(re.test('a/b/templates/x.md')).toBe(true)
    expect(re.test('a/b/templates/x.txt')).toBe(false)
  })

  it('treats a single * as within one segment', () => {
    const re = globToRegex('*.md')
    expect(re.test('note.md')).toBe(true)
    expect(re.test('a/note.md')).toBe(false)
  })

  it('escapes regex metacharacters in literals', () => {
    const re = globToRegex('a.b+c.md')
    expect(re.test('a.b+c.md')).toBe(true)
    expect(re.test('axbxc.md')).toBe(false)
  })
})