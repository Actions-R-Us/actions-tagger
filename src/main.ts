import semverGte from 'semver/functions/gte';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import ActionError, { ActionErrorMap } from '@actionstagger/errors';
import {
  createRequiredRefs,
  findLatestRef,
  getPublishRefVersion,
  isEditedRelease,
  isPublicRefPush,
  isPublishedRelease,
  isSemVersionedRef,
} from '@actionstagger/functions';
import type { GitHub } from '@actionstagger/functions/types';
import { preferences } from '@actionstagger/util';

export default async function main(): Promise<void> {
  if (!(isPublicRefPush() || isPublishedRelease() || isEditedRelease())) {
    presentError(ActionError.ACTION_CONTEXT_ERROR);
    return;
  }

  if (!isSemVersionedRef()) {
    presentError(ActionError.ACTION_SEMVER_ERROR);
    return;
  }

  const octokit = createOctoKit();
  const { repoLatest, majorLatest } = await findLatestRef(octokit);
  const releaseVer = getPublishRefVersion()!;

  if (semverGte(releaseVer, majorLatest.name)) {
    const publishLatest = preferences.publishLatest && semverGte(releaseVer, repoLatest.name);

    const { ref, latest } = await createRequiredRefs(octokit, publishLatest);
    outputTagName(ref);
    outputLatest(latest);
  } else if (majorLatest.shaId !== process.env.GITHUB_SHA) {
    presentError(ActionError.ACTION_OLDREF_ERROR);
  }
}

/**
 * Sets the output of this action to indicate the version that was published/updated
 * @param refName The tag version
 */
function outputTagName(refName: string): void {
  core.setOutput('tag', refName);
  // TODO: Deprecate: v3
  core.setOutput('ref_name', refName);
}

/**
 * Sets the output of this action to indicate if the latest tag was published
 * @param isLatest
 */
function outputLatest(isLatest: boolean): void {
  core.setOutput('latest', isLatest.toString());
}

function createOctoKit(): GitHub {
  let token = core.getInput('token');
  if (token === '' && process.env.GITHUB_TOKEN != null) {
    // TODO: Deprecate: v3
    core.info(
      `Using obsolete GITHUB_TOKEN environment variable: Please use token
                |arg instead. In most cases the default value will just work and you can
                |simply remove the token variable from your configuration.`.replace(/^\s*\|/gm, '')
    );
    token = process.env.GITHUB_TOKEN;
  }
  // else...
  return getOctokit(token);
}

function presentError(actionError: ActionError): void {
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null) {
    const error = new Error(actionError);
    error.name = ActionErrorMap[actionError];
    throw error;
  }
  core.info(actionError);
  core.info('If you believe this to be a false positive, please submit a bug report');
  core.info(
    `https://github.com/${
      process.env.GITHUB_ACTION_REPOSITORY ?? 'Actions-R-Us/actions-tagger'
    }/issues`
  );

  if (core.isDebug()) {
    core.debug(`event: ${process.env.GITHUB_EVENT_NAME ?? 'unknown'}`);
    core.debug(`ref_name: ${getPublishRefVersion()?.raw}`);
  }
}
