# Branch Protection Setup

This document describes the recommended branch protection rules for the `main` branch.

## Configuration Steps

1. Go to **Settings** → **Branches** in your GitHub repository
2. Click **Add branch protection rule**
3. Set **Branch name pattern** to `main`

## Recommended Settings

### Protect matching branches

| Setting                                                            | Value | Rationale                                    |
| ------------------------------------------------------------------ | ----- | -------------------------------------------- |
| Require a pull request before merging                              | ✅ On | Enforces code review                         |
| → Require approvals                                                | 1     | At least one reviewer                        |
| → Dismiss stale pull request approvals when new commits are pushed | ✅ On | Re-review after changes                      |
| Require status checks to pass before merging                       | ✅ On | Ensures CI passes                            |
| → Require branches to be up to date before merging                 | ✅ On | Prevents merge conflicts                     |
| → Status checks that are required                                  | `ci`  | The job name from `.github/workflows/ci.yml` |
| Require conversation resolution before merging                     | ✅ On | All review comments addressed                |
| Do not allow bypassing the above settings                          | ✅ On | Applies to admins too                        |

### Optional (recommended for teams)

| Setting                | Value  | Rationale                    |
| ---------------------- | ------ | ---------------------------- |
| Require signed commits | ❌ Off | Optional, adds friction      |
| Require linear history | ✅ On  | Cleaner git history          |
| Allow force pushes     | ❌ Off | Prevents history rewriting   |
| Allow deletions        | ❌ Off | Prevents accidental deletion |

## Required Status Checks

The CI workflow (`.github/workflows/ci.yml`) defines a job named `ci` that runs:

- Build
- Lint
- Type Check
- Test
- Format Check

Add **`ci`** as a required status check. This is the job name, not the workflow name.

## Verifying Setup

After configuration, verify that:

1. Direct pushes to `main` are blocked
2. PRs require the `ci` check to pass
3. PRs require at least one approval

You can test by creating a PR with a failing lint check — it should be blocked from merging.

## GitHub CLI Alternative

If you have admin access, you can set up branch protection via CLI:

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```

Note: This requires admin permissions on the repository.
