import * as vscode from "vscode"
import { getPos, HSLAToHexA, transpileJSON } from "./utils"
const { readFile } = require("fs").promises

let usedKey = null

let ThemeMap = new Map()
type optionObject = { id: string; path: string }

async function handleFileSelect(themeObjects: Array<optionObject>, extensionConfiguration: vscode.WorkspaceConfiguration) {
  let dialog: Array<vscode.Uri> = await vscode.window.showOpenDialog({
    canSelectMany: true,
    openLabel: "Select theme files",
    filters: {
      "Theme files": ["theme.json"],
    },
  })

  if (dialog.length === 0) return

  let newThemeObjects: Array<optionObject> = dialog.reduce((acc: Array<optionObject>, curr: vscode.Uri) => {
    let key = /([^\\]+)\.theme.json/.exec(curr.fsPath)[1]

    if (!Object.keys(themeObjects).includes(key)) acc.push({ id: key, path: curr.fsPath })
    return acc
  }, [])

  themeObjects = themeObjects.concat(newThemeObjects)

  extensionConfiguration.update("themeObjectPaths", themeObjects, vscode.ConfigurationTarget.Global)

  if (!usedKey) usedKey = themeObjects[0].id

  themeObjects.forEach(({ id, path }) => {
    readFile(path, "utf-8").then((res: string) => {
      ThemeMap.set(id, { path, values: transpileJSON(JSON.parse(res), res) })
    })
  })
}

async function addThemes() {
  const extensionConfiguration = vscode.workspace.getConfiguration("theme-variables-intellisense")
  let themeObjects: Array<optionObject> = extensionConfiguration.get<Array<optionObject>>("themeObjectPaths")

  handleFileSelect(themeObjects, extensionConfiguration)
}

async function getThemeObjects() {
  const extensionConfiguration = vscode.workspace.getConfiguration("theme-variables-intellisense")
  let themeObjects: Array<optionObject> = extensionConfiguration.get<Array<optionObject>>("themeObjectPaths")

  if (themeObjects.length === 0) {
    let notification = await vscode.window.showWarningMessage(
      "Extension found no valid theme objects which this extension can't work without. Would you want to add them now?",
      { id: 0, title: "Yes" },
      { id: 1, title: "Maybe later" }
    )

    if (notification.id == 0) {
      handleFileSelect(themeObjects, extensionConfiguration)
    } else {
      vscode.window.showInformationMessage('Add them anytime by running the "Add color Themes" command')
    }
  } else {
    if (!usedKey) usedKey = themeObjects[0].id

    themeObjects.forEach(({ id, path }) => {
      readFile(path, "utf-8").then((res: string) => {
        ThemeMap.set(id, { path, values: transpileJSON(JSON.parse(res), res) })
      })
    })
  }
}

function getIntellisenseItems(obj: object): Array<vscode.CompletionItem> {
  let res = []

  for (let [key, valueObj] of Object.entries(obj)) {
    let item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Color)
    item.detail = valueObj.value
    res.push(item)
  }

  return res
}

function parseColorString(key: string): vscode.Color {
  let themeObjectKey = ThemeMap.get(usedKey).values[key]
  if (!themeObjectKey) return undefined

  const color = HSLAToHexA(themeObjectKey.value)
  if (!color) return undefined

  let [r, g, b, a] = color

  if (a) return new vscode.Color(r / 255, g / 255, b / 255, a)
  return new vscode.Color(r / 255, g / 255, b / 255, 1)
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
        provideDocumentColors(document: vscode.TextDocument) {
          const matches = Matcher.getMatches(document.getText())

          return matches.map((match, i) => new vscode.ColorInformation(match.range, match.color))
        },
        provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range }) {
          let cssVariable = context.document.getText(context.range)

          let colorValue = ThemeMap.get(usedKey).values[cssVariable].value
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

        return getIntellisenseItems(ThemeMap.get(usedKey).values)
      },
    },
    "("
  )

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    { language: "scss" },
    {
      provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
        let definitionQuarryString = document.getText(document.getWordRangeAtPosition(position))

        const selectedTheme = ThemeMap.get(usedKey)
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

  const changeThemeCommand = vscode.commands.registerCommand("theme-variables-intellisense.changeTheme", async () => {
    vscode.window.showQuickPick([...ThemeMap.keys()], { placeHolder: "Select new theme", canPickMany: false }).then((value) => {
      usedKey = value
    })
  })

  const addThemesCommand = vscode.commands.registerCommand("theme-variables-intellisense.addThemes", addThemes)

  context.subscriptions.push(doubleMinusProvider, definitionProvider, changeThemeCommand, addThemesCommand)

  const picker = new Picker()
  context.subscriptions.push(picker)
}

// this method is called when your extension is deactivated
export function deactivate() {}
