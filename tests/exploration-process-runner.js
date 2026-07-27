'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SEGMENT_WEEKS } = require('./exploration-runner');

function runProcessCase(definition, { segmentWeeks = SEGMENT_WEEKS, totalWeeks = 1000, onSegment = null } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'capitalism-exploration-'));
  const requestPath = path.join(directory, 'request.json');
  const responsePath = path.join(directory, 'response.json');
  let checkpoint = null;
  let result = null;
  let maxRSSBytes = 0;
  try {
    for (let segment = 0; segment < Math.ceil(totalWeeks / segmentWeeks); segment += 1) {
      fs.writeFileSync(requestPath, JSON.stringify({ definition, checkpoint, weeks: Math.min(segmentWeeks, totalWeeks - segment * segmentWeeks) }));
      const child = spawnSync(process.execPath, [path.join(__dirname, 'exploration-segment-worker.js'), requestPath, responsePath], {
        encoding: 'utf8', timeout: 180_000, maxBuffer: 1024 * 1024
      });
      if (child.error || child.status !== 0) throw child.error || new Error(`segment failed: ${child.stderr || child.stdout}`);
      ({ result, checkpoint } = JSON.parse(fs.readFileSync(responsePath, 'utf8')));
      maxRSSBytes = Math.max(maxRSSBytes, result.maxRSSBytes);
      if (onSegment) onSegment({ week: result.week, checkpointBytes: checkpoint ? Buffer.byteLength(JSON.stringify(checkpoint)) : 0 });
      if (!checkpoint || result.finalGameWeek >= totalWeeks + 1) break;
    }
    return { ...result, maxRSSBytes };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { runProcessCase };
