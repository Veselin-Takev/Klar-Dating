# Versioning and release

Conventional Commits describe intent. They do not automatically publish a version or deploy production.

The manual `auto-version.yml` workflow accepts a validated semantic version, updates package metadata and lockfile with `npm version --no-git-tag-version`, and uploads a patch for review. It does not push to main or create a tag.

Apply the reviewed version patch through a pull request. Require successful checks and independent approval, then create the protected release tag. `release.yml` validates the candidate, builds the container, resolves the registry digest and retains SBOM, checksums and rendered deployment manifests. Cloud deployment and canary promotion are separate controlled operations in `docs/PRODUCTION_RUNBOOK.md`.

Configure branch, tag and production-environment protection in GitHub before release. Workflow files alone do not prove these controls are enabled.
