'use strict';

const fs = require('node:fs');
const { runSegment } = require('./exploration-runner');

const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const response = runSegment(request.definition, request.checkpoint, request.weeks);
fs.writeFileSync(process.argv[3], JSON.stringify(response));
