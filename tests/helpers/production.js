/**
 * Helper to load REAL compiled production code for unit tests.
 *
 * Production services are written in TypeScript. `npm run build:test` compiles
 * the relevant sources to CommonJS under `dist-test/` so these Node-based unit
 * tests can `require` and exercise the actual implementation — never a
 * duplicated/fake copy living inside the test file.
 */

const path = require('path');
const fs = require('fs');

function loadProductionModule(relPath) {
    const full = path.resolve(__dirname, '..', '..', 'dist-test', relPath);
    if (!fs.existsSync(full)) {
        console.error(`\n❌ Production build not found: ${full}`);
        console.error('   Run "npm run build:test" first (the npm test scripts do this automatically).\n');
        process.exit(1);
    }
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(full);
}

module.exports = { loadProductionModule };
