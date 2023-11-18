import * as core from '@actions/core';
import * as github from '@actions/github';
import semverGte from 'semver/functions/gte';
import { preferences } from '@actionstagger/util';
import type { GitHub } from '@actionstagger/functions/types';
import {
    isEditedRelease,
    isPublishedRelease,
    findLatestRef,
    createRequiredRefs,
    getPublishRefVersion,
    isRefPush,
    isSemVersionedTag,
} from '@actionstagger/functions/barrel';

export default async function main(): Promise<void> {
    if (!(isRefPush() || isPublishedRelease() || isEditedRelease())) {
        core.info(
            'This action should only be used in a release context or when creating a new tag or branch'
        );
        ifErrorSubmitBug();
        return;
    }

    if (!isSemVersionedTag()) {
        core.info('This action can only operate on semantically versioned tags');
        core.info('See: https://semver.org/');
        ifErrorSubmitBug();
        return;
    }

    const octokit = createOctoKit();
    const { repoLatest, majorLatest } = await findLatestRef(octokit);
    const releaseVer = getPublishRefVersion();

    if (semverGte(releaseVer, majorLatest.name)) {
        const overridePubLatest =
            preferences.publishLatest && semverGte(releaseVer, repoLatest.name);

        const { ref, latest } = await createRequiredRefs(octokit, overridePubLatest);
        outputTagName(ref);
        outputLatest(latest);
    } else if (majorLatest.shaId !== process.env.GITHUB_SHA) {
        core.info(
            'Nothing to do because release commit is earlier than major tag commit'
        );
        ifErrorSubmitBug();
    }
}

/**
 * Sets the output of this action to indicate the version that was published/updated
 * @param refName The tag version
 */
function outputTagName(refName: string) {
    core.setOutput('tag', refName);
    // TODO: Deprecate: v3
    core.setOutput('ref_name', refName);
}

/**
 * Sets the output of this action to indicate if the latest tag was published
 * @param isLatest
 */
function outputLatest(isLatest: boolean) {
    core.setOutput('latest', isLatest.toString());
}

function createOctoKit(): GitHub {
    let token = core.getInput('token');
    if (!token && process.env.GITHUB_TOKEN) {
        // TODO: Deprecate: v3
        core.info(
            `Using obsolete GITHUB_TOKEN environment variable: Please use token
                |arg instead. In most cases the default value will just work and you can
                |simply remove the token variable from your configuration.`.replace(
                /^\s*\|/gm,
                ''
            )
        );
        token = process.env.GITHUB_TOKEN;
    }
    // else...
    return github.getOctokit(token);
}

function ifErrorSubmitBug() {
    core.info('If you believe this to be an error, please submit a bug report');
    core.info(`https://github.com/${process.env.GITHUB_ACTION_REPOSITORY}/issues`);

    if (core.isDebug()) {
        core.debug(`event: ${process.env.GITHUB_EVENT_NAME}`);
        core.debug(`ref_name: ${getPublishRefVersion()?.raw}`);
    }
}
