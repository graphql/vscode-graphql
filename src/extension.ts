"use strict"
import * as path from "path"
import {
  workspace,
  ExtensionContext,
  window,
  commands,
  OutputChannel,
  languages,
  Uri,
  ViewColumn,
} from "vscode"
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient"

import statusBarItem, { initStatusBar } from "./status"

import { GraphQLContentProvider } from "./client/graphql-content-provider"
import { GraphQLCodeLensProvider } from "./client/graphql-codelens-provider"
import { ExtractedTemplateLiteral } from "./client/source-helper"
import { CustomInitializationFailedHandler } from "./CustomInitializationFailedHandler"

function getConfig() {
  return workspace.getConfiguration(
    "vscode-graphql",
    window.activeTextEditor ? window.activeTextEditor.document.uri : null,
  )
}
// we dont need this now that we have common js config files
// if people want template replacement, that's the way
//
// function getEnvironment() {
//   if (workspace.workspaceFolders === undefined) {
//     return process.env
//   }

//   let workspaceEnv = {}
//   workspace.workspaceFolders.forEach(folder => {
//     const envPath = `${folder.uri.fsPath}/.env`
//     if (fs.existsSync(envPath)) {
//       workspaceEnv = {
//         ...workspaceEnv,
//         ...dotenv.parse(fs.readFileSync(envPath)),
//       }
//     }
//   })

//   return { ...workspaceEnv, ...process.env }
// }

export async function activate(context: ExtensionContext) {
  let outputChannel: OutputChannel = window.createOutputChannel(
    "GraphQL Language Server",
  )
  const config = getConfig()
  const { debug } = config
  if (debug) {
    console.log('Extension "vscode-graphql" is now active!')
  }

  const serverModule = context.asAbsolutePath(
    path.join("out/server", "server.js"),
  )

  const debugOptions = {
    execArgv: ["--nolazy", "--inspect=localhost:6009"],
  }

  let serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { ...(debug ? debugOptions : {}) },
    },
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "graphql" },
      { scheme: "file", language: "javascript" },
      { scheme: "file", language: "javascriptreact" },
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "typescriptreact" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        "**/*.{graphql,gql,js,jsx,ts,tsx}",
      ),
    },
    outputChannel: outputChannel,
    outputChannelName: "GraphQL Language Server",
    initializationFailedHandler: CustomInitializationFailedHandler(
      outputChannel,
    ),
  }

  const client = new LanguageClient(
    "vscode-graphql",
    "GraphQL Language Server",
    serverOptions,
    clientOptions,
    debug,
  )

  const disposableClient = client.start()
  context.subscriptions.push(disposableClient)

  const commandIsDebugging = commands.registerCommand(
    "extension.isDebugging",
    () => {
      outputChannel.appendLine(`is in debug mode: ${!!debug}`)
    },
  )
  context.subscriptions.push(commandIsDebugging)

  // Manage Status Bar
  context.subscriptions.push(statusBarItem)
  client.onReady().then(() => {
    initStatusBar(statusBarItem, client, window.activeTextEditor)
  })

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      [
        "javascript",
        "typescript",
        "javascriptreact",
        "typescriptreact",
        "graphql",
      ],
      new GraphQLCodeLensProvider(outputChannel),
    ),
  )

  const commandContentProvider = commands.registerCommand(
    "extension.contentProvider",
    async (literal: ExtractedTemplateLiteral) => {
      const uri = Uri.parse("graphql://authority/graphql")

      const panel = window.createWebviewPanel(
        "executionReusltWebView",
        "GraphQL Execution Result",
        ViewColumn.Two,
        {},
      )

      const contentProvider = new GraphQLContentProvider(
        uri,
        outputChannel,
        literal,
        panel,
      )
      const registration = workspace.registerTextDocumentContentProvider(
        "graphql",
        contentProvider,
      )
      context.subscriptions.push(registration)

      const html = await contentProvider.getCurrentHtml()
      panel.webview.html = html
    },
  )
  context.subscriptions.push(commandContentProvider)
}

export function deactivate() {
  console.log('Extension "vscode-graphql" is now de-active!')
}
