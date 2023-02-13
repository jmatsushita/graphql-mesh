"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meshExchange = void 0;
const wonka_1 = require("wonka");
const core_1 = require("@urql/core");
const utils_1 = require("@graphql-tools/utils");
const ROOT_VALUE = {};
const makeExecuteSource = (operation, options) => {
    const operationFn = operation.kind === 'subscription' ? options.subscribe : options.execute;
    const operationName = (0, core_1.getOperationName)(operation.query);
    return (0, wonka_1.make)(observer => {
        let ended = false;
        operationFn(operation.query, operation.variables, operation.context, ROOT_VALUE, operationName)
            .then((result) => {
            if (ended || !result) {
                return;
            }
            else if (!(0, utils_1.isAsyncIterable)(result)) {
                observer.next((0, core_1.makeResult)(operation, result));
                return;
            }
            const iterator = result[Symbol.asyncIterator]();
            let prevResult = null;
            function next({ done, value }) {
                if (value) {
                    observer.next((prevResult = prevResult
                        ? (0, core_1.mergeResultPatch)(prevResult, value)
                        : (0, core_1.makeResult)(operation, value)));
                }
                if (!done && !ended) {
                    return iterator.next().then(next);
                }
                if (ended && iterator.return != null) {
                    return iterator.return();
                }
            }
            return iterator.next().then(next);
        })
            .then(() => {
            observer.complete();
        })
            .catch(error => {
            observer.next((0, core_1.makeErrorResult)(operation, error));
            observer.complete();
        });
        return () => {
            ended = true;
        };
    });
};
/** Exchange for executing queries locally on a schema using graphql-js. */
const meshExchange = (options) => ({ forward }) => {
    return ops$ => {
        const sharedOps$ = (0, wonka_1.share)(ops$);
        const executedOps$ = (0, wonka_1.pipe)(sharedOps$, (0, wonka_1.filter)((operation) => {
            return (operation.kind === 'query' ||
                operation.kind === 'mutation' ||
                operation.kind === 'subscription');
        }), (0, wonka_1.mergeMap)((operation) => {
            const { key } = operation;
            const teardown$ = (0, wonka_1.pipe)(sharedOps$, (0, wonka_1.filter)(op => op.kind === 'teardown' && op.key === key));
            return (0, wonka_1.pipe)(makeExecuteSource(operation, options), (0, wonka_1.takeUntil)(teardown$));
        }));
        const forwardedOps$ = (0, wonka_1.pipe)(sharedOps$, (0, wonka_1.filter)(operation => operation.kind === 'teardown'), forward);
        return (0, wonka_1.merge)([executedOps$, forwardedOps$]);
    };
};
exports.meshExchange = meshExchange;
