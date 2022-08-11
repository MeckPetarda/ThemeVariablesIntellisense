import * as vscode from "vscode"
import { HSLAToHexA, HSLAToHexAString } from "./utils"
const { readFile, writeFile } = require("fs").promises

const usedKey = "light"

function transpileJSON(obj: object, rawObj: string, lineNumber = { value: 0 }, prefix: string = "--"): any {
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

let ThemeObjects = new Map()

async function getThemeObjects() {
  const extensionConfiguration = vscode.workspace.getConfiguration("theme-variables-intellisense")
  let themeObjectPaths: Array<string> = extensionConfiguration.get("themeObjectPaths")

  if (themeObjectPaths.length === 0) {
    let dialog = vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: "Select theme files",
      filters: {
        "Theme files": ["theme.json"],
      },
    })

    themeObjectPaths = (await dialog).map((e) => e.fsPath)

    extensionConfiguration.update("themeObjectPaths", themeObjectPaths, vscode.ConfigurationTarget.Global)
  }

  if (themeObjectPaths) {
    themeObjectPaths.forEach((e) => console.log("Selected file: " + e))
  }

  themeObjectPaths.forEach((path) => {
    let key = /([^\\]+)\.theme.json/.exec(path)[1]
    readFile(path, "utf-8").then((res: string) => {
      ThemeObjects.set(key, { path, values: transpileJSON(JSON.parse(res), res) })
    })
  })
}

function getIntellisenseItems(obj: object): Array<vscode.CompletionItem> {
  let res = []

  for (let [key, valueObj] of Object.entries(obj)) {
    let item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Color)
    let documentation = new vscode.MarkdownString(valueObj.value)
    item.detail = HSLAToHexAString(valueObj.value)
    item.documentation = documentation
    res.push(item)
  }

  return res
}

function parseColorString(key: string): vscode.Color {
  let themeObjectKey = ThemeObjects.get(usedKey).values[key]

  if (!themeObjectKey) return undefined

  const color = HSLAToHexA(themeObjectKey.value)
  if (!color) return undefined

  let [r, g, b, a] = color

  if (a) return new vscode.Color(r / 255, g / 255, b / 255, a / 255)
  return new vscode.Color(r / 255, g / 255, b / 255, 1)
}

function getPos(text: string, index: number): vscode.Position {
  const nMatches = Array.from(text.slice(0, index).matchAll(/\n/g))

  if (nMatches.length === 0) {
    return new vscode.Position(0, index)
  }

  const lineNumber = nMatches.length
  const characterIndex = index - nMatches[lineNumber - 1].index

  return new vscode.Position(lineNumber, characterIndex - 1)
}

interface Match {
  color: vscode.Color
  type: string
  length: number
  range: vscode.Range
}

class Matcher {
  static getMatches(text: string): Match[] {
    const matches = text.matchAll(/var\((--[^)]+)\)/g)

    return Array.from(matches)
      .map((match) => {
        const t = match[1]

        const range = new vscode.Range(getPos(text, match.index + 4), getPos(text, match.index + 4 + t.length))
        const color = parseColorString(t)

        if (color) {
          return {
            color,
            type: "hsla",
            length: t.length,
            range,
          } as Match
        }
      })
      .filter((match) => match !== undefined)
  }
}

class Picker {
  constructor() {
    this.register()
  }

  private get languages() {
    return ["scss"]
  }

  private register() {
    this.languages.forEach((language) => {
      vscode.languages.registerColorProvider(language, {
        provideDocumentColors(document: vscode.TextDocument, token: vscode.CancellationToken) {
          const matches = Matcher.getMatches(document.getText())

          return matches.map((match, i) => new vscode.ColorInformation(match.range, match.color))
        },
        provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range }, token: vscode.CancellationToken) {
          let cssVariable = context.document.getText(context.range)

          let colorValue = ThemeObjects.get(usedKey).values[cssVariable].value
          if (!colorValue) return undefined

          return new vscode.ColorPresentation(colorValue)
        },
      })
    })
  }

  dispose() {}
}

export function activate(context: vscode.ExtensionContext) {
  getThemeObjects()

  const doubleMinusProvider = vscode.languages.registerCompletionItemProvider(
    { language: "scss" },
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character)
        if (!linePrefix.endsWith("var(")) {
          return undefined
        }

        return getIntellisenseItems(ThemeObjects.get(usedKey).values)
      },
    },
    "("
  )

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    { language: "scss" },
    {
      provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
        let definitionQuarryString = document.getText(document.getWordRangeAtPosition(position))

        const selectedTheme = ThemeObjects.get(usedKey)
        const definitionQuarryObject = selectedTheme.values[definitionQuarryString]

        if (!definitionQuarryObject) return null

        return new vscode.Location(
          vscode.Uri.file(selectedTheme.path),
          new vscode.Range(
            new vscode.Position(definitionQuarryObject.lineNumber, definitionQuarryObject.character),
            new vscode.Position(definitionQuarryObject.lineNumber, definitionQuarryObject.character + definitionQuarryObject.length)
          )
        )
      },
    }
  )

  context.subscriptions.push(doubleMinusProvider, definitionProvider)

  const picker = new Picker()
  context.subscriptions.push(picker)
}

// this method is called when your extension is deactivated
export function deactivate() {}
