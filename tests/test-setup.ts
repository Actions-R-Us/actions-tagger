// https://docs.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables#default-environment-variables
export default async () => {
    process.env.INPUT_PUBLISH_LATEST_TAG = 'false';
    process.env.INPUT_PREFER_BRANCH_RELEASES = 'false';
    process.env.INPUT_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'test/test';
    process.env.GITHUB_ACTION_REPOSITORY = 'Actions-R-Us/actions-tagger';
};
