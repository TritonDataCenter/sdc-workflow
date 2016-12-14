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
    tritonTracer = require('triton-tracer'),
    wf = require('wf'),
    config_file = path.resolve(__dirname, 'etc/config.json'),
    config,
    runner,
    log,
    agentIntervalId,
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
            name: 'workflow-runner',
            streams: [{
                level: config.logLevel || 'info',
                stream: process.stdout
            }]
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

        MAX_RETRIES = config.maxInitRetries || 10;

        // Poll less frequently in COAL:
        if (config.coal && config.coal === 'true') {
            config.runner.run_interval = 5000;
        }
        // Prevent it to run with previous values, which were in
        // seconds:
        if (config.runner.run_interval < 1000) {
            config.runner.run_interval = 1000;
        }

        runner = wf.Runner(config);
        log = runner.log;

        var init = function (cb) {
            runner.init(function (err) {
                if (err) {
                    retries += 1;
                    console.error('Error initializing runner:');
                    console.dir(err);
                    if (retries >= MAX_RETRIES) {
                        console.error('Exiting because MAX_RETRIES exceeded');
                        process.exit(1);
                    } else {
                        console.log('Re-queueing runner init in 15 secs');
                        setTimeout(init, 15000, cb);
                    }
                } else {
                    cb();
                }
            });
        };

        init(function () {
            runner.run();
            log.info('Workflow Runner up!');
        });

        process.on('SIGINT', function () {
            console.log('Got SIGINT. Waiting for child processes to finish');
            runner.quit(function () {
                clearInterval(agentIntervalId);
                console.log('All child processes finished. Exiting now.');
                process.exit(0);
            });
        });


        // Setup a logger on HTTP Agent queueing
        agentIntervalId = setInterval(function () {
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
