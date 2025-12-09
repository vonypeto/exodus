/* eslint-disable */
export default {
  displayName: 'account',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html', 'json'],
  setupFilesAfterEnv: ['../../jest.setup.js'],
  openHandlesTimeout: 5000,
};
