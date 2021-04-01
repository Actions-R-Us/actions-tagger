import { Config } from '@jest/types';

// https://kulshekhar.github.io/ts-jest/user/config/
// https://jestjs.io/docs/en/configuration

// https://docs.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables

const config: Config.InitialOptions = {
    bail: process.env.CI == "true" ? 0 : 1,
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        // Note: Order is IMPORTANT!
        // Inner modules before outer ones
        "^src(?:/(.+))?$": ["<rootDir>/src/$1", "<rootDir>/src"],
    },
    verbose: false,
    globalSetup: "<rootDir>/tests/test-setup.ts",
};

export default config;
