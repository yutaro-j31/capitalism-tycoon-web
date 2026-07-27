'use strict';

const BUSINESSES = Object.freeze([
  'ramen', 'cafe', 'bakery', 'conveni', 'bookstore', 'beautySalon', 'cleaning',
  'cramSchool', 'realEstateAgency', 'insuranceAgency', 'maBroker', 'webAgency', 'appStudio'
]);
const DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard']);
const PLAY_STYLES = Object.freeze([
  'prudent', 'leveraged_growth', 'discount_share', 'premium_quality', 'diversified_group',
  'novice', 'passive', 'turnaround', 'boundary_explorer'
]);
const SEEDS = Object.freeze([2119631105, 2119631362, 2119631619]);
const SHARD_COUNT = 39;

function cases() {
  const result = [];
  for (const businessID of BUSINESSES) {
    for (const difficulty of DIFFICULTIES) {
      for (const playStyle of PLAY_STYLES) {
        for (const seed of SEEDS) {
          const caseId = `${businessID}--${difficulty}--${playStyle}--${seed}`;
          result.push({ caseId, businessID, difficulty, playStyle, seed });
        }
      }
    }
  }
  return result;
}

function shardCases(index, count = SHARD_COUNT) {
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error(`invalid shard ${index}/${count}`);
  const rows = cases();
  const size = rows.length / count;
  if (!Number.isInteger(size)) throw new Error(`${rows.length} cases cannot be evenly divided into ${count} shards`);
  return rows.slice(index * size, (index + 1) * size);
}

module.exports = { BUSINESSES, DIFFICULTIES, PLAY_STYLES, SEEDS, SHARD_COUNT, cases, shardCases };
