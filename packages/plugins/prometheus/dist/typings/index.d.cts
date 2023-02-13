import type { Plugin as YogaPlugin } from 'graphql-yoga';
import { MeshPlugin, MeshPluginOptions, YamlConfig } from '@graphql-mesh/types';
export default function useMeshPrometheus(pluginOptions: MeshPluginOptions<YamlConfig.PrometheusConfig>): Promise<MeshPlugin<any> & YogaPlugin>;
