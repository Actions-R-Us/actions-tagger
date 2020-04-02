import * as core from "@actions/core";
import { context, GitHub } from "@actions/github";
import { TaggedRelease, isRelease, isPreRelease, majorVersion } from ".";
import { queryCommitDateOfRef } from "./query";

/**
 * Creates the tags required and optionally a 'latest' tag
 *
 * @param {GitHub} github The octokit client for making requests
 * @returns {Promise<TaggedRelease>}
 */
async function createRequiredRefs(github: GitHub): Promise<TaggedRelease> {
    const mayor = majorVersion();

    const tag = `tags/v${mayor}`;
    await createRef(github, tag);

    const publishLatest: boolean = core.getInput("publish_latest").toLowerCase() === "true";
    if (publishLatest) {
        await createRef(github, "tags/latest");
    }

    return { tag, latest: publishLatest };
}

/**
 * Creates the given ref for this release
 * refName must begin with tags/ or heads/
 *
 * @param github The github client
 * @param refName The name of the ref to use. ex tags/latest, heads/v1, etc
 */
async function createRef(github: GitHub, refName: string) {
    const { data: matchingRefs } = await github.git.listMatchingRefs({
        ...context.repo,
        ref: refName
    });

    const matchingRef = matchingRefs.find(refObj => {
        return refObj.ref.endsWith(refName);
    });

    let upstreamRef: unknown;

    if (matchingRef !== undefined) {
        core.info(`Updating ref: ${refName} to: ${process.env.GITHUB_SHA}`);
        ({ data: upstreamRef } = await github.git.updateRef({
            ...context.repo,
            force: true,
            ref: refName,
            sha: process.env.GITHUB_SHA
        }));
    } else {
        core.info(`Creating ref: refs/${refName} for: ${process.env.GITHUB_SHA}`);
        ({ data: upstreamRef } = await github.git.createRef({
            ...context.repo,
            ref: `refs/${refName}`,
            sha: process.env.GITHUB_SHA
        }));
    }

    if (core.isDebug()) {
        core.debug(JSON.stringify(upstreamRef));
    }
}

/**
 * Checks if the commit date of the current release is earlier than
 * the commit date of the major tag for this release
 *
 * @param {GitHub} github The octokit client instance
 * @returns {Promise<boolean>}
 */
async function isLatestMajorRelease(github: GitHub): Promise<boolean> {
    return github
        .graphql(queryCommitDateOfRef, {
            repoName: context.repo.repo,
            repoOwner: context.repo.owner,
            majorRef: "refs/tags/",
            majorVersion: `v${majorVersion()}`,
            tagCommit: process.env.GITHUB_SHA
        })
        .then(({ repository }) => {
            const date = new Date(repository.refs.nodes[0]?.target.committedDate);
            if (!isNaN(date.getTime())) {
                return date < new Date(repository.object.committedDate);
            }
            return true;
        });
}

async function run() {
    try {
        if (!isRelease()) {
            core.info("This action should only be used in a release context");
            core.info("If you believe this to be an error, please submit a bug report");
            return;
        }

        if (isPreRelease()) {
            core.info("Pre-release detected. Nothing to be done.");
            core.info("When ready, edit your release to remove the pre-release flag");
            core.info("See https://github.com/Actions-R-Us/actions-tagger/issues/23");
            return;
        }

        if (process.env.GITHUB_TOKEN) {
            const octokit = new GitHub(process.env.GITHUB_TOKEN);
            if (await isLatestMajorRelease(octokit)) {
                const { tag, latest } = await createRequiredRefs(octokit);
                core.setOutput("tag", tag);
                core.setOutput("latest", latest.toString());
            } else {
                core.info("Nothing to do because release commit is earlier than major tag commit");
                core.info("If you believe this to be an error, please submit a bug report");
            }
        } else {
            core.setFailed("Expected a `GITHUB_TOKEN` environment variable");
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
