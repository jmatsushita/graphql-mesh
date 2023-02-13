import { YamlConfig, MeshTransformOptions } from '@graphql-mesh/types';
import WrapPrefix from './wrapPrefix.cjs';
import BarePrefix from './barePrefix.cjs';
interface PrefixTransformConstructor {
    new (options: MeshTransformOptions<YamlConfig.Transform['prefix']>): BarePrefix | WrapPrefix;
}
declare const _default: PrefixTransformConstructor;
export default _default;
