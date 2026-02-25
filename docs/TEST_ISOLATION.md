# Test Isolation Implementation

## Overview

This document describes the test isolation improvements implemented to ensure all tests are fully isolated and can run independently in any order.

## Problem Statement

Previously, some tests relied on shared state or execution order, which could lead to:
- Flaky test behavior
- Tests passing individually but failing when run together
- Tests failing when run in different orders
- Difficult-to-debug test failures

## Solution

### 1. Test Isolation Utilities (`tests/helpers/testIsolation.js`)

A comprehensive set of utilities to manage test isolation:

#### Core Functions

- **`resetAllState()`** - Resets all shared state (transactions, database, environment, module cache)
- **`clearDatabaseTables()`** - Clears database tables used in tests
- **`clearTestEnvironmentVariables()`** - Clears test-specific environment variables
- **`clearModuleCache()`** - Clears module cache for stateful modules
- **`resetMockStellarService(service)`** - Resets MockStellarService state
- **`createIsolatedEnvironment(envOverrides)`** - Creates isolated environment with cleanup
- **`setupTestIsolation()`** - Returns beforeEach/afterEach hooks for easy setup

### 2. Shared State Identified and Fixed

#### Transaction Model State
- **Issue**: Transaction data persisted between tests via JSON file
- **Fix**: Added `Transaction._clearAllData()` calls in beforeEach/afterEach hooks
- **Files Updated**: 
  - `tests/integration.test.js`
  - `tests/donation-routes-integration.test.js`
  - `tests/test-isolation.test.js`

#### MockStellarService State
- **Issue**: Wallets, transactions, and failure simulation state persisted between tests
- **Fix**: Added `resetMockStellarService()` calls in afterEach hooks
- **Files Updated**:
  - `tests/integration.test.js`
  - `tests/donation-routes-integration.test.js`
  - `tests/MockStellarService.test.js`

#### Database State
- **Issue**: Database records (idempotency keys, API keys) persisted between tests
- **Fix**: Added `clearDatabaseTables()` calls in beforeEach/afterEach hooks
- **Files Updated**:
  - `tests/idempotency-integration.test.js`
  - `tests/test-isolation.test.js`

#### Environment Variables
- **Issue**: Environment variable changes leaked between tests
- **Fix**: Used `createIsolatedEnvironment()` with cleanup functions
- **Files Updated**:
  - `tests/regression.test.js`
  - `tests/debug-mode.test.js`

#### Module Cache
- **Issue**: Modules with initialization logic retained state
- **Fix**: Added `clearModuleCache()` and `jest.resetModules()` calls
- **Files Updated**:
  - `tests/regression.test.js`
  - `tests/debug-mode.test.js`

#### Jest Mocks
- **Issue**: Jest mocks persisted between tests
- **Fix**: Added explicit `jest.restoreAllMocks()` in afterEach hooks
- **Files Updated**:
  - `tests/wallet-analytics-integration.test.js`

## Usage Examples

### Basic Cleanup

```javascript
const { resetMockStellarService } = require('./helpers/testIsolation');

describe('My Test Suite', () => {
  let stellarService;

  beforeEach(() => {
    stellarService = getStellarService();
  });

  afterEach(() => {
    resetMockStellarService(stellarService);
  });

  // tests...
});
```

### Environment Isolation

```javascript
const { createIsolatedEnvironment } = require('./helpers/testIsolation');

describe('Environment Tests', () => {
  let cleanup;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  it('should test with custom env', () => {
    cleanup = createIsolatedEnvironment({
      DEBUG_MODE: 'true',
      NODE_ENV: 'test'
    });

    // test code...
  });
});
```

### Complete Isolation

```javascript
const { setupTestIsolation } = require('./helpers/testIsolation');

describe('Complete Isolation', () => {
  const isolation = setupTestIsolation();

  beforeEach(async () => {
    await isolation.beforeEach({ TEST_MODE: 'true' });
  });

  afterEach(async () => {
    await isolation.afterEach();
  });

  // tests...
});
```

## Verification

### Test Isolation Verification Suite

A comprehensive test suite (`tests/test-isolation.test.js`) verifies that:

1. **Transaction Model Isolation** - Transactions don't leak between tests
2. **MockStellarService Isolation** - Wallets and state are cleaned up
3. **Environment Variable Isolation** - Env changes are reverted
4. **Database Isolation** - Database tables are cleared
5. **Module Cache Isolation** - Modules can be reloaded
6. **Order Independence** - Tests pass regardless of execution order

### Running Tests in Random Order

```bash
# Run tests in random order
npm test -- --randomize

# Run with specific seed to reproduce order
npm test -- --randomize --seed=123456

# Run multiple times to verify stability
for i in {1..5}; do npm test -- --randomize; done
```

## Best Practices

### 1. Always Clean Up After Tests

```javascript
afterEach(() => {
  // Clean up any state created during test
  Transaction._clearAllData();
  resetMockStellarService(service);
});
```

### 2. Use Isolated Environments for Environment Variables

```javascript
// ❌ Bad - leaks between tests
it('test', () => {
  process.env.DEBUG_MODE = 'true';
  // test code
});

// ✅ Good - isolated with cleanup
it('test', () => {
  const cleanup = createIsolatedEnvironment({ DEBUG_MODE: 'true' });
  // test code
  cleanup();
});
```

### 3. Clear Database State

```javascript
beforeEach(async () => {
  await clearDatabaseTables();
});

afterEach(async () => {
  await clearDatabaseTables();
});
```

### 4. Reset Mocks

```javascript
afterEach(() => {
  jest.restoreAllMocks();
});
```

### 5. Clear Module Cache When Testing Initialization

```javascript
beforeEach(() => {
  jest.resetModules();
  clearModuleCache();
});
```

## Acceptance Criteria Met

✅ **Tests pass regardless of execution order** - Verified with `--randomize` flag  
✅ **No flaky behavior** - Multiple random runs show consistent results  
✅ **Identified shared state between tests** - Documented all sources of shared state  
✅ **Reset or mock state properly** - Implemented comprehensive cleanup utilities  
✅ **Ensure order-independent execution** - All tests can run in any order  

## Test Results

```bash
# Standard run
Test Suites: 24 passed, 24 total
Tests:       3 skipped, 455 passed, 458 total

# Random order (5 runs)
All runs: 24 passed, 24 total
All runs: 3 skipped, 455 passed, 458 total
```

## Files Modified

### New Files
- `tests/helpers/testIsolation.js` - Test isolation utilities
- `tests/test-isolation.test.js` - Verification tests
- `docs/TEST_ISOLATION.md` - This documentation

### Updated Files
- `tests/integration.test.js` - Added cleanup hooks
- `tests/donation-routes-integration.test.js` - Added cleanup hooks
- `tests/idempotency-integration.test.js` - Added database cleanup
- `tests/wallet-analytics-integration.test.js` - Added mock cleanup
- `tests/regression.test.js` - Used isolated environment helper
- `tests/debug-mode.test.js` - Used isolated environment helper
- `tests/MockStellarService.test.js` - Added cleanup hooks

## Future Improvements

1. **Automated Detection** - Add linting rules to detect missing cleanup hooks
2. **Test Fixtures** - Create reusable test fixtures with automatic cleanup
3. **Database Transactions** - Use database transactions for test isolation where possible
4. **Parallel Execution** - Enable parallel test execution with proper isolation
5. **Performance Monitoring** - Track test execution time to detect isolation overhead

## References

- [Jest Best Practices](https://jestjs.io/docs/setup-teardown)
- [Test Isolation Patterns](https://kentcdodds.com/blog/test-isolation-with-react)
- Issue #210: Improve Test Isolation
