import { describe, expect, it } from 'vitest'
import { buildRepresentation, lineAt } from '../src/minimap/representation'

describe('buildRepresentation', () => {
  it('splits source into lines and classifies them', () => {
    const rep = buildRepresentation('# Title\n\nhello', null)
    expect(rep.styles).toHaveLength(3)
    expect(rep.styles[0]).toMatchObject({ cls: 'nm-h1' })
    expect(rep.styles[1]).toMatchObject({ cls: 'nm-blank' })
    expect(rep.styles[2]).toMatchObject({ cls: 'nm-text' })
  })

  it('marks leading frontmatter lines', () => {
    const src = '---\ntitle: x\n---\nbody\n'
    const rep = buildRepresentation(src, null)
    expect(rep.styles[0].cls).toBe('nm-frontmatter')
    expect(rep.styles[1].cls).toBe('nm-frontmatter')
    expect(rep.styles[2].cls).toBe('nm-frontmatter')
    expect(rep.styles[3].cls).toBe('nm-text')
  })

  it('uses geometry when provided', () => {
    const src = 'a\nb'
    const geom = { tops: [0, 10], heights: [8, 8], contentHeight: 20, unitHeight: 8 }
    const rep = buildRepresentation(src, geom)
    expect(rep.scale).toBe((2 * 1) / 8)
    expect(rep.cum).toHaveLength(2)
    expect(rep.sizes).toHaveLength(2)
  })

  it('falls back to uniform stripes without geometry', () => {
    const rep = buildRepresentation('a\nb', null)
    expect(rep.cum).toEqual([0, 2])
    expect(rep.sizes).toEqual([2, 2])
    expect(rep.total).toBe(4)
  })
})

describe('lineAt', () => {
  it('returns the line whose cumulative offset is <= pixel', () => {
    expect(lineAt([0, 2, 4], 0)).toBe(0)
    expect(lineAt([0, 2, 4], 1)).toBe(0)
    expect(lineAt([0, 2, 4], 2)).toBe(1)
    expect(lineAt([0, 2, 4], 3)).toBe(1)
    expect(lineAt([0, 2, 4], 4)).toBe(2)
  })

  it('handles an empty array', () => {
    expect(lineAt([], 5)).toBe(0)
  })
})