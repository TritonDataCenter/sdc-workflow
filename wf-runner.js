// Copyright (c) 2012, Joyent, Inc. All rights reserved.

var path = require('path'),
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
    runner,
    log;


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
      streams: [ {
        level: 'info',
        stream: process.stdout
      }]
    };

    runner = wf.Runner(config);
    runner.init(function (err) {
      if (err) {
        console.error('Error initializing runner:');
        console.dir(err);
        process.exit(1);
      }
      runner.run();

      log = runner.log;
      log.info('Workflow Runner up!');

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
      });
    });

    process.on('SIGUSR1', function () {
      function decreaseLevel(logger) {
        var pos = levels.indexOf(logger._level);

        console.log('Got SIGUSR1. Attempting to decrease log level');

        if (pos === (levels.length + 1)) {
          console.log('Log level already set to the minimun. Doing nothing');
        } else {
          logger.level(levels[pos + 1]);
          console.log('Log level set to ' + levels[pos + 1]);
        }
      }
      [runner.log, runner.backend.log].forEach(decreaseLevel);
    });

    process.on('SIGUSR2', function () {
      function increaseLevel(logger) {
        var pos = levels.indexOf(logger._level);

        console.log('Got SIGUSR2. Attempting to increase log level');

        if (pos === 0) {
          console.log('Log level already set to the maximun. Doing nothing');
        } else {
          logger.level(levels[pos - 1]);
          console.log('Log level set to ' + levels[pos - 1]);
        }
      }
      [runner.log, runner.backend.log].forEach(increaseLevel);
    });

    process.on('SIGTERM', function () {
      console.log('Got SIGTERM. Waiting for child processes to finish');
      runner.quit(function () {
        console.log('All child processes finished. Exiting now.');
        process.exit(0);
      });
    });
  }
});

