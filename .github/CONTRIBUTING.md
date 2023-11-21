# Contributing to Actions-Tagger

<h2 style="color: red; font-weight: bold">DON'T</h2>

- #### Never create a pull request for master.

<h2 style="color: green; font-weight: bold">DO</h2>

- **Checkout a release branch corresponding to the version you want to
  contribute to**
- **Make your changes and create a pull request for that branch**
- **Your request will be merged to master once it is reviewed**

---

## Development

- ```bash
  yarn install
  yarn test
  ```
- Make your changes
- Add tests if you want
- Push to your branch
- Ping maintainer (@smac89) when PR is ready

## Maintainer Release Notes (shield your eyes :eyes:)

- Merge changes into the respective release branch
- Make other changes if necessary
- If this warrants a new release, then do the following
  - Bump version in `package.json` to next release version
  - Run `scripts/releaser.sh`
  - Create a new release based on this temporary branch and add release notes
  - Delete temporary branch
- If the release branch is the latest
  - Merge release branch (`release/vX`) back into `master`
  - Append `-latest` to the version in `package.json` on `master`

## License

By contributing, you agree that your contributions will be licensed under its
MIT License.

### Thank you for reading
