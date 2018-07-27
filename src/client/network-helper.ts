import { ExtractedTemplateLiteral } from "./source-helper";
import { OperationDefinitionNode } from "graphql";

import ApolloClient from "apollo-client";
import gql from "graphql-tag";
import { WebSocketLink } from "apollo-link-ws";
import { InMemoryCache } from "apollo-cache-inmemory";
import * as ws from "ws";

import { HTTPLinkDataloader } from "http-link-dataloader";

export interface ExecuteOperationOptions {
  endpoint: string;
  literal: ExtractedTemplateLiteral;
  variables: { [key: string]: string };
  updateCallback: (data: string, operation: string) => void;
}

// TODO Handle endpoint authentication
export function executeOperation({
  endpoint,
  literal,
  variables,
  updateCallback
}: ExecuteOperationOptions) {
  const operation = (literal.ast.definitions[0] as OperationDefinitionNode)
    .operation;

  const httpLink = new HTTPLinkDataloader({
    uri: endpoint
  });

  const wsEndpointURL = endpoint.replace(/^http/, "ws");
  const wsLink = new WebSocketLink({
    uri: wsEndpointURL,
    options: {
      reconnect: true
    },
    webSocketImpl: ws
  });

  const apolloClient = new ApolloClient({
    link: operation === "subscription" ? wsLink : httpLink,
    cache: new InMemoryCache()
  });

  const parsedOperation = gql`
    ${literal.content}
  `;

  if (operation === "subscription") {
    apolloClient
      .subscribe({
        query: parsedOperation,
        variables
      })
      .subscribe({
        next(data: {}) {
          updateCallback(JSON.stringify(data, null, 2), operation);
        }
      });
  } else {
    if (operation === "query") {
      apolloClient
        .query({
          query: parsedOperation,
          variables
        })
        .then(data => {
          updateCallback(JSON.stringify(data, null, 2), operation);
        });
    } else {
      apolloClient
        .mutate({
          mutation: parsedOperation,
          variables
        })
        .then(data => {
          updateCallback(JSON.stringify(data, null, 2), operation);
        });
    }
  }
}
