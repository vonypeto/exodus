/* eslint-disable */
const { readFileSync } = require('fs');
const { join } = require('path');

const swcRaw = JSON.parse(readFileSync(join(__dirname, '.swcrc'), 'utf-8'));
const { exclude: _drop, ...swcJestConfig } = swcRaw;
if (swcJestConfig.swcrc === undefined) swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'common',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
};
