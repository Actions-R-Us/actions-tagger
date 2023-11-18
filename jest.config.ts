import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';
import type { JestConfigWithTsJest } from 'ts-jest';

// https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping
// https://jestjs.io/docs/en/configuration
const config: JestConfigWithTsJest = {
    bail: process.env.CI == 'true' ? 0 : 1,
    transform: {
        // '^.+\\.[tj]sx?$' to process js/ts with `ts-jest`
        // '^.+\\.m?[tj]sx?$' to process js/ts/mjs/mts with `ts-jest`
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tests/tsconfig.json',
            },
        ],
    },
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: '<rootDir>/',
    }),
    verbose: true,
    globalSetup: '<rootDir>/tests/test-setup.ts',
};

export default config;
