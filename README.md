# Actions Tagger
:speedboat: Keep your action versions up-to-date by automatically promoting a major tag (and optionally, a `latest` tag) each time a minor release is created

# Usage

```yaml
- uses: Actions-R-Us/actions-tagger@latest
  with:
    publish_latest: true
  env:
    GITHUB_TOKEN: '${{secrets.GITHUB_TOKEN}}'
```

# Similar projects

### https://github.com/EndBug/latest-tag
- Only publishes the `latest` tag
