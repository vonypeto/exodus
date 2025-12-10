module.exports = {
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest'],
  },
  testMatch: ['**/?(*.)+(spec|test).[tj]s'],
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.d.ts'],
};
