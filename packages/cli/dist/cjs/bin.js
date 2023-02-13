#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@graphql-mesh/utils");
// eslint-disable-next-line import/no-extraneous-dependencies
const cli_1 = require("@graphql-mesh/cli");
(0, cli_1.graphqlMesh)(cli_1.DEFAULT_CLI_PARAMS).catch(e => (0, cli_1.handleFatalError)(e, new utils_1.DefaultLogger(cli_1.DEFAULT_CLI_PARAMS.initialLoggerPrefix)));
