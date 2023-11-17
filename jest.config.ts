import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';
import type { JestConfigWithTsJest } from 'ts-jest';

// https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping
// https://jestjs.io/docs/en/configuration

// https://docs.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables
const config: JestConfigWithTsJest = {
    bail: process.env.CI == 'true' ? 0 : 1,
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: '<rootDir>/',
    }),
    globalSetup: '<rootDir>/tests/test-setup.ts',
};

export default config;
