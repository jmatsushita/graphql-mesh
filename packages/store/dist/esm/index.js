import { fs, path as pathModule } from '@graphql-mesh/cross-helpers';
import { writeFile } from '@graphql-mesh/utils';
import { CriticalityLevel, diff } from '@graphql-inspector/core';
import { getDocumentNodeFromSchema, AggregateError } from '@graphql-tools/utils';
import { buildASTSchema } from 'graphql';
export class ReadonlyStoreError extends Error {
}
export class ValidationError extends Error {
}
export class InMemoryStoreStorageAdapter {
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
export class FsStoreStorageAdapter {
    constructor(options) {
        this.options = options;
    }
    getAbsolutePath(jsFileName) {
        return pathModule.isAbsolute(jsFileName)
            ? jsFileName
            : pathModule.join(this.options.cwd, jsFileName);
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
        await writeFile(filePath, asString);
        await this.options.importFn(this.options.fileType !== 'ts' ? filePath : modulePath);
    }
    async delete(key) {
        const filePath = this.getAbsolutePath(key) + '.' + this.options.fileType;
        return fs.promises.unlink(filePath);
    }
}
export var PredefinedProxyOptionsName;
(function (PredefinedProxyOptionsName) {
    PredefinedProxyOptionsName["JsonWithoutValidation"] = "JsonWithoutValidation";
    PredefinedProxyOptionsName["StringWithoutValidation"] = "StringWithoutValidation";
    PredefinedProxyOptionsName["GraphQLSchemaWithDiffing"] = "GraphQLSchemaWithDiffing";
})(PredefinedProxyOptionsName || (PredefinedProxyOptionsName = {}));
export const PredefinedProxyOptions = {
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

const schemaAST = ${JSON.stringify(getDocumentNodeFromSchema(schema), null, 2)};

export default buildASTSchema(schemaAST, {
  assumeValid: true,
  assumeValidSDL: true
});
    `.trim(),
        fromJSON: schemaAST => buildASTSchema(schemaAST, { assumeValid: true, assumeValidSDL: true }),
        toJSON: schema => getDocumentNodeFromSchema(schema),
        validate: async (oldSchema, newSchema) => {
            const changes = await diff(oldSchema, newSchema);
            const errors = [];
            for (const change of changes) {
                if (change.criticality.level === CriticalityLevel.Breaking ||
                    change.criticality.level === CriticalityLevel.Dangerous) {
                    errors.push(change.message);
                }
            }
            if (errors.length) {
                if (errors.length === 1) {
                    throw errors[0];
                }
                else {
                    throw new AggregateError(errors);
                }
            }
        },
    },
};
export class MeshStore {
    constructor(identifier, storage, flags) {
        this.identifier = identifier;
        this.storage = storage;
        this.flags = flags;
    }
    child(childIdentifier, flags) {
        return new MeshStore(pathModule.join(this.identifier, childIdentifier), this.storage, {
            ...this.flags,
            ...flags,
        });
    }
    proxy(id, options) {
        const path = pathModule.join(this.identifier, id);
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
