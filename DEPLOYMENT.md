# Deployment Guide

## Automated Deployment (v3.0.0)

This project uses GitHub Actions for automated deployment to GitHub Pages with Vite bundler optimizations.

### How it Works

1. **Trigger**: Deployment runs automatically on:
   - Push to `main` branch
   - Manual workflow dispatch

2. **Build Process** (Vite):
   - Installs Node.js dependencies
   - **Vite production build** (`npm run build:vite`)
     - TypeScript compilation
     - Terser minification (removes console.logs)
     - Tree-shaking (removes unused code)
     - Code splitting for better caching
     - Gzip + Brotli compression (.gz + .br files)
     - Compiled for Chrome 64 / Firefox 67 / Safari 12 (`build.target`)
   - Verifies build output (dist/ directory)
   - Creates deployment directory with optimized assets

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
Build (Vite) → Optimize → Deploy → Health Check
     ↓           ↓          ↓          ↓
  Compile    Compress   GitHub    Verify
  Minify     Split      Pages     Site
```

### Files Deployed (Vite Build)

The following files are automatically deployed from `dist/`:

**Main Assets**:
- `index.html` - Main HTML page (with asset hash references)
- `assets/*.js` - Compiled and minified JavaScript bundles
  - Main bundle (~39 KB gzipped); the map chunks load on first use
- `assets/*.css` - Minified CSS (code-split)
- `assets/*.gz` - Gzip compressed versions (~8.05 KB modern)
- `assets/*.br` - Brotli compressed versions (even smaller)

**Supporting Files**:
- `robots.txt` - SEO configuration
- `sitemap.xml` - Site map for search engines
- `tournaments_data.json` - Tournament data (if present)
- `config.json` - Configuration file
- `.nojekyll` - Prevents Jekyll processing

**Build Optimizations**:
- ✅ Terser minification
- ✅ Tree-shaking
- ✅ Code splitting
- ✅ Compression (Gzip + Brotli)
- ✅ Cache-busting via content hashes
- ✅ Older browsers: compiled down to Safari 12 / Chrome 64

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

**Problem**: TypeScript or Vite build errors

**Solution**:
```bash
# Run locally to debug
npm run build:vite

# Check for TypeScript errors
npm run type-check

# Fix linting errors
npm run lint:fix

# Test again
npm run build:vite
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

| Aspect | Development | Production (Vite) |
|--------|-------------|-------------------|
| Build command | `npm run dev` | `npm run build:vite` |
| Server | Vite dev server (HMR) | Static files |
| Source maps | Included | Excluded |
| Minification | No | Yes (Terser) |
| Tree-shaking | No | Yes |
| Code splitting | No | Yes |
| Compression | No | Gzip + Brotli |
| Bundle size | ~80 KB | ~25 KB (gzipped) |
| Deployment | Manual | Automatic |

### Security

- HTTPS enforced by GitHub Pages
- Content Security Policy (CSP) in index.html
- No sensitive data in repository
- Dependencies scanned by Dependabot

### Performance

- Static site (no server-side processing)
- Global CDN (GitHub Pages)
- **Vite optimizations**:
  - 70% bundle size reduction (80 KB → 25 KB gzipped)
  - Code splitting for better caching
  - Gzip + Brotli compression (.gz + .br files)
  - Tree-shaking removes unused code
  - Terser minification
- Browser caching enabled (content-hashed filenames)
- Compiled down to Safari 12 / Chrome 64 (`build.target`), no polyfills
- **Performance budgets** (Lighthouse CI):
  - Performance: 85/100
  - Accessibility: 95/100
  - SEO: 95/100

### Analytics

Deployment metrics tracked:
- Build time
- Deployment time
- Health check status
- Deployment frequency

### Best Practices

1. **Before Merging to Main**:
   - Run all tests locally: `npm test`
   - Build successfully: `npm run build:vite`
   - Preview production build: `npm run preview`
   - Test in development: `npm run dev`
   - Check bundle size (should be < 30 KB gzipped)

2. **After Deployment**:
   - Verify site loads
   - Test key features
   - Check console for errors
   - Verify compressed assets (.gz, .br) are served
   - Test on an older iPad (iOS 12) if needed

3. **Monitoring**:
   - Watch GitHub Actions
   - Check health checks
   - Monitor Lighthouse CI scores
   - Monitor user reports
   - Review bundle size trends

### Build Commands

```bash
# Development server with HMR
npm run dev

# Production build (Vite)
npm run build:vite

# Preview production build
npm run preview

# Traditional TypeScript build
npm run build

# Clean build directory
npm run clean

# Full rebuild
npm run rebuild
```

### Support

For deployment issues:
1. Check workflow logs
2. Review this guide
3. Check GitHub Pages documentation
4. Open an issue in the repository
