import { YamlConfig } from '@graphql-mesh/types';
import WrapRename from './wrapRename.cjs';
import BareRename from './bareRename.cjs';
interface RenameTransformConstructor {
    new (options: {
        config: YamlConfig.RenameTransform;
    }): BareRename | WrapRename;
}
declare const _default: RenameTransformConstructor;
export default _default;
