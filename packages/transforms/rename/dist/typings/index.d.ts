import { YamlConfig } from '@graphql-mesh/types';
import WrapRename from './wrapRename.js';
import BareRename from './bareRename.js';
interface RenameTransformConstructor {
    new (options: {
        config: YamlConfig.RenameTransform;
    }): BareRename | WrapRename;
}
declare const _default: RenameTransformConstructor;
export default _default;
