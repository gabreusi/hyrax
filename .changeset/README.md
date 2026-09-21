# Changesets

Every pull request that changes what a user of the package sees adds a changeset: a small file that says
which bump it is (`patch`, `minor` or `major`) and what to write in the changelog.

```sh
npm run changeset
```

On `main`, the release workflow collects the changesets into a "Version Packages" pull request, and publishing
happens when that pull request is merged. See "Releasing" in CONTRIBUTING.md.
