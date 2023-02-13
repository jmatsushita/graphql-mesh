import { MeshPluginOptions, YamlConfig } from '@graphql-mesh/types';
import { Plugin } from '@envelop/core';
export default function useMeshResponseCache(options: MeshPluginOptions<YamlConfig.ResponseCacheConfig>): Plugin;
