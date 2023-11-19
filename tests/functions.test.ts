import { getOctokit } from '@actions/github';
import type { GraphQlQueryRepository } from '@actionstagger/functions/types';
import fs from 'node:fs';
import os from 'node:os';

describe('Functions', () => {
    beforeEach(() => {
        jest.resetModules();
    });
    afterEach(() => {
        jest.resetAllMocks();
    });

    describe.each([
        { preferbranchReleases: false, expected: 'tags' },
        { preferbranchReleases: true, expected: 'heads' },
    ])('#getPreferredRef()', ({ preferbranchReleases, expected }) => {
        test(`when INPUT_PREFER_BRANCH_RELEASES=${preferbranchReleases} returns ${expected}`, async () => {
            process.env.INPUT_PREFER_BRANCH_RELEASES = preferbranchReleases.toString();
            await import('@actionstagger/functions').then(
                ({ default: { getPreferredRef } }) =>
                    expect(getPreferredRef()).toBe(expected)
            );
        });
    });

    describe.each([
        {
            eventName: 'push',
            preferbranchReleases: false,
            githubRef: 'refs/tags/v3.0.0',
            expected: '3.0.0',
        },
        {
            eventName: 'push',
            preferbranchReleases: true,
            githubRef: 'refs/heads/v2.3.0',
            expected: '2.3.0',
        },
    ])(
        '#getPublishRefVersion()',
        ({ eventName, preferbranchReleases, githubRef, expected }) => {
            const dir = fs.mkdtempSync(os.tmpdir() + '/jest-push');

            beforeEach(() => {
                const pushEvent = {
                    ref: `${githubRef}`,
                    created: true,
                };
                fs.writeFileSync(`${dir}/event.json`, JSON.stringify(pushEvent));
                process.env.GITHUB_EVENT_PATH = `${dir}/event.json`;
                process.env.INPUT_PREFER_BRANCH_RELEASES =
                    preferbranchReleases.toString();
                process.env.GITHUB_EVENT_NAME = eventName;
                process.env.GITHUB_REF_NAME = githubRef.replace(/refs\/.+\//g, '');
                process.env.GITHUB_REF = githubRef;
            });

            afterEach(() => {
                fs.rmSync(dir, { recursive: true });
                delete process.env.GITHUB_EVENT_PATH;
            });

            test(`on ${eventName} when INPUT_PREFER_BRANCH_RELEASES=${preferbranchReleases}, pushed ref=${githubRef}, returns=${expected}`, async () => {
                await import('@actionstagger/functions').then(
                    ({ default: { getPublishRefVersion } }) =>
                        expect(getPublishRefVersion().version).toBe(expected)
                );
            });
        }
    );

    describe.each([
        {
            eventName: 'release',
            tagName: 'v3.0.0',
            expected: '3.0.0',
        },
        {
            eventName: 'release',
            tagName: 'v2.3.0',
            expected: '2.3.0',
        },
    ])('#getPublishRefVersion()', ({ eventName, tagName, expected }) => {
        const dir = fs.mkdtempSync(os.tmpdir() + '/jest-release');

        beforeEach(() => {
            const releaseEvent = {
                release: {
                    tag_name: `${tagName}`,
                },
            };
            fs.writeFileSync(`${dir}/event.json`, JSON.stringify(releaseEvent));
            process.env.GITHUB_EVENT_PATH = `${dir}/event.json`;
            process.env.GITHUB_EVENT_NAME = eventName;
        });

        afterEach(() => {
            fs.rmSync(dir, { recursive: true });
            delete process.env.GITHUB_EVENT_PATH;
        });

        test(`on ${eventName}, release tag=${tagName}, returns=${expected}`, async () => {
            await import('@actionstagger/functions').then(
                ({ default: { getPublishRefVersion } }) =>
                    expect(getPublishRefVersion().version).toBe(expected)
            );
        });
    });

    describe.each([
        {
            pushedRef: 'v3.2.2',
            existing: 'v3.3.0',
            repoLatest: 'v4.0.0',
            expected: ['4.0.0', '3.3.0'],
        },
        {
            pushedRef: 'v3.2.0',
            expected: ['3.2.0', '3.2.0'],
        },
        {
            pushedRef: 'v3.3.0',
            existing: 'v3.2.2',
            repoLatest: 'v4.0.0',
            expected: ['4.0.0', '3.3.0'],
        },
    ])('#findLatestRef()', ({ pushedRef, existing, repoLatest, expected }) => {
        const octokit = getOctokit('TEST_TOKEN');
        const refsList: GraphQlQueryRepository['refs']['refsList'] = [
            existing,
            repoLatest,
        ]
            .filter(Boolean)
            .map((version, i) => ({
                ref: {
                    name: version,
                    object: {
                        shaId: `${i + 1}`,
                    },
                },
            }));

        beforeEach(() => {
            const semverTag = require('semver/functions/parse')(pushedRef);

            jest.doMock('@actionstagger/functions', () => {
                const MockFunctions = jest.requireActual<
                    typeof import('@actionstagger/functions')
                >('@actionstagger/functions').default;
                MockFunctions.getPublishRefVersion = jest.fn().mockReturnValue(semverTag);
                return {
                    __esModule: true,
                    default: MockFunctions,
                };
            });
        });

        test(`when new release or push of ${pushedRef}, and ref with name ${existing} exists and latest ref is ${repoLatest}, returns [${expected.join(
            ', '
        )}]`, async () => {
            const spyOctokit = jest.spyOn(octokit, 'graphql').mockResolvedValue(
                Promise.resolve<{ repository: GraphQlQueryRepository }>({
                    repository: {
                        refs: {
                            refsList,
                            pageInfo: {
                                endCursor: 'MTA',
                                hasNextPage: false,
                            },
                            totalCount: refsList.length,
                        },
                    },
                })
            );
            const {
                default: { findLatestRef },
            } = await import('@actionstagger/functions');
            await findLatestRef(octokit).then(({ repoLatest, majorLatest }) => {
                expect(spyOctokit).toHaveBeenCalledTimes(1);
                expect([repoLatest.name, majorLatest.name]).toEqual(expected);
            });
        });
    });
});
