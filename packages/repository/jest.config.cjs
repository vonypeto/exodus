module.exports = {
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2021',
          parser: { syntax: 'typescript', tsx: false, decorators: true },
          transform: { decoratorMetadata: true },
        },
        module: { type: 'commonjs' },
        sourceMaps: 'inline',
      },
    ],
  },
  moduleNameMapper: {
    '^@genesis/object-id$': '<rootDir>/../object-id/src/index.ts',
  },
  testMatch: ['**/?(*.)+(spec|test).[tj]s'],
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.d.ts'],
};
