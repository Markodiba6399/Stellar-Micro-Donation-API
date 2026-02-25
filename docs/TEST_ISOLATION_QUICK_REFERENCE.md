# Test Isolation Quick Reference

## Quick Commands

```bash
# Run all tests
npm test

# Run tests in random order
npm test -- --randomize

# Run specific test file
npm test tests/test-isolation.test.js

# Run with specific random seed
npm test -- --randomize --seed=123456
```

## Common Patterns

### 1. Clean Up Transaction Data

```javascript
const Transaction = require('../src/routes/models/transaction');

describe('My Tests', () => {
  beforeEach(() => {
    Transaction._clearAllData();
  });

  afterEach(() => {
    Transaction._clearAllData();
  });
});
```

### 2. Clean Up MockStellarService

```javascript
const { resetMockStellarService } = require('./helpers/testIsolation');

describe('My Tests', () => {
  let stellarService;

  beforeEach(() => {
    stellarService = getStellarService();
  });

  afterEach(() => {
    resetMockStellarService(stellarService);
  });
});
```

### 3. Isolate Environment Variables

```javascript
const { createIsolatedEnvironment } = require('./helpers/testIsolation');

describe('My Tests', () => {
  let cleanup;

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  it('test with custom env', () => {
    cleanup = createIsolatedEnvironment({
      DEBUG_MODE: 'true',
      NODE_ENV: 'test'
    });
    // test code
  });
});
```

### 4. Clean Up Database

```javascript
const { clearDatabaseTables } = require('./helpers/testIsolation');

describe('My Tests', () => {
  beforeEach(async () => {
    await clearDatabaseTables();
  });

  afterEach(async () => {
    await clearDatabaseTables();
  });
});
```

### 5. Reset Jest Mocks

```javascript
describe('My Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
});
```

### 6. Complete Isolation

```javascript
const { setupTestIsolation } = require('./helpers/testIsolation');

describe('My Tests', () => {
  const isolation = setupTestIsolation();

  beforeEach(async () => {
    await isolation.beforeEach({ TEST_MODE: 'true' });
  });

  afterEach(async () => {
    await isolation.afterEach();
  });
});
```

## Checklist for New Tests

- [ ] Add `beforeEach` to set up clean state
- [ ] Add `afterEach` to clean up after test
- [ ] Clear transaction data if creating donations
- [ ] Reset MockStellarService if using it
- [ ] Use `createIsolatedEnvironment()` for env vars
- [ ] Clear database tables if using database
- [ ] Call `jest.restoreAllMocks()` if using mocks
- [ ] Verify test passes in random order

## Common Issues

### Issue: Test passes alone but fails with others
**Solution**: Add cleanup hooks (beforeEach/afterEach)

### Issue: Test fails in random order
**Solution**: Check for shared state dependencies

### Issue: Environment variables leak
**Solution**: Use `createIsolatedEnvironment()` with cleanup

### Issue: Database records persist
**Solution**: Add `clearDatabaseTables()` in hooks

### Issue: Mocks persist between tests
**Solution**: Add `jest.restoreAllMocks()` in afterEach

## Verification

Run these commands to verify isolation:

```bash
# Run tests 5 times in random order
for i in {1..5}; do npm test -- --randomize; done

# Run isolation verification tests
npm test tests/test-isolation.test.js

# Check for flaky tests
npm test -- --randomize --seed=<seed-from-previous-run>
```

## Resources

- [Full Documentation](./TEST_ISOLATION.md)
- [Implementation Summary](./ISSUE_210_SUMMARY.md)
- [Test Isolation Utilities](../tests/helpers/testIsolation.js)
- [Verification Tests](../tests/test-isolation.test.js)
