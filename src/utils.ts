import * as vscode from "vscode"

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

export function getPos(text: string, index: number): vscode.Position {
  const nMatches = Array.from(text.slice(0, index).matchAll(/\n/g))

  if (nMatches.length === 0) {
    return new vscode.Position(0, index)
  }

  const lineNumber = nMatches.length
  const characterIndex = index - nMatches[lineNumber - 1].index

  return new vscode.Position(lineNumber, characterIndex - 1)
}

export function transpileJSON(obj: object, rawObj: string, lineNumber = { value: 0 }, prefix: string = "--"): any {
  let res = {}

  lineNumber.value++

  for (let [key, value] of Object.entries(obj)) {
    let capitalizedKey = prefix == "--" ? key : key.charAt(0).toUpperCase() + key.slice(1)

    if (typeof value == "string") {
      res[`${prefix}${capitalizedKey}`] = {
        value,
        lineNumber: lineNumber.value,
        character: rawObj.split("\n")[lineNumber.value].search(key),
        length: key.length,
      }
      lineNumber.value++
    } else {
      res = { ...res, ...transpileJSON(value, rawObj, lineNumber, `${prefix}${capitalizedKey}`) }
    }
  }
  lineNumber.value++

  return res
}
