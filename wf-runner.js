// Copyright (c) 2012, Joyent, Inc. All rights reserved.

var path = require('path'),
    fs = require('fs'),
    util = require('util'),
    wf = require('wf'),
    config_file = path.resolve(__dirname, 'etc/config.json'),
    config,
    runner;


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
    runner = wf.Runner(config);
    runner.init(function (err) {
      if (err) {
        console.error('Error initializing runner:');
        console.dir(err);
        process.exit(1);
      }
      runner.run();
      console.log('Workflow Runner up!');
    });
  }
});

