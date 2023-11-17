import { getOctokit } from '@actions/github';

beforeEach(() => jest.resetModules());
afterEach(() => jest.restoreAllMocks());

describe('getPreferredRef()', () => {
    it('Should be heads', async () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = 'true';
        await import('@actionstagger/functions').then(
            ({ default: { getPreferredRef } }) => expect(getPreferredRef()).toBe('heads')
        );
    });

    it('Should be tags', async () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = 'false';
        await import('@actionstagger/functions').then(
            ({ default: { getPreferredRef } }) => expect(getPreferredRef()).toBe('tags')
        );
    });
});

describe('findLatestReleases()', () => {
    beforeEach(() => {
        process.env.GITHUB_REPOSITORY = 'test/test';
    });

    const octokit = getOctokit('TEST_TOKEN');

    it('Should find the latest release when only one release exists', async () => {
        const currentTag = '3.0.1';
        // YES, this require only works in this scope. Don't ask me why, ask the JS/Jest gods
        const semverTag = require('semver/functions/parse')(`v${currentTag}`);
        const spyOctokit = jest.spyOn(octokit, 'graphql').mockImplementation(async () =>
            Promise.resolve({
                repository: {
                    refs: {
                        refsList: [
                            {
                                ref: {
                                    name: `v${currentTag}`,
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
            MockFunctions.releaseTag = jest.fn();
            return {
                __esModule: true,
                default: MockFunctions,
            };
        });

        await import('@actionstagger/functions').then(
            async ({ default: { findLatestReleases, releaseTag } }) => {
                // @ts-ignore
                releaseTag.mockReturnValue(semverTag);
                await findLatestReleases(octokit).then(({ repoLatest }) => {
                    expect(spyOctokit).toHaveBeenCalledTimes(1);
                    expect(repoLatest).toBe(currentTag);
                });
            }
        );
    });
});
