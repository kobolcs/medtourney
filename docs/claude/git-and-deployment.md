# Git & Deployment

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

## Git & Deployment

### Branching Strategy

- **main** - Production branch (protected, auto-deploys to GitHub Pages)
- **develop** - Development branch (optional)
- **claude/*** - AI assistant branches (auto-generated with session IDs)
- **feature/*** - Feature development branches
- **fix/*** - Bug fix branches

### Git Workflow

**For AI assistants (Claude):**

1. **Always develop on designated branch**
   ```bash
   # Branch format: claude/claude-md-{unique-session-id}
   git checkout -b claude/claude-md-mi9e8nxitld5tmr7-016N1n6yMJcV5hz8UWQCXnJt
   ```

2. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: Add comprehensive CLAUDE.md documentation"
   ```

3. **Push to remote**
   ```bash
   # ALWAYS use -u flag for first push
   git push -u origin claude/claude-md-mi9e8nxitld5tmr7-016N1n6yMJcV5hz8UWQCXnJt

   # CRITICAL: Branch must start with 'claude/' and end with matching session ID
   # Otherwise push will fail with 403 error
   ```

4. **Retry logic for network failures**
   - Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
   - For both push and fetch/pull operations

### Creating Pull Requests

**Workflow:**
1. Run `git status` to see changes
2. Run `git diff` to review changes
3. Run `git log` and `git diff main...HEAD` to see all commits
4. Analyze ALL commits (not just latest)
5. Create PR with comprehensive summary

**Example:**
```bash
# Check status and changes
git status
git diff

# Review all commits for PR
git log --oneline
git diff main...HEAD

# Push if needed
git push -u origin claude/my-feature-branch

# Create PR using gh CLI
gh pr create --title "Add comprehensive CLAUDE.md" --body "$(cat <<'EOF'
## Summary
- Created comprehensive AI assistant guide (CLAUDE.md)
- Documents codebase structure, workflows, conventions
- Includes common task guides and troubleshooting

## Test plan
- [ ] Verify CLAUDE.md renders correctly on GitHub
- [ ] Review all sections for accuracy
- [ ] Ensure links work correctly
EOF
)"
```

### GitHub Actions CI/CD

**Workflows:**

1. **test.yml** - Comprehensive test pipeline
   - Type checking (mypy)
   - Linting (ruff, ESLint)
   - TypeScript build
   - Unit tests (211 tests)
   - Integration tests (8 tests)
   - E2E tests (68 tests)
   - Performance benchmarks
   - Lighthouse CI
   - Runs on: push, PR, daily schedule

2. **deploy.yml** - 3-stage deployment
   - Stage 1: Build (Vite production build)
   - Stage 2: Deploy (GitHub Pages)
   - Stage 3: Health Check (verify deployment)
   - Runs on: push to main

3. **security.yml** - Security scanning
   - CodeQL analysis
   - Dependency scanning
   - Runs on: push, PR, schedule

4. **update-tournaments.yml** - Daily data update
   - Runs daily at 00:00 UTC
   - Executes Robot Framework scraper
   - Updates tournaments_data.json
   - Auto-commits and pushes to main

### Deployment Process

**Automatic (recommended):**
1. Merge PR to main
2. GitHub Actions automatically:
   - Runs all tests
   - Builds production bundle (Vite)
   - Deploys to GitHub Pages
   - Runs health check
3. Live in ~5 minutes: https://kobolcs.github.io/medtourney/

**Manual (for testing):**
```bash
# Build production bundle
npm run build:vite

# Preview locally
npm run preview
# → http://localhost:4173

# Deploy manually (not recommended)
# GitHub Pages auto-deploys from main branch
```
