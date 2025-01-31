"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshStore = exports.PredefinedProxyOptions = exports.PredefinedProxyOptionsName = exports.FsStoreStorageAdapter = exports.InMemoryStoreStorageAdapter = exports.ValidationError = exports.ReadonlyStoreError = void 0;
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const utils_1 = require("@graphql-mesh/utils");
const core_1 = require("@graphql-inspector/core");
const utils_2 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
class ReadonlyStoreError extends Error {
}
exports.ReadonlyStoreError = ReadonlyStoreError;
class ValidationError extends Error {
}
exports.ValidationError = ValidationError;
class InMemoryStoreStorageAdapter {
    constructor() {
        this.data = new Map();
    }
    async read(key, options) {
        return this.data.get(key);
    }
    async write(key, data, options) {
        this.data.set(key, data);
    }
    async delete(key) {
        this.data.delete(key);
    }
    clear() {
        this.data.clear();
    }
}
exports.InMemoryStoreStorageAdapter = InMemoryStoreStorageAdapter;
class FsStoreStorageAdapter {
    constructor(options) {
        this.options = options;
    }
    getAbsolutePath(jsFileName) {
        return cross_helpers_1.path.isAbsolute(jsFileName)
            ? jsFileName
            : cross_helpers_1.path.join(this.options.cwd, jsFileName);
    }
    async read(key, options) {
        let absoluteModulePath = this.getAbsolutePath(key);
        if (this.options.fileType !== 'ts') {
            absoluteModulePath += '.' + this.options.fileType;
        }
        try {
            const importedData = await this.options
                .importFn(absoluteModulePath)
                .then(m => m.default || m);
            if (this.options.fileType === 'json') {
                return await options.fromJSON(importedData, key);
            }
            return importedData;
        }
        catch (e) {
            if (e.message.startsWith('Cannot find module')) {
                return undefined;
            }
            throw e;
        }
    }
    async write(key, data, options) {
        const asString = this.options.fileType === 'json'
            ? JSON.stringify(await options.toJSON(data, key))
            : `// @ts-nocheck\n` + (await options.codify(data, key));
        const modulePath = this.getAbsolutePath(key);
        const filePath = modulePath + '.' + this.options.fileType;
        await (0, utils_1.writeFile)(filePath, asString);
        await this.options.importFn(this.options.fileType !== 'ts' ? filePath : modulePath);
    }
    async delete(key) {
        const filePath = this.getAbsolutePath(key) + '.' + this.options.fileType;
        return cross_helpers_1.fs.promises.unlink(filePath);
    }
}
exports.FsStoreStorageAdapter = FsStoreStorageAdapter;
var PredefinedProxyOptionsName;
(function (PredefinedProxyOptionsName) {
    PredefinedProxyOptionsName["JsonWithoutValidation"] = "JsonWithoutValidation";
    PredefinedProxyOptionsName["StringWithoutValidation"] = "StringWithoutValidation";
    PredefinedProxyOptionsName["GraphQLSchemaWithDiffing"] = "GraphQLSchemaWithDiffing";
})(PredefinedProxyOptionsName = exports.PredefinedProxyOptionsName || (exports.PredefinedProxyOptionsName = {}));
exports.PredefinedProxyOptions = {
    JsonWithoutValidation: {
        codify: v => `export default ${JSON.stringify(v, null, 2)}`,
        fromJSON: v => v,
        toJSON: v => v,
        validate: () => null,
    },
    StringWithoutValidation: {
        codify: v => `export default ${JSON.stringify(v, null, 2)}`,
        fromJSON: v => v,
        toJSON: v => v,
        validate: () => null,
    },
    GraphQLSchemaWithDiffing: {
        codify: schema => `
import { buildASTSchema } from 'graphql';

const schemaAST = ${JSON.stringify((0, utils_2.getDocumentNodeFromSchema)(schema), null, 2)};

export default buildASTSchema(schemaAST, {
  assumeValid: true,
  assumeValidSDL: true
});
    `.trim(),
        fromJSON: schemaAST => (0, graphql_1.buildASTSchema)(schemaAST, { assumeValid: true, assumeValidSDL: true }),
        toJSON: schema => (0, utils_2.getDocumentNodeFromSchema)(schema),
        validate: async (oldSchema, newSchema) => {
            const changes = await (0, core_1.diff)(oldSchema, newSchema);
            const errors = [];
            for (const change of changes) {
                if (change.criticality.level === core_1.CriticalityLevel.Breaking ||
                    change.criticality.level === core_1.CriticalityLevel.Dangerous) {
                    errors.push(change.message);
                }
            }
            if (errors.length) {
                if (errors.length === 1) {
                    throw errors[0];
                }
                else {
                    throw new utils_2.AggregateError(errors);
                }
            }
        },
    },
};
class MeshStore {
    constructor(identifier, storage, flags) {
        this.identifier = identifier;
        this.storage = storage;
        this.flags = flags;
    }
    child(childIdentifier, flags) {
        return new MeshStore(cross_helpers_1.path.join(this.identifier, childIdentifier), this.storage, {
            ...this.flags,
            ...flags,
        });
    }
    proxy(id, options) {
        const path = cross_helpers_1.path.join(this.identifier, id);
        let value;
        let isValueCached = false;
        const ensureValueCached = async () => {
            if (!isValueCached) {
                value = await this.storage.read(path, options);
                isValueCached = true;
            }
        };
        const doValidation = async (newValue) => {
            await ensureValueCached();
            if (value && newValue) {
                try {
                    await options.validate(value, newValue, id);
                }
                catch (e) {
                    throw new ValidationError(`Validation failed for "${id}" under "${this.identifier}": ${e.message}`);
                }
            }
        };
        const proxy = {
            getWithSet: async (setterFn) => {
                await ensureValueCached();
                if (this.flags.validate || !value) {
                    const newValue = await setterFn();
                    if (this.flags.validate && this.flags.readonly) {
                        await doValidation(newValue);
                    }
                    if (!this.flags.readonly) {
                        await proxy.set(newValue);
                    }
                }
                return value;
            },
            get: async () => {
                await ensureValueCached();
                return value;
            },
            set: async (newValue) => {
                if (this.flags.readonly) {
                    throw new ReadonlyStoreError(`Unable to set value for "${id}" under "${this.identifier}" because the store is in read-only mode.`);
                }
                if (this.flags.validate) {
                    await doValidation(newValue);
                }
                value = newValue;
                isValueCached = true;
                await this.storage.write(path, value, options);
            },
            delete: () => this.storage.delete(path),
        };
        return proxy;
    }
}
exports.MeshStore = MeshStore;
