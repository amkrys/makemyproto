# Working on the MakeMeProto website

This repo uses a light git-flow. `main` is always what customers see on
[makemeproto.com](https://makemeproto.com); everything else reaches it through a pull request.

## Branches

| Branch | Purpose | Branch from | Merge into |
| --- | --- | --- | --- |
| `main` | Production, served by GitHub Pages | (permanent) | (permanent) |
| `develop` | Integration: finished work waiting for a release | `main` | `release/*` |
| `feature/<name>` | One feature or page, e.g. `feature/cart` | `develop` | `develop` |
| `fix/<name>` | A non-urgent bug fix | `develop` | `develop` |
| `release/<x.y.z>` | Freeze a batch for final testing and the version bump | `develop` | `main` **and** `develop` |
| `hotfix/<name>` | Urgent fix to the live site | `main` | `main` **and** `develop` |

`main` and `develop` are protected: no direct pushes, no force pushes, and the
**Site checks** workflow must pass before merging.

## Everyday flow

```bash
git checkout develop && git pull
git checkout -b feature/product-listing
# ...work, commit...
git push -u origin feature/product-listing
# open a PR into develop, check it, squash-merge, delete the branch
```

## Releasing

```bash
git checkout develop && git pull
git checkout -b release/1.1.0
# final test, bump the ?v= cache version in index.html, fix small issues only
git push -u origin release/1.1.0
# PR release/1.1.0 → main (merge commit), then:
git checkout main && git pull
git tag -a v1.1.0 -m "v1.1.0" && git push origin v1.1.0
# merge main back into develop so they stay in sync
git checkout develop && git merge main && git push
```

Publish release notes for the tag on GitHub (Releases → Draft a new release).

## Hotfixes

Branch `hotfix/<name>` from `main`, PR into `main`, tag a patch version
(e.g. `v1.1.1`), then merge `main` back into `develop`.

## Merge style

- Feature and fix PRs into `develop`: **Squash and merge** (one clean commit per change).
- Release and hotfix PRs into `main`: **Create a merge commit**.

## Commit messages

`feat: add product listing page` · `fix: cart total rounding` · `docs: update README` ·
`chore: bump cache version` · `style:` · `refactor:` · `test:`

## Versions

Semantic versioning: `MAJOR.MINOR.PATCH`. New pages or features bump MINOR,
fixes bump PATCH, a big platform change (e.g. moving to a backend) bumps MAJOR.

## Roadmap

| Release | Contents |
| --- | --- |
| v1.0.0 | Current one-page site |
| v1.1.0 | Separate pages per section, Terms & Privacy, form submissions stored outside WhatsApp |
| v2.0.0 | Backend: user accounts, product listing |
| v2.1.0 | Cart, order history, payment gateway |
| v2.2.0 | Order tracking and details, customer support |
| v2.3.0 | Customer reviews, wishlist |

## Secrets

Never commit API keys, payment keys or customer data. When a backend arrives,
staging uses test keys and production uses live keys, both stored as repository
or hosting secrets.
