beforeEach(() => jest.resetModules());

describe('preferences.publishLatestTag', () => {
    it('Should have been set to false', () =>
        import('@actionstagger').then(({ preferences }) =>
            expect(preferences.publishLatestTag).toBe(false)
        ));

    it('Should have been set to true when deprecated input is true', async () => {
        process.env.INPUT_PUBLISH_LATEST = 'true';
        return import('@actionstagger').then(({ preferences }) =>
            expect(preferences.publishLatestTag).toBe(true)
        );
    });

    it('Should have been set to true when input is true', async () => {
        process.env.INPUT_PUBLISH_LATEST_TAG = 'true';
        return import('@actionstagger').then(({ preferences }) =>
            expect(preferences.publishLatestTag).toBe(true)
        );
    });
});

describe('preferences.preferBranchRelease', () => {
    it('Should have been set to false', () =>
        import('@actionstagger').then(({ preferences }) =>
            expect(preferences.preferBranchRelease).toBe(false)
        ));

    it('Should have been set to true when input is true', async () => {
        process.env.INPUT_PREFER_BRANCH_RELEASES = 'true';
        return import('@actionstagger').then(({ preferences }) =>
            expect(preferences.preferBranchRelease).toBe(true)
        );
    });
});
