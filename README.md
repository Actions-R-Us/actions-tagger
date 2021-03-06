# Actions Tagger

:speedboat: Keep your action versions up-to-date by automatically promoting a major tag (and optionally, a `latest` tag) each time a release is created.

# Rationale

According to the github actions [versioning guide](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md#versioning), actions publishers should have a major tag (`v1`, `v2`, etc) which points to the latest version of any minor/patch release for easy use by the consumers.

I found this process quite tedious, and repetetive and that is why this action exists. If you have published an action and would like to have your action follow the same versioning structure as many others in the [marketplace](https://github.com/marketplace?type=actions), then simply create a release workflow that includes this action. See the _usage_ example.

---

[![tested with jest](https://img.shields.io/badge/tested_with-jest-99424f.svg)](https://github.com/facebook/jest)

## Inputs

### `publish_latest_tag`

Indicates to the action whether or not to create/update a tag called `latest` pointing to the latest release. Default `"false"`.

### `prefer_branch_releases`

Do you prefer creating `vN` branches or `vN` tags? Default `"false"`

## Outputs

### `ref_name`

The name of the branch/tag that was published.

### `latest`

Was the latest tag also published?

## Env

### `GITHUB_TOKEN`

**Required** A github token used for creating an octoclient for making API calls. Use `github.token`

## Debug Logging

This action supports [debug logging](https://help.github.com/en/actions/configuring-and-managing-workflows/managing-a-workflow-run#enabling-debug-logging). When enabled, it will dump the output of the
api call for creating the tags/branches.
This is useful for testing and should be included when reporting bugs.

# Sample Usage

`versioning.yml`

```yaml
name: Keep the versions up-to-date

on:
  release:
    types: [published, edited]

jobs:
  actions-tagger:
    runs-on: windows-latest
    steps:
      - uses: Actions-R-Us/actions-tagger@latest
        env:
          GITHUB_TOKEN: "${{ github.token }}"
        with:
          publish_latest_tag: true
```

_Note this action is able to detect if it is being run in a **release** context, and if not it will notify you and exit gracefully._

# Similar projects

### [EndBug/latest-tag](https://github.com/EndBug/latest-tag)

- Only creates a `latest` tag
