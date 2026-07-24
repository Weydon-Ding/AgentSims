# Negative Fixtures

This directory contains intentional type errors and other malformed inputs for testing the test harness.

## Purpose

Negative fixtures are used to verify that:
1. TypeScript compiler correctly rejects invalid code
2. The `run_negative_fixture.py` harness properly detects failures
3. CI/CD pipelines fail appropriately on type errors

## Files

- `type-error.fixture.ts` - Contains deliberate TypeScript type errors
- Additional fixtures can be added here as needed

## Usage

Run the negative fixture test harness:

```bash
python scripts/run_negative_fixture.py
```

Run self-test to verify the harness works:

```bash
python scripts/run_negative_fixture.py --self-test
```

## Adding New Fixtures

1. Create a new `.ts` file in this directory
2. Add intentional errors (type errors, syntax errors, etc.)
3. Document the expected failure mode below
4. Update `run_negative_fixture.py` if needed

## Expected Failures

| Fixture | Expected Error Type | Description |
|---------|--------------------|-------------|
| `type-error.fixture.ts` | TypeScript compilation errors | Deliberate type mismatches |
