import { ApolloLink, Observable } from '@apollo/client';
import { isAsyncIterable } from '@graphql-tools/utils';
import { getOperationAST } from 'graphql';
const ROOT_VALUE = {};
function createMeshApolloRequestHandler(options) {
    return function meshApolloRequestHandler(operation) {
        const operationAst = getOperationAST(operation.query, operation.operationName);
        if (!operationAst) {
            throw new Error('GraphQL operation not found');
        }
        const operationFn = operationAst.operation === 'subscription' ? options.subscribe : options.execute;
        return new Observable(observer => {
            Promise.resolve()
                .then(async () => {
                const results = await operationFn(operation.query, operation.variables, operation.getContext(), ROOT_VALUE, operation.operationName);
                if (isAsyncIterable(results)) {
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
export class MeshApolloLink extends ApolloLink {
    constructor(options) {
        super(createMeshApolloRequestHandler(options));
    }
}
