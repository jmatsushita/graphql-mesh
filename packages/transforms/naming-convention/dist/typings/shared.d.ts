import { YamlConfig } from '@graphql-mesh/types';
type NamingConventionFn = (input: string) => string;
type NamingConventionType = YamlConfig.NamingConventionTransformConfig['typeNames'];
export declare const NAMING_CONVENTIONS: Record<NamingConventionType, NamingConventionFn>;
export declare const IGNORED_ROOT_FIELD_NAMES: string[];
export declare const IGNORED_TYPE_NAMES: string[];
export {};
