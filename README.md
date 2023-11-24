# Actions Tagger

:speedboat: Keep your action versions up-to-date by automatically promoting a
major tag (and optionally, a `latest` tag) each time a release is created.

# Rationale

According to the github actions
[versioning guide](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md#versioning),
actions publishers should have a major tag (`v1`, `v2`, etc) which points to the
latest version of any minor/patch release of their action, for ease of use by
the others.

I found this process quite tedious, and repetitive which is why this action
exists. If you have published an action and would like to have your action
follow the same versioning structure as many others in the
[marketplace](https://github.com/marketplace?type=actions), then simply create a
release workflow that includes this action. See the
[_usage_ example](#sample-usage).

---

[![Tested with Jest](https://img.shields.io/badge/tested_with-jest-99424f.svg)](https://github.com/facebook/jest)

# Inputs

### `publish_latest_tag`

Indicates to the action whether or not to create/update a tag called `latest`
pointing to the latest release. **Default: `"false"`**.

### `prefer_branch_releases`

Do you prefer creating `vN` branches or `vN` tags? **Default: `"false"`**

### `token`

A github token used for creating an octoclient for making API calls. **Default:
`${{ github.token }}`**.

## Outputs

### `tag`

The version of the branch/tag that was published/updated.

### `latest`

Was _latest_ also published?

### <strike>`ref_name`</strike>

**Deprecated in v3:** _Use [`tag`](#tag)_

# Env Inputs

### `GITHUB_TOKEN`

**Deprecated in v3:** _If a non-default PAT (Personal Access Token) is needed,
use [`token`](#token) instead._

# Debug Logging

This action supports
[debug logging](https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging#enabling-step-debug-logging).
When enabled, it will dump the output of the api call for creating the
tags/branches. This is useful for testing and should be included when reporting
bugs.

# Sample Usage

`versioning.yml`

```yaml
name: Keep the versions up-to-date

on:
  release: # (1)
    types:
      - released
      - edited
  push: # (1)
    tags:
      - 'v?[0-9]+.[0-9]+.[0-9]+'
    branches-ignore:
      - '**'
    paths-ignore:
      - '**'

jobs:
  actions-tagger:
    runs-on: windows-latest
    permissions: # (2)
      contents: write
    steps:
      - uses: Actions-R-Us/actions-tagger@v2
        with:
          publish_latest_tag: true
```

---

### Notes

1. Add the push configuration if you want this action to also run when a new tag
   or branch is created. Due to the nature of releases, a new tag will also be
   created with a new release, which will trigger a new workflow run. Therefore,
   pick one or the other to avoid conflicts.

   **An event will
   [not be created](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#push)
   when more than three tags are pushed at once.**

   If using the push event, and you want to track branches, replace `tags` with
   `branches` and `branches-ignore` with `tags-ignore`. At all times, leave the
   filter for `paths-ignore` as is.

2. The
   [`permissions`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
   option is only required if the workflow permission for the given repository
   is set to readonly. `readonly` permission renders the main purpose of this
   action useless because it will be unable to create tags. Using the
   `contents: write` scope allows this action to once again gain the ability to
   create/update tags. For more details on changing the workflow permissions for
   a given repository, see
   [Configuring the default `GITHUB_TOKEN` permissions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#configuring-the-default-github_token-permissions).
   For more details on the various available scopes that can be configured for
   the `GITHUB_TOKEN`, see
   [`permissions`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions).

   It is also important to note that when modifying one scope of the
   [permission of `GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token),
   all other unspecified scopes are set to _no access_ with the exception of the
   `metadata` scope, which is set to `read`. See
   [Modifying the permissions for the `GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#modifying-the-permissions-for-the-github_token)
   for more details. This shouldn't be a concern for this action, because it
   only exclusively deals with the contents of the given repository.

---

# Similar projects

### [EndBug/latest-tag](https://github.com/EndBug/latest-tag)

- Creates a `latest` tag
