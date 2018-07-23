"use strict";
import * as path from "path";
import {
  workspace,
  ExtensionContext,
  window,
  commands,
  OutputChannel,
  languages,
  CodeLensProvider,
  TextDocument,
  CancellationToken,
  CodeLens,
  Range,
  Position
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";

import statusBarItem, { initStatusBar } from "./status";

import { parse, OperationDefinitionNode } from "graphql";
import * as capitalize from "capitalize";

function getConfig() {
  return workspace.getConfiguration(
    "vscode-graphql",
    window.activeTextEditor ? window.activeTextEditor.document.uri : null
  );
}

export async function activate(context: ExtensionContext) {
  let outputChannel: OutputChannel = window.createOutputChannel(
    "GraphQL Language Server"
  );
  const config = getConfig();
  const { debug } = config;
  if (debug) {
    console.log('Extension "vscode-graphql" is now active!');
  }

  const serverModule = context.asAbsolutePath(
    path.join("out/server", "server.js")
  );

  const debugOptions = {
    execArgv: ["--nolazy", "--debug=6009", "--inspect=localhost:6009"]
  };

  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debug ? debugOptions : {}
    }
  };

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "graphql" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.{graphql,gql}")
    },
    outputChannel: outputChannel,
    outputChannelName: "GraphQL Language Server"
  };

  const client = new LanguageClient(
    "vscode-graphql",
    "GraphQL Language Server",
    serverOptions,
    clientOptions,
    debug
  );

  const disposableClient = client.start();
  context.subscriptions.push(disposableClient);

  const disposableCommandDebug = commands.registerCommand(
    "extension.isDebugging",
    () => {
      outputChannel.appendLine(`is in debug mode: ${!!debug}`);
    }
  );
  context.subscriptions.push(disposableCommandDebug);

  // Manage Status Bar
  context.subscriptions.push(statusBarItem);
  client.onReady().then(() => {
    initStatusBar(statusBarItem, client, window.activeTextEditor);
  });

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      ["javascript", "typescript", "javascriptreact", "typescriptreact"],
      new GraphQLCodeLensProvider(outputChannel)
    )
  );
}

interface ExtractedTemplateLiteral {
  content: string;
  uri: string;
  position: Position;
}

function extractAllTemplateLiterals(
  document: TextDocument,
  tags: string[] = ["gql"]
): ExtractedTemplateLiteral[] {
  const text = document.getText();
  const documents: any[] = [];

  tags.forEach(tag => {
    const regExp = new RegExp(tag + "\\s*`([\\s\\S]+?)`", "mg");

    let result;
    while ((result = regExp.exec(text)) !== null) {
      const contents = substituteTemplateVariables(result[1]);
      const position = document.positionAt(result.index + 4);
      documents.push({
        content: contents,
        uri: document.uri.path,
        position: position
      });
    }
  });

  return documents;
}

function substituteTemplateVariables(content: string) {
  return content.replace(/\$\{(.+)?\}/g, match => {
    return Array(match.length).join(" ");
  });
}

class GraphQLCodeLensProvider implements CodeLensProvider {
  outputChannel: OutputChannel;
  parser: any;

  constructor(outputChannel: OutputChannel) {
    this.outputChannel = outputChannel;
  }

  public provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): CodeLens[] | Thenable<CodeLens[]> {
    const literals = extractAllTemplateLiterals(document, ["gql", "graphql"]);
    return literals
      .filter(literal => {
        try {
          parse(literal.content);
          return true;
        } catch (e) {
          return false;
        }
      })
      .map(literal => {
        const ast = parse(literal.content);

        return new CodeLens(
          new Range(
            new Position(literal.position.line, 0),
            new Position(literal.position.line, 0)
          ),
          {
            title: `Execute ${capitalize(
              (ast.definitions[0] as OperationDefinitionNode).operation
            )}`,
            command: "extension.isDebugging",
            arguments: [literal.content]
          }
        );
      });
  }
}

export function deactivate() {
  console.log('Extension "vscode-graphql" is now de-active!');
}
