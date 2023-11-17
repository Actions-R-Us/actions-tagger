export default async () => {
    process.env.INPUT_PUBLISH_LATEST_TAG = 'false';
    process.env.INPUT_PREFER_BRANCH_RELEASES = 'false';
    process.env.INPUT_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'test/test';
};
