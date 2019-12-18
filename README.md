# Actions Tagger
:speedboat: Keep your action versions up-to-date by automatically promoting a major tag (and optionally, a `latest` tag) each time a release is created.

# Rationale
According to the github actions [versioning guide](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md#versioning), actions publishers should have a major tag (`v1`, `v2`, etc) which points to the latest version of any minor/patch release for easy use by the consumers.

I found this process quite tedious, and repetetive and that is why this action exists. If you have published an action and would like to have your action follow the same versioning structure as many others in the [marketplace](https://github.com/marketplace?type=actions), then simply create a release workflow that includes this action. See the _usage_ example.

# Usage

`versioning.yml`
```yaml
name: Keep the versions up-to-date

on:
  releases:
    types: [published]

jobs:
  actions-tagger:
    runs-on: windows-latest
    steps:
      - uses: Actions-R-Us/actions-tagger@latest
        with:
          publish_latest: true
        env:
          GITHUB_TOKEN: '${{secrets.GITHUB_TOKEN}}'
```

_Note this action is able to detect if it is being run in a **release** context, and if not it will display a message and exit gracefully._

# Similar projects

### https://github.com/EndBug/latest-tag
- Only publishes the `latest` tag
