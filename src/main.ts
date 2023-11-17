import * as core from '@actions/core';
import * as github from '@actions/github';
import semverGte from 'semver/functions/gte';
import { preferences } from '@actionstagger';
import {
    isEditedRelease,
    isPublishedRelease,
    isSemVersionedRelease,
    findLatestReleases,
    createRequiredRefs,
    outputLatest,
    outputTagName,
    releaseTag,
} from '@actionstagger/functions/barrel';

run().catch((error: Error) => {
    core.setFailed(error.message);
});

async function run(): Promise<void> {
    if (!(isPublishedRelease() || isEditedRelease())) {
        core.info('This action should only be used in a release context');
        ifErrorSubmitBug();
        return;
    }

    if (!isSemVersionedRelease()) {
        core.info('This action can only operate on semantically versioned releases');
        core.info('See: https://semver.org/');
        ifErrorSubmitBug();
        return;
    }

    if (process.env.GITHUB_TOKEN) {
        // TODO: Deprecate: v3
        core.info(
            `Using obsolete GITHUB_TOKEN environment variable: Please use token
                |arg instead. In most cases the default value will just work and you can
                |simply remove the token variable from your configuration.`.replace(
                /^\s*\|/gm,
                ''
            )
        );
    }

    const token = process.env.GITHUB_TOKEN ?? core.getInput('token');
    const octokit = github.getOctokit(token);
    const { repoLatest, majorLatest } = await findLatestReleases(octokit);

    const releaseVer = releaseTag();

    if (semverGte(releaseVer, majorLatest)) {
        const overridePubLatest =
            preferences.publishLatestTag && semverGte(releaseVer, repoLatest);

        const { ref, latest } = await createRequiredRefs(octokit, overridePubLatest);
        outputTagName(ref);
        outputLatest(latest);
    } else {
        core.info(
            'Nothing to do because release commit is earlier than major tag commit'
        );
        ifErrorSubmitBug();
    }
}

function ifErrorSubmitBug() {
    core.info('If you believe this to be an error, please submit a bug report');
    core.info('https://github.com/Actions-R-Us/actions-tagger/issues');

    if (core.isDebug()) {
        core.debug(`event: ${process.env.GITHUB_EVENT_NAME}`);
        core.debug(`tag_name: ${releaseTag().version}`);
    }
}
