"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("@graphql-mesh/store");
const soap_1 = require("@omnigraph/soap");
const utils_1 = require("@graphql-mesh/utils");
class SoapHandler {
    constructor({ config, store, baseDir, importFn, logger, }) {
        this.config = config;
        this.soapSDLProxy = store.proxy('schemaWithAnnotations.graphql', store_1.PredefinedProxyOptions.GraphQLSchemaWithDiffing);
        this.baseDir = baseDir;
        this.importFn = importFn;
        this.logger = logger;
    }
    async getMeshSource({ fetchFn }) {
        let schema;
        if (this.config.source.endsWith('.graphql')) {
            schema = await (0, utils_1.readFileOrUrl)(this.config.source, {
                allowUnknownExtensions: true,
                cwd: this.baseDir,
                fetch: fetchFn,
                importFn: this.importFn,
                logger: this.logger,
            });
        }
        else {
            schema = await this.soapSDLProxy.getWithSet(async () => {
                const soapLoader = new soap_1.SOAPLoader({
                    fetch: fetchFn,
                });
                const wsdlLocation = this.config.source;
                const wsdl = await (0, utils_1.readFileOrUrl)(wsdlLocation, {
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
                    executor = (0, soap_1.createExecutorFromSchemaAST)(schema, fetchFn);
                }
                return executor(...args);
            },
        };
    }
}
exports.default = SoapHandler;
