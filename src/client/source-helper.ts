import { TextDocument, Position } from "vscode";
import { parse, DocumentNode } from "graphql";

export interface ExtractedTemplateLiteral {
  content: string;
  uri: string;
  position: Position;
  ast: DocumentNode;
}

export function extractAllTemplateLiterals(
  document: TextDocument,
  tags: string[] = ["gql"]
): ExtractedTemplateLiteral[] {
  const text = document.getText();
  const documents: any[] = [];

  tags.forEach(tag => {
    // https://regex101.com/r/Pd5PaU/2
    const regExpGQL = new RegExp(tag + "\\s*`([\\s\\S]+?)`", "mg");

    let result;
    while ((result = regExpGQL.exec(text)) !== null) {
      const contents = result[1];

      // https://regex101.com/r/KFMXFg/2
      if (Boolean(contents.match("/${(.+)?}/g"))) {
        // We are ignoring operations with template variables for now
        continue;
      }

      let isLiteralParsableGraphQL = true;
      let ast: DocumentNode | null = null;
      try {
        ast = parse(contents);
      } catch (e) {
        isLiteralParsableGraphQL = false;
      }
      const position = document.positionAt(result.index + 4);
      if (isLiteralParsableGraphQL) {
        documents.push({
          content: contents,
          uri: document.uri.path,
          position: position,
          ast
        });
      }
    }
  });

  return documents;
}
