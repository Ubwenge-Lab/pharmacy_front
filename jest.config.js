/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // stub CSS / image imports
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/src/__tests__/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.test.config.js' }],
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/app/hospital/**/*.tsx',
    'src/app/pharmacy/**/*.tsx',
    '!src/app/hospital/**/layout.tsx',
    '!src/app/pharmacy/**/layout.tsx',
  ],
  coverageThreshold: {
    // Ratchet: keep this at or just below today's measured baseline.
    // Run `npm run test:cov` after merging, record the output, then bump.
    global: {
      lines: 0,
    },
  },
};

module.exports = config;
