"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveMesh = void 0;
const tslib_1 = require("tslib");
/* eslint-disable import/no-nodejs-modules */
/* eslint-disable dot-notation */
const cluster_1 = tslib_1.__importDefault(require("cluster"));
const os_1 = require("os");
require("json-bigint-patch");
const http_1 = require("http");
const ws_1 = tslib_1.__importDefault(require("ws"));
const cross_helpers_1 = require("@graphql-mesh/cross-helpers");
const https_1 = require("https");
const handleFatalError_js_1 = require("../../handleFatalError.js");
const open_1 = tslib_1.__importDefault(require("open"));
const ws_2 = require("graphql-ws/lib/use/ws");
const dnscache_1 = tslib_1.__importDefault(require("dnscache"));
const http_2 = require("@graphql-mesh/http");
const terminateEvents = ['SIGINT', 'SIGTERM'];
function registerTerminateHandler(callback) {
    for (const eventName of terminateEvents) {
        cross_helpers_1.process.once(eventName, () => callback(eventName));
    }
}
function portSelectorFn(sources, logger) {
    const port = sources.find(source => Boolean(source)) || 4000;
    if (sources.filter(source => Boolean(source)).length > 1) {
        const activeSources = [];
        if (sources[0]) {
            activeSources.push('CLI');
        }
        if (sources[1]) {
            activeSources.push('serve configuration');
        }
        if (sources[2]) {
            activeSources.push('environment variable');
        }
        logger.warn(`Multiple ports specified (${activeSources.join(', ')}), using ${port}`);
    }
    return port;
}
async function serveMesh({ baseDir, argsPort, getBuiltMesh, logger, rawServeConfig = {}, playgroundTitle, }, cliParams) {
    const { fork: configFork, port: configPort, hostname = (0, os_1.platform)() === 'win32' ||
        // is WSL?
        (0, os_1.release)().toLowerCase().includes('microsoft')
        ? '127.0.0.1'
        : '0.0.0.0', sslCredentials, endpoint: graphqlPath = '/graphql', browser,
    // TODO
    // trustProxy = 'loopback',
     } = rawServeConfig;
    const port = portSelectorFn([argsPort, parseInt(configPort === null || configPort === void 0 ? void 0 : configPort.toString()), parseInt(cross_helpers_1.process.env.PORT)], logger);
    let forkNum;
    const envFork = cross_helpers_1.process.env.FORK;
    if (envFork != null) {
        if (envFork === 'false' || envFork === '0') {
            forkNum = 0;
        }
        else if (envFork === 'true') {
            forkNum = (0, os_1.cpus)().length;
        }
        else {
            forkNum = parseInt(envFork);
        }
    }
    else if (configFork != null) {
        if (typeof configFork === 'boolean') {
            forkNum = configFork ? (0, os_1.cpus)().length : 0;
        }
        else {
            forkNum = configFork;
        }
    }
    const protocol = sslCredentials ? 'https' : 'http';
    const serverUrl = `${protocol}://${hostname}:${port}`;
    if (!playgroundTitle) {
        playgroundTitle = (rawServeConfig === null || rawServeConfig === void 0 ? void 0 : rawServeConfig.playgroundTitle) || cliParams.playgroundTitle;
    }
    if (!cluster_1.default.isWorker && forkNum > 0) {
        for (let i = 0; i < forkNum; i++) {
            const worker = cluster_1.default.fork();
            registerTerminateHandler(eventName => worker.kill(eventName));
        }
        logger.info(`${cliParams.serveMessage}: ${serverUrl} in ${forkNum} forks`);
    }
    else {
        logger.info(`Starting GraphQL Mesh...`);
        const mesh$ = getBuiltMesh()
            .then(mesh => {
            (0, dnscache_1.default)({
                enable: true,
                cache: function CacheCtor({ ttl }) {
                    return {
                        get: (key, callback) => mesh.cache
                            .get(key)
                            .then(value => callback(null, value))
                            .catch(e => callback(e)),
                        set: (key, value, callback) => mesh.cache
                            .set(key, value, { ttl })
                            .then(() => callback())
                            .catch(e => callback(e)),
                    };
                },
            });
            logger.info(`${cliParams.serveMessage}: ${serverUrl}`);
            registerTerminateHandler(eventName => {
                const eventLogger = logger.child(`${eventName}  💀`);
                eventLogger.info(`Destroying GraphQL Mesh...`);
                mesh.destroy();
            });
            return mesh;
        })
            .catch(e => (0, handleFatalError_js_1.handleFatalError)(e, logger));
        let httpServer;
        const requestHandler = (0, http_2.createMeshHTTPHandler)({
            baseDir,
            getBuiltMesh: () => mesh$,
            rawServeConfig,
            playgroundTitle,
        });
        if (sslCredentials) {
            const [key, cert] = await Promise.all([
                cross_helpers_1.fs.promises.readFile(sslCredentials.key, 'utf-8'),
                cross_helpers_1.fs.promises.readFile(sslCredentials.cert, 'utf-8'),
            ]);
            httpServer = (0, https_1.createServer)({ key, cert }, requestHandler);
        }
        else {
            httpServer = (0, http_1.createServer)(requestHandler);
        }
        (0, ws_2.useServer)({
            onSubscribe: async ({ connectionParams, extra: { request } }, msg) => {
                var _a;
                // spread connectionParams.headers to upgrade request headers.
                // we completely ignore the root connectionParams because
                // [@graphql-tools/url-loader adds the headers inside the "headers" field](https://github.com/ardatan/graphql-tools/blob/9a13357c4be98038c645f6efb26f0584828177cf/packages/loaders/url/src/index.ts#L597)
                for (const [key, value] of Object.entries((_a = connectionParams === null || connectionParams === void 0 ? void 0 : connectionParams.headers) !== null && _a !== void 0 ? _a : {})) {
                    // dont overwrite existing upgrade headers due to security reasons
                    if (!(key.toLowerCase() in request.headers)) {
                        request.headers[key.toLowerCase()] = value;
                    }
                }
                const { getEnveloped } = await mesh$;
                const { schema, execute, subscribe, contextFactory, parse, validate } = getEnveloped({
                    // req object holds the Node request used for extracting the headers (see packages/runtime/src/get-mesh.ts)
                    req: request,
                });
                const args = {
                    schema,
                    operationName: msg.payload.operationName,
                    document: parse(msg.payload.query),
                    variableValues: msg.payload.variables,
                    contextValue: await contextFactory(),
                    execute,
                    subscribe,
                };
                const errors = validate(args.schema, args.document);
                if (errors.length)
                    return errors;
                return args;
            },
            execute: (args) => args.execute(args),
            subscribe: (args) => args.subscribe(args),
        }, new ws_1.default.Server({
            path: graphqlPath,
            server: httpServer,
        }));
        const sockets = new Set();
        httpServer
            .listen(port, hostname, () => {
            var _a;
            const shouldntOpenBrowser = ((_a = cross_helpers_1.process.env.NODE_ENV) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'production' || browser === false;
            if (!shouldntOpenBrowser) {
                (0, open_1.default)(serverUrl.replace('0.0.0.0', 'localhost'), typeof browser === 'string' ? { app: browser } : undefined).catch(() => { });
            }
        })
            .on('error', handleFatalError_js_1.handleFatalError)
            .on('connection', socket => {
            sockets.add(socket);
            socket.once('close', () => {
                sockets.delete(socket);
            });
        });
        registerTerminateHandler(eventName => {
            const eventLogger = logger.child(`${eventName}  💀`);
            if (sockets.size > 0) {
                eventLogger.debug(`Open sockets found: ${sockets.size}`);
                for (const socket of sockets) {
                    eventLogger.debug(`Destroying socket: ${socket.remoteAddress}`);
                    socket.destroy();
                    sockets.delete(socket);
                }
            }
            eventLogger.debug(`Stopping HTTP Server`);
            httpServer.close(error => {
                if (error) {
                    eventLogger.error(`HTTP Server couldn't be stopped: `, error);
                }
                else {
                    eventLogger.debug(`HTTP Server has been stopped`);
                }
            });
        });
        return mesh$.then(mesh => ({
            mesh,
            httpServer,
            logger,
        }));
    }
    return null;
}
exports.serveMesh = serveMesh;
