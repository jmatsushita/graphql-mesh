"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshApolloLink = void 0;
const client_1 = require("@apollo/client");
const utils_1 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
const ROOT_VALUE = {};
function createMeshApolloRequestHandler(options) {
    return function meshApolloRequestHandler(operation) {
        const operationAst = (0, graphql_1.getOperationAST)(operation.query, operation.operationName);
        if (!operationAst) {
            throw new Error('GraphQL operation not found');
        }
        const operationFn = operationAst.operation === 'subscription' ? options.subscribe : options.execute;
        return new client_1.Observable(observer => {
            Promise.resolve()
                .then(async () => {
                const results = await operationFn(operation.query, operation.variables, operation.getContext(), ROOT_VALUE, operation.operationName);
                if ((0, utils_1.isAsyncIterable)(results)) {
                    for await (const result of results) {
                        if (observer.closed) {
                            return;
                        }
                        observer.next(result);
                    }
                    observer.complete();
                }
                else {
                    if (!observer.closed) {
                        observer.next(results);
                        observer.complete();
                    }
                }
            })
                .catch(error => {
                if (!observer.closed) {
                    observer.error(error);
                }
            });
        });
    };
}
class MeshApolloLink extends client_1.ApolloLink {
    constructor(options) {
        super(createMeshApolloRequestHandler(options));
    }
}
exports.MeshApolloLink = MeshApolloLink;
