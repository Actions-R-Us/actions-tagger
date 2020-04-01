import * as core from '@actions/core';
import {context} from '@actions/github';
import {isPrelease} from '../src/action';

describe("publish_latest tests", () => {
    test("not published when false", () => {
        process.env.INPUT_PUBLISH_LATEST = 'false';
        expect(core.getInput('publish_latest')).toBe('false')
    });

    test("published when true", () => {
        process.env.INPUT_PUBLISH_LATEST = "true";
        expect(core.getInput('publish_latest')).toBe('true')
    });
});

describe("release tests", () => {
    test("Will return true if Pre-release detected", () => {
        context.payload = {action: 'published', release: {
            "prerelease": true
        }}
        expect(isPrelease()).toBe(true);
    });

    test("Will return false if not Pre-release", () => {
        context.payload = {action: 'published', release: {
            "prerelease": false
        }}
        expect(isPrelease()).toBe(false);
    });
});
