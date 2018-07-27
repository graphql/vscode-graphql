import {
  workspace,
  OutputChannel,
  TextDocumentContentProvider,
  EventEmitter,
  Uri,
  Event,
  ProviderResult,
  window
} from "vscode";

import { ExtractedTemplateLiteral } from "./source-helper";
import {
  GraphQLConfig,
  getGraphQLConfig,
  GraphQLProjectConfig
} from "graphql-config";
import { visit, VariableDefinitionNode } from "graphql";
import { executeOperation } from "./network-helper";

async function getVariablesFromUser(
  variableDefinitionNodes: VariableDefinitionNode[]
): Promise<{ [key: string]: string | undefined }> {
  let variables = {};
  for (let node of variableDefinitionNodes) {
    variables = {
      ...variables,
      [`${node.variable.name.value}`]: await window.showInputBox({
        ignoreFocusOut: true,
        placeHolder: `Please enter the value for ${node.variable.name.value}`
      })
    };
  }
  return variables;
}

export class GraphQLContentProvider implements TextDocumentContentProvider {
  private uri: Uri;
  private outputChannel: OutputChannel;

  // Event emitter which invokes document updates
  private _onDidChange = new EventEmitter<Uri>();

  private html: string = ""; // HTML document buffer

  /*
    Use the configration of first project if heuristics failed 
    to find one.
  */
  patchProjectConfig(config: GraphQLConfig) {
    if (!config.config.projects) {
      return config;
    }
    if (config.config.projects) {
      const projectKeys = Object.keys(config.config.projects);
      return config.getProjectConfig(projectKeys[0]);
    }
    return null;
  }

  constructor(
    uri: Uri,
    outputChannel: OutputChannel,
    literal: ExtractedTemplateLiteral
  ) {
    this.uri = uri;
    this.outputChannel = outputChannel;

    try {
      const rootDir = workspace.getWorkspaceFolder(Uri.file(literal.uri));
      if (!rootDir) {
        this.outputChannel.appendLine(
          `Error: this file is outside the workspace.`
        );
        this.html = "Error: this file is outside the workspace.";
        this.update(this.uri);
        return;
      } else {
        const config = getGraphQLConfig(rootDir!.uri.fsPath);
        let projectConfig = config.getConfigForFile(literal.uri);
        if (!projectConfig) {
          projectConfig = this.patchProjectConfig(
            config
          ) as GraphQLProjectConfig;
        }

        if (!projectConfig!.endpointsExtension) {
          this.outputChannel.appendLine(
            `Error: endpoint data missing from graphql config`
          );
          this.html = "Error: endpoint data missing from graphql config";
          this.update(this.uri);
          return;
        }

        const endpointNames = Object.keys(
          projectConfig!.endpointsExtension!.getRawEndpointsMap()
        );
        const endpointName = endpointNames[0];
        const endpoint = projectConfig!.endpointsExtension!.getEndpoint(
          endpointName
        );
        const endpointURL =
          typeof endpoint === "object" ? endpoint.url : endpoint;

        let variableDefinitionNodes: VariableDefinitionNode[] = [];
        visit(literal.ast, {
          VariableDefinition(node: VariableDefinitionNode) {
            variableDefinitionNodes.push(node);
          }
        });

        const updateCallback = (data: string, operation: string) => {
          if (operation === "subscription") {
            this.html = `<pre>${data}</pre>` + this.html;
          } else {
            this.html += `<pre>${data}</pre>`;
          }
          this.update(this.uri);
        };

        if (variableDefinitionNodes.length > 0) {
          getVariablesFromUser(variableDefinitionNodes).then(
            (variables: any) => {
              executeOperation({
                endpoint: endpointURL,
                literal: literal,
                variables: variables,
                updateCallback
              });
            }
          );
        } else {
          executeOperation({
            endpoint: endpointURL,
            literal: literal,
            variables: {},
            updateCallback
          });
        }
      }
    } catch (e) {
      this.html = e.toString();
    }
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public update(uri: Uri) {
    this._onDidChange.fire(uri);
  }

  provideTextDocumentContent(_: Uri): ProviderResult<string> {
    return this.html;
  }
}
