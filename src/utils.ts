"use strict"

export function HSLAToHexAString(hsla): string {
  let res = HSLAToHexA(hsla)

  if (!res) return undefined

  let [r, g, b, a] = res

  r = r.toString(16)
  if (r.length == 1) r = "0" + r
  g = g.toString(16)
  if (g.length == 1) g = "0" + g
  b = b.toString(16)
  if (b.length == 1) b = "0" + b
  if (a) {
    a = Math.round(a * 255).toString(16)
    if (a.length == 1) a = "0" + a
  } else a = ""

  return "#" + r + g + b + a
}

export function HSLAToHexA(hsla): [number, number, number, number] | undefined {
  let ex =
    /hsla?\s*?\(\s*?(000|0?\d{1,2}|[1-2]\d\d|3[0-5]\d|360)\s*?,\s*?(000|100|0?\d{2}|0?0?\d)%\s*?,\s*?(000|100|0?\d{2}|0?0?\d)%\s*?,?\s*?(0|0\.\d*|1|1.0*)?\s*?\)/
  if (ex.test(hsla)) {
    hsla = ex.exec(hsla)

    let h = hsla[1],
      s = hsla[2] / 100,
      l = hsla[3] / 100,
      a = hsla[4]

    if (h >= 360) h %= 360 //

    let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2,
      r = 0,
      g = 0,
      b = 0

    if (0 <= h && h < 60) {
      r = c
      g = x
      b = 0
    } else if (60 <= h && h < 120) {
      r = x
      g = c
      b = 0
    } else if (120 <= h && h < 180) {
      r = 0
      g = c
      b = x
    } else if (180 <= h && h < 240) {
      r = 0
      g = x
      b = c
    } else if (240 <= h && h < 300) {
      r = x
      g = 0
      b = c
    } else if (300 <= h && h < 360) {
      r = c
      g = 0
      b = x
    }
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)

    return [r, g, b, a]
  } else {
    return undefined
  }
}
