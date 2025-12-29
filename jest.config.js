module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@characters/(.*)$': '<rootDir>/src/characters/$1',
    '^@ai/(.*)$': '<rootDir>/src/ai/$1',
    '^@phaser/(.*)$': '<rootDir>/src/phaser/$1',
  },
  collectCoverageFrom: [
    'src/core/**/*.ts',
    '!src/core/**/*.d.ts',
  ],
};
