/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

var path = require('path'),
    bunyan = require('bunyan'),
    fs = require('fs'),
    util = require('util'),
    http = require('http'),
    https = require('https'),
    restify = require('restify'),
    tritonTracer = require('triton-tracer'),
    wf = require('wf'),
    config_file = path.resolve(__dirname, 'etc/config.json'),
    config,
    api,
    log,
    retries = 0,
    MAX_RETRIES;


fs.readFile(config_file, 'utf8', function (err, data) {
    if (err) {
        console.error('Error reading config file:');
        console.dir(err);
        process.exit(1);
    } else {
        try {
            config = JSON.parse(data);
        } catch (e) {
            console.error('Error parsing config file JSON:');
            console.dir(e);
            process.exit(1);
        }

        if (typeof (config.maxHttpSockets) === 'number') {
            console.log('Tuning max sockets to %d', config.maxHttpSockets);
            http.globalAgent.maxSockets = config.maxHttpSockets;
            https.globalAgent.maxSockets = config.maxHttpSockets;
        }

        config.log = new bunyan({
            name: 'workflow-api',
            serializers: restify.bunyan.serializers,
            streams: [ {
                level: config.logLevel || 'info',
                stream: process.stdout
            } ]
        });

        tritonTracer.init({
            log: config.log
        });

        config.metrics = {
            datacenterName: config.datacenterName,
            serviceName: config.serviceName,
            instanceUuid: config.instanceUuid,
            serverUuid: config.serverUuid,
            adminIp: config.adminIp
        };

        api = wf.API(config);
        log = api.log;

        var init = function (cb) {
            api.init(function onInit() {
                return cb();
            }, function onError(err) {
                if (err) {
                    log.error(err);
                }
            });
        };

        init(function () {
            log.info('API server up and running!');
        });

        // Setup a logger on HTTP Agent queueing
        setInterval(function () {
            var agent = http.globalAgent;
            if (agent.requests && agent.requests.length > 0) {
                log.warn('http.globalAgent queueing, depth=%d',
                        agent.requests.length);
                }
            agent = https.globalAgent;
            if (agent.requests && agent.requests.length > 0) {
                log.warn('https.globalAgent queueing, depth=%d',
                         agent.requests.length);
            }
        }, 1000);

    }
});
