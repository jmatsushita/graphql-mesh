import { YamlConfig, MeshTransformOptions } from '@graphql-mesh/types';
import WrapNamingConvention from './wrapNamingConvention.cjs';
import BareNamingConvention from './bareNamingConvention.cjs';
interface NamingConventionTransformConstructor {
    new (options: MeshTransformOptions<YamlConfig.NamingConventionTransformConfig>): WrapNamingConvention | BareNamingConvention;
}
declare const _default: NamingConventionTransformConstructor;
export default _default;
