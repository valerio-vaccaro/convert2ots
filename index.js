#!/usr/bin/env node
'use strict';

/**
 * Convert2ots
 * @module Index
 * @author EternityWall
 * @license LPGL3
 */

// Dependencies
const fs = require('fs');
const OpenTimestamps = require('javascript-opentimestamps');
// Comment : const request = require('request-promise');
const program = require('commander');

// OpenTimestamps shortcuts
// const Timestamp = OpenTimestamps.Timestamp;
const Ops = OpenTimestamps.Ops;
// Const Utils = OpenTimestamps.Utils;
// const Notary = OpenTimestamps.Notary;
const Context = OpenTimestamps.Context;
const DetachedTimestampFile = OpenTimestamps.DetachedTimestampFile;

// Local dependecies
const Tools = require('./tools.js');

// Parse parameters
program
    .version(require('./package.json').version)
    .description('Convert bitcoin timestamp proof ( like Chainpoint v2 ) to OpenTimestamps proof.')
    .option('-c, --chainpoint <file>', 'Chainpoint proof')
    .option('-o, --output <file>', 'Output OTS proof')
    .parse(process.argv);

const chainpointFile = program.chainpoint;
const otsFile = program.output;
if (chainpointFile === undefined || otsFile === undefined) {
  program.help();
  process.exit(1);
}

// Read file
let chainpoint;
try {
  chainpoint = JSON.parse(fs.readFileSync(chainpointFile, 'utf8'));
} catch (err) {
  console.log('Read file error');
  process.exit(1);
}

// Check chainpoint file
if (chainpoint['@context'] !== 'https://w3id.org/chainpoint/v2') {
  console.error('Support only chainpoint v2');
  process.exit(1);
}
if (chainpoint.type !== 'ChainpointSHA256v2') {
  console.error('Support only ChainpointSHA256v2');
  process.exit(1);
}
if (chainpoint.anchors === undefined) {
  console.error('Support only timestamps with attestations');
  process.exit(1);
}

// Check valid chainpoint merkle
const merkleRoot = Tools.calculateMerkleRoot(chainpoint.targetHash, chainpoint.proof);
if (merkleRoot !== chainpoint.merkleRoot) {
  console.error('Invalid merkle root');
  process.exit(1);
}

// Migrate proof
let timestamp;
try {
  timestamp = Tools.migrationMerkle(chainpoint.targetHash, chainpoint.proof);
  // Console.log(timestamp.strTree(0, 1));
} catch (err) {
  console.log('Building error');
  process.exit(1);
}

// Migrate attestation
try {
  Tools.migrationAttestations(chainpoint.anchors, timestamp);
    // Console.log(timestamp.strTree(0, 1));
} catch (err) {
  console.log('Attestation error');
  process.exit(1);
}

// Print timestamp
console.log(timestamp.strTree(0, 1));

// Store to file
saveTimestamp(otsFile, timestamp);

// Save ots file
function saveTimestamp(filename, timestamp) {
  const detached = new DetachedTimestampFile(new Ops.OpSHA256(), timestamp);
  const ctx = new Context.StreamSerialization();
  detached.serialize(ctx);
  saveOts(filename, ctx.getOutput());
}

function saveOts(otsFilename, buffer) {
  fs.exists(otsFilename, fileExist => {
    if (fileExist) {
      console.log('The timestamp proof \'' + otsFilename + '\' already exists');
    } else {
      fs.writeFile(otsFilename, buffer, 'binary', err => {
        if (err) {
          return console.log(err);
        }
        console.log('The timestamp proof \'' + otsFilename + '\' has been created!');
      });
    }
  });
}
