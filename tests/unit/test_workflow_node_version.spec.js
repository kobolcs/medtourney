/**
 * Meta-test: guard against CI jobs regressing to Node < 24.
 *
 * The repo targets Node 24 (.nvmrc, package.json engines): Node 20 reached end
 * of life in April 2026 and jsdom 30 needs 22.22+/24.15+. A workflow that
 * builds the frontend, runs Playwright/Lighthouse, type-checks, or deploys must
 * not pin an older `node-version`. This test scans every workflow YAML and
 * fails loudly if it finds one.
 *
 * Run with: npm run test:workflows
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.resolve(__dirname, '..', '..', '.github', 'workflows');
const MIN_NODE_MAJOR = 24;

function findNodeVersions(content) {
    // Matches:  node-version: '18'  /  node-version: 18  /  node-version: "20.x"
    const regex = /node-version:\s*['"]?(\d+)(?:\.[\dx]+)?['"]?/g;
    const versions = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        versions.push({ major: parseInt(match[1], 10), raw: match[0], index: match.index });
    }
    return versions;
}

function lineNumberAt(content, index) {
    return content.slice(0, index).split('\n').length;
}

function run() {
    console.log('\n🧪 Workflow Node-version meta-test\n');
    console.log('='.repeat(60));

    if (!fs.existsSync(WORKFLOWS_DIR)) {
        console.log(`❌ Workflows directory not found: ${WORKFLOWS_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    const violations = [];
    let checked = 0;

    for (const file of files) {
        const full = path.join(WORKFLOWS_DIR, file);
        const content = fs.readFileSync(full, 'utf-8');
        for (const v of findNodeVersions(content)) {
            checked++;
            if (v.major < MIN_NODE_MAJOR) {
                violations.push(`${file}:${lineNumberAt(content, v.index)} → "${v.raw}" (needs Node ${MIN_NODE_MAJOR}+)`);
            }
        }
    }

    if (violations.length > 0) {
        console.log(`❌ Found ${violations.length} workflow(s) pinning Node < ${MIN_NODE_MAJOR}:`);
        violations.forEach(v => console.log(`   - ${v}`));
        console.log('='.repeat(60));
        process.exit(1);
    }

    console.log(`✅ All ${checked} node-version pin(s) across ${files.length} workflow file(s) use Node ${MIN_NODE_MAJOR}+`);
    console.log('='.repeat(60));
    process.exit(0);
}

run();
