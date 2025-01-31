import { GraphQLSchema } from 'graphql';
import { MeshTransform, YamlConfig } from '@graphql-mesh/types';
type RenameMapObject = Map<string | RegExp, string>;
export default class BareRename implements MeshTransform {
    noWrap: boolean;
    typesMap: RenameMapObject;
    fieldsMap: Map<string, RenameMapObject>;
    argsMap: Map<string, RenameMapObject>;
    constructor({ config }: {
        config: YamlConfig.RenameTransform;
    });
    matchInMap(map: RenameMapObject, toMatch: string): string;
    renameType(type: any): import("graphql").GraphQLObjectType<any, any>;
    transformSchema(schema: GraphQLSchema): GraphQLSchema;
}
export {};
