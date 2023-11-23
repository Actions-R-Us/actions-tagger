beforeAll(() => {
  process.env.INPUT_PUBLISH_LATEST ??= 'false';
  process.env.INPUT_PREFER_BRANCH_RELEASES ??= 'false';
  process.env.INPUT_TOKEN ??= 'test-token';
  process.env.GITHUB_REPOSITORY ??= 'test/test';
  process.env.GITHUB_ACTION_REPOSITORY ??= 'Actions-R-Us/actions-tagger';
});

beforeEach(() => jest.resetModules());
afterEach(() => jest.restoreAllMocks());
