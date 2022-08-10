import * as vscode from "vscode"
import { HSLAToHexA } from "./utils"
const { readFile, writeFile } = require("fs").promises

const usedKey = "light"

function transpileJSON(obj: object, rawObj: string, lineNumber = { value: 0 }, prefix: string = "--"): any {
  let res = {}

  console.log(lineNumber.value, rawObj.split("\n")[lineNumber.value])
  lineNumber.value++

  for (let [key, value] of Object.entries(obj)) {
    console.log(lineNumber.value, rawObj.split("\n")[lineNumber.value])
    let capitalizedKey = prefix == "--" ? key : key.charAt(0).toUpperCase() + key.slice(1)

    if (typeof value == "string") {
      console.log(rawObj.split("\n")[lineNumber.value], key)

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
  console.log(lineNumber.value, rawObj.split("\n")[lineNumber.value])
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
      console.log(res)
      ThemeObjects.set(key, { path, values: transpileJSON(JSON.parse(res), res) })
    })
  })
}

function getIntellisenseItems(obj: object): Array<vscode.CompletionItem> {
  let res = []

  // for (let [key, value] of Object.entries(obj)) {
  //   console.log(value, HSLAToHexA(value))
  // }

  for (let [key, valueObj] of Object.entries(obj)) {
    let item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Color)
    let documentation = new vscode.MarkdownString(valueObj.value)
    item.detail = HSLAToHexA(valueObj.value)
    item.documentation = documentation
    res.push(item)
  }

  return res
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

        console.log(definitionQuarryString)

        const selectedTheme = ThemeObjects.get(usedKey)
        const definitionQuarryObject = selectedTheme.values[definitionQuarryString]

        console.log(selectedTheme, definitionQuarryObject)

        if (!definitionQuarryObject) return null

        console.log(vscode.Uri.parse(selectedTheme.path))

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
}

// this method is called when your extension is deactivated
export function deactivate() {}
