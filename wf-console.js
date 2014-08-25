/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var net = require('net'),
    repl = require('repl'),
    path = require('path'),
    fs = require('fs'),
    util = require('util'),
    http = require('http'),
    https = require('https'),
    wf = require('wf'),
    config_file = path.resolve(__dirname, 'etc/config.json'),
    Logger = require('bunyan'),
    levels = [Logger.TRACE, Logger.DEBUG, Logger.INFO,
              Logger.WARN, Logger.ERROR, Logger.FATAL],
    config,
    connections = 0;

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

        config.logger = {
            name: 'wf-console',
            streams: [ {
                level: config.logLevel || 'info',
                stream: process.stdout
            }]
        };

        var Backend = require(config.backend.module),
            log = new Logger(config.logger),
            backend = new Backend(config.backend.opts);

        backend.init(false, function (err) {
            if (err) {
                log.error({err: err}, 'Error initializing backend');
                process.exit(1);
            }
            log.info('Backend initialized');
            net.createServer(function (socket) {
                connections += 1;
                var remote = repl.start('wf-console> ', socket);
                remote.context.backend = backend;
                remote.context.log = log;
                remote.context.config = config;
                remote.context.wf = wf;
            }).listen('/tmp/node-repl.sock');
            // nc -U /tmp/node-repl.sock
        });
    }
});
