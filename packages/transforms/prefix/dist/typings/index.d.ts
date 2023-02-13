import { YamlConfig, MeshTransformOptions } from '@graphql-mesh/types';
import WrapPrefix from './wrapPrefix.js';
import BarePrefix from './barePrefix.js';
interface PrefixTransformConstructor {
    new (options: MeshTransformOptions<YamlConfig.Transform['prefix']>): BarePrefix | WrapPrefix;
}
declare const _default: PrefixTransformConstructor;
export default _default;
