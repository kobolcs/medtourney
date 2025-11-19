# Deployment Guide

## Automated Deployment

This project uses GitHub Actions for automated deployment to GitHub Pages.

### How it Works

1. **Trigger**: Deployment runs automatically on:
   - Push to `main` branch
   - Manual workflow dispatch

2. **Build Process**:
   - Installs Node.js dependencies
   - Compiles TypeScript to JavaScript (`npm run build:prod`)
   - Verifies build output
   - Creates deployment directory with all necessary files

3. **Deploy Process**:
   - Uploads built artifacts to GitHub Pages
   - Deploys to production environment
   - Provides deployment URL

4. **Health Check**:
   - Waits for deployment to be ready
   - Verifies site is accessible (HTTP 200)
   - Checks for main content
   - Reports status

### Deployment Workflow

```yaml
Build → Deploy → Health Check
  ↓       ↓          ↓
 app.js  GitHub   Verify
        Pages     Site
```

### Files Deployed

The following files are automatically deployed:

- `index.html` - Main HTML page
- `app.js` - Compiled TypeScript application
- `styles.css` - Stylesheet
- `robots.txt` - SEO configuration
- `sitemap.xml` - Site map for search engines
- `tournaments_data.json` - Tournament data (if present)
- `config.json` - Configuration file
- `.nojekyll` - Prevents Jekyll processing

### Manual Deployment

To manually trigger deployment:

1. Go to GitHub Actions
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

### Monitoring Deployment

1. **GitHub Actions Tab**:
   - View workflow runs
   - Check build logs
   - Monitor deployment status

2. **Deployment Summary**:
   - Each deployment creates a summary
   - Shows deployed files
   - Includes deployment timestamp
   - Provides site URL

3. **Health Check**:
   - Automatic verification
   - HTTP status check
   - Content verification
   - Reports in summary

### Troubleshooting

#### Build Fails

**Problem**: TypeScript compilation errors

**Solution**:
```bash
# Run locally to debug
npm run build

# Fix TypeScript errors
npm run lint:fix

# Test again
npm run build
```

#### Deployment Fails

**Problem**: Pages deployment error

**Solution**:
1. Check GitHub Pages settings (Settings → Pages)
2. Ensure "Source" is set to "GitHub Actions"
3. Verify permissions in workflow file
4. Check for deployment conflicts

#### Health Check Fails

**Problem**: Site not accessible after deployment

**Solution**:
1. Wait 1-2 minutes for DNS propagation
2. Clear browser cache
3. Check GitHub Pages status page
4. Verify files were uploaded correctly

### Rollback

To rollback to a previous version:

1. **Via Git**:
```bash
# Find the commit to rollback to
git log

# Create a revert commit
git revert <commit-hash>

# Push to main
git push origin main
```

2. **Via GitHub**:
- Navigate to the previous workflow run
- Click "Re-run all jobs"

### Environment Variables

No environment variables are required for deployment.

### Production URL

https://kobolcs.github.io/medtourney/

### Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Build command | `npm run build` | `npm run build:prod` |
| Source maps | Included | Excluded |
| Minification | No | Yes (via TSC) |
| Deployment | Manual | Automatic |

### Security

- HTTPS enforced by GitHub Pages
- Content Security Policy (CSP) in index.html
- No sensitive data in repository
- Dependencies scanned by Dependabot

### Performance

- Static site (no server-side processing)
- Global CDN (GitHub Pages)
- Gzip compression automatic
- Browser caching enabled

### Analytics

Deployment metrics tracked:
- Build time
- Deployment time
- Health check status
- Deployment frequency

### Best Practices

1. **Before Merging to Main**:
   - Run all tests locally
   - Build successfully
   - Test in development

2. **After Deployment**:
   - Verify site loads
   - Test key features
   - Check console for errors

3. **Monitoring**:
   - Watch GitHub Actions
   - Check health checks
   - Monitor user reports

### Support

For deployment issues:
1. Check workflow logs
2. Review this guide
3. Check GitHub Pages documentation
4. Open an issue in the repository
