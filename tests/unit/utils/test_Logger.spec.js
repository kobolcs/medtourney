/**
 * Unit tests for Logger
 * Runs the REAL Logger (compiled to dist-test/ by `npm run build:test`) with
 * the console methods captured. Outside a Vite build __DEV__ is undefined,
 * so the logger is in development mode (debug/info are printed).
 */

const { loadProductionModule } = require('../../helpers/production');
const { Logger } = loadProductionModule('utils/Logger.js');

const LEVELS = ['debug', 'info', 'warn', 'error'];

// Replace console.debug/info/warn/error, run fn, restore; returns the calls
function captureConsole(fn) {
    const calls = [];
    const saved = {};
    for (const level of LEVELS) {
        saved[level] = console[level];
        console[level] = (...args) => calls.push({ level, args });
    }
    try {
        fn();
    } finally {
        Object.assign(console, saved);
    }
    return calls;
}

function runTests() {
    console.log('\n🧪 Running Logger Unit Tests\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.log(`❌ ${name}`);
            console.log(`   Error: ${error.message}`);
            failed++;
        }
    }

    function assertEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }

    function assert(condition, message) {
        if (!condition) throw new Error(message || 'Assertion failed');
    }

    const PREFIX = /^\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[(DEBUG|INFO|WARN|ERROR)\] /;

    test('Each level goes to the matching console method with a timestamped prefix', () => {
        const calls = captureConsole(() => {
            Logger.debug('d');
            Logger.info('i');
            Logger.warn('w');
            Logger.error('e');
        });
        assertEqual(calls.map(c => c.level), LEVELS);
        calls.forEach(c => {
            assert(PREFIX.test(c.args[0]), `prefix: ${c.args[0]}`);
            assertEqual(c.args[0].match(PREFIX)[1], c.level.toUpperCase());
        });
    });

    test('Without metadata only the message is passed', () => {
        const [call] = captureConsole(() => Logger.warn('plain'));
        assertEqual(call.args.length, 1);
        assert(call.args[0].endsWith(' plain'));
    });

    test('Metadata is passed as a second argument', () => {
        const [call] = captureConsole(() => Logger.info('with meta', { count: 3 }));
        assertEqual(call.args[1], { metadata: { count: 3 } });
    });

    test('error() includes name, message and stack of an Error', () => {
        const err = new TypeError('boom');
        const [call] = captureConsole(() => Logger.error('failed', err, { url: 'x' }));
        assertEqual(call.args[1].metadata, { url: 'x' });
        assertEqual(call.args[1].error.name, 'TypeError');
        assertEqual(call.args[1].error.message, 'boom');
        assert(call.args[1].error.stack.includes('boom'), 'stack');
    });

    test('error() with a non-Error value logs no error details', () => {
        const [call] = captureConsole(() => Logger.error('failed', 'just a string'));
        assertEqual(call.args.length, 1);
    });

    test('Development mode sends nothing to monitoring', () => {
        const calls = captureConsole(() => Logger.error('failed', new Error('x')));
        assertEqual(calls.length, 1, 'only the log line, no "Error logged:" monitoring call');
    });

    test('Scoped logger adds its scope to the metadata at every level', () => {
        const log = Logger.createScoped('DataService');
        const calls = captureConsole(() => {
            log.debug('d', { a: 1 });
            log.info('i');
            log.warn('w');
            log.error('e', new Error('x'));
        });
        assertEqual(calls.map(c => c.args[1].metadata.scope), ['DataService', 'DataService', 'DataService', 'DataService']);
        assertEqual(calls[0].args[1].metadata, { a: 1, scope: 'DataService' });
        assertEqual(calls[3].args[1].error.message, 'x');
    });

    console.log('='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log(`✨ Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    return failed === 0 ? 0 : 1;
}

process.exit(runTests());
