import { YamlConfig } from '@graphql-mesh/types';
import WrapFilter from './wrapFilter.cjs';
import BareFilter from './bareFilter.cjs';
interface FilterTransformConstructor {
    new (options: {
        config: YamlConfig.FilterSchemaTransform;
    }): BareFilter | WrapFilter;
}
declare const _default: FilterTransformConstructor;
export default _default;
