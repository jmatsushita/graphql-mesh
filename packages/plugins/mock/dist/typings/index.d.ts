import { MeshPluginOptions, YamlConfig, MeshPlugin } from '@graphql-mesh/types';
export default function useMock(config: MeshPluginOptions<YamlConfig.MockingConfig>): MeshPlugin<{}>;
