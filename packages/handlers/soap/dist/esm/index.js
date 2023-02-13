import { PredefinedProxyOptions } from '@graphql-mesh/store';
import { createExecutorFromSchemaAST, SOAPLoader } from '@omnigraph/soap';
import { readFileOrUrl } from '@graphql-mesh/utils';
export default class SoapHandler {
    constructor({ config, store, baseDir, importFn, logger, }) {
        this.config = config;
        this.soapSDLProxy = store.proxy('schemaWithAnnotations.graphql', PredefinedProxyOptions.GraphQLSchemaWithDiffing);
        this.baseDir = baseDir;
        this.importFn = importFn;
        this.logger = logger;
    }
    async getMeshSource({ fetchFn }) {
        let schema;
        if (this.config.source.endsWith('.graphql')) {
            schema = await readFileOrUrl(this.config.source, {
                allowUnknownExtensions: true,
                cwd: this.baseDir,
                fetch: fetchFn,
                importFn: this.importFn,
                logger: this.logger,
            });
        }
        else {
            schema = await this.soapSDLProxy.getWithSet(async () => {
                const soapLoader = new SOAPLoader({
                    fetch: fetchFn,
                });
                const wsdlLocation = this.config.source;
                const wsdl = await readFileOrUrl(wsdlLocation, {
                    allowUnknownExtensions: true,
                    cwd: this.baseDir,
                    fetch: fetchFn,
                    importFn: this.importFn,
                    logger: this.logger,
                });
                const object = await soapLoader.loadWSDL(wsdl);
                soapLoader.loadedLocations.set(wsdlLocation, object);
                return soapLoader.buildSchema();
            });
        }
        // Create executor lazily for faster startup
        let executor;
        return {
            schema,
            executor(...args) {
                if (!executor) {
                    executor = createExecutorFromSchemaAST(schema, fetchFn);
                }
                return executor(...args);
            },
        };
    }
}
