/// <reference types="node" />
import { ResolverData } from '@graphql-mesh/string-interpolation';
import { SchemaComposer } from 'graphql-compose';
import { Root } from 'protobufjs';
export declare function getTypeName(schemaComposer: SchemaComposer, pathWithName: string[] | undefined, isInput: boolean): string;
export declare function addIncludePathResolver(root: Root, includePaths: string[]): void;
export declare function addMetaDataToCall(callFn: any, input: any, resolverData: ResolverData, metaData: Record<string, string | string[] | Buffer>, isResponseStream?: boolean): Promise<unknown>;
