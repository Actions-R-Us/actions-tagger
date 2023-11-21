beforeEach(() => jest.resetModules());

describe('preferences.publishLatestTag', () => {
  it('Should have been set to false', async () =>
    await import('@actionstagger/util').then(({ preferences }) =>
      expect(preferences.publishLatest).toBe(false)
    ));

  it('Should have been set to true when deprecated input is true', async () => {
    process.env.INPUT_PUBLISH_LATEST = 'true';
    await import('@actionstagger/util').then(({ preferences }) =>
      expect(preferences.publishLatest).toBe(true)
    );
  });

  // TODO: v3 remove this test or set it to failing
  it('Should have been set to true when input is true', async () => {
    process.env.INPUT_PUBLISH_LATEST_TAG = 'true';
    await import('@actionstagger/util').then(({ preferences }) =>
      expect(preferences.publishLatest).toBe(true)
    );
  });
});

describe('preferences.preferBranchRelease', () => {
  it('Should have been set to false', async () =>
    await import('@actionstagger/util').then(({ preferences }) =>
      expect(preferences.preferBranchRelease).toBe(false)
    ));

  it('Should have been set to true when input is true', async () => {
    process.env.INPUT_PREFER_BRANCH_RELEASES = 'true';
    await import('@actionstagger/util').then(({ preferences }) =>
      expect(preferences.preferBranchRelease).toBe(true)
    );
  });
});
