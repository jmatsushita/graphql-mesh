import { YamlConfig } from '@graphql-mesh/types';
import WrapFilter from './wrapFilter.js';
import BareFilter from './bareFilter.js';
interface FilterTransformConstructor {
    new (options: {
        config: YamlConfig.FilterSchemaTransform;
    }): BareFilter | WrapFilter;
}
declare const _default: FilterTransformConstructor;
export default _default;
