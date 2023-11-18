import { getOctokit } from '@actions/github';
import type { GraphQlQueryRepository } from '@actionstagger/functions/types';
import fs from 'node:fs';
import os from 'node:os';

beforeEach(() => jest.resetModules());
afterEach(() => jest.restoreAllMocks());

describe('Functions', () => {
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
            });

            afterEach(() => {
                fs.rmSync(dir, { recursive: true });
            });

            test(`on ${eventName} when INPUT_PREFER_BRANCH_RELEASES=${preferbranchReleases}, pushed ref=${githubRef}, expected=${expected}`, async () => {
                process.env.INPUT_PREFER_BRANCH_RELEASES =
                    preferbranchReleases.toString();
                process.env.GITHUB_EVENT_NAME = eventName;
                process.env.GITHUB_REF_NAME = githubRef.replace(/refs\/.+\//g, '');
                process.env.GITHUB_REF = githubRef;
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
        });

        afterEach(() => {
            fs.rmSync(dir, { recursive: true });
        });

        test(`on ${eventName}, release tag=${tagName}, expected=${expected}`, async () => {
            process.env.GITHUB_EVENT_NAME = eventName;
            await import('@actionstagger/functions').then(
                ({ default: { getPublishRefVersion } }) =>
                    expect(getPublishRefVersion().version).toBe(expected)
            );
        });
    });

    describe('#findLatestRef()', () => {
        const octokit = getOctokit('TEST_TOKEN');

        it('Should find the latest release when only one release exists', async () => {
            const currentTag = '3.0.1';
            // YES, this 'require' only works in this scope. Don't ask me why, ask the JS/Jest gods
            const semverTag = require('semver/functions/parse')(`v${currentTag}`);
            const spyOctokit = jest
                .spyOn(octokit, 'graphql')
                .mockImplementation(async () =>
                    Promise.resolve<{ repository: GraphQlQueryRepository }>({
                        repository: {
                            refs: {
                                refsList: [
                                    {
                                        ref: {
                                            name: `v${currentTag}`,
                                            object: {
                                                shaId: 'test',
                                            },
                                        },
                                    },
                                ],
                                pageInfo: {
                                    endCursor: 'MTA',
                                    hasNextPage: false,
                                },
                                totalCount: 1,
                            },
                        },
                    })
                );

            jest.doMock('@actionstagger/functions', () => {
                const MockFunctions = jest.requireActual<
                    typeof import('@actionstagger/functions')
                >('@actionstagger/functions').default;
                MockFunctions.getPublishRefVersion = jest.fn();
                return {
                    __esModule: true,
                    default: MockFunctions,
                };
            });

            await import('@actionstagger/functions').then(
                async ({ default: { findLatestRef, getPublishRefVersion } }) => {
                    // @ts-ignore
                    getPublishRefVersion.mockReturnValue(semverTag);
                    await findLatestRef(octokit).then(({ repoLatest }) => {
                        expect(spyOctokit).toHaveBeenCalledTimes(1);
                        expect(repoLatest.name).toBe(currentTag);
                    });
                }
            );
        });
    });
});
