#!/usr/bin/env python3
"""
Negative Fixture Test Runner

Runs TypeScript compilation on negative fixtures and verifies that they fail as expected.
Supports --self-test mode to validate the harness itself, and --fixture for JSON-based fixtures.

Usage:
    python run_negative_fixture.py              # Run all negative fixtures
    python run_negative_fixture.py --self-test  # Run self-test to verify harness works
    python run_negative_fixture.py --fixture <path/to/fixture.json>  # Run JSON fixture
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional


def get_script_dir() -> Path:
    """Get the directory containing this script."""
    return Path(__file__).parent.resolve()


def get_frontend_root() -> Path:
    """Get the frontend root directory."""
    return get_script_dir().parent.resolve()


def get_fixture_dir() -> Path:
    """Get the negative fixtures directory."""
    return get_frontend_root() / "test-fixtures" / "negative"


def create_temp_fixture_dir(fixture_dir: Path) -> Tuple[Path, Path]:
    """
    Create a temporary directory with a copy of the fixture.
    Returns (temp_dir, fixture_copy_path).
    """
    temp_dir = Path(tempfile.mkdtemp(prefix="negative_fixture_"))
    fixture_copy = temp_dir / fixture_dir.name
    shutil.copytree(fixture_dir, fixture_copy)
    return temp_dir, fixture_copy


def cleanup_temp_dir(temp_dir: Path) -> None:
    """Clean up a temporary directory."""
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)


def run_tsc_check(fixture_path: Path, frontend_root: Path) -> Tuple[bool, str, int]:
    """
    Run TypeScript compiler check on a fixture.
    Returns (success, output, return_code).
    """
    # Create a minimal tsconfig for the fixture
    tsconfig = {
        "compilerOptions": {
            "strict": True,
            "noEmit": True,
            "skipLibCheck": False,
            "target": "ES2020",
            "module": "ESNext",
            "moduleResolution": "bundler",
        },
        "include": [str(fixture_path)],
    }

    temp_dir = fixture_path.parent
    tsconfig_path = temp_dir / "tsconfig.fixture.json"

    with open(tsconfig_path, "w", encoding="utf-8") as f:
        json.dump(tsconfig, f, indent=2)

    try:
        # Run tsc on the fixture (use npx for cross-platform compatibility)
        result = subprocess.run(
            [
                "npx",
                "tsc",
                "--project",
                str(tsconfig_path),
            ],
            cwd=str(frontend_root),
            capture_output=True,
            text=True,
            timeout=30,
            shell=True,  # Required on Windows for npx
        )
        return result.returncode == 0, result.stdout + result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return False, "Timeout", -1
    except FileNotFoundError:
        return False, "TypeScript not found - run 'npm install' first", -1
    finally:
        # Clean up tsconfig
        if tsconfig_path.exists():
            tsconfig_path.unlink()


def run_json_fixture(fixture_path: Path, frontend_root: Path) -> Tuple[bool, str, int]:
    """
    Run a JSON-defined fixture.
    
    JSON fixture format:
    {
        "name": "fixture name",
        "type": "typescript" | "shell",
        "command": "npm run typecheck" | "npx tsc ...",  // used for type=shell
        "expect_fail": true,
        "files": ["test-fixtures/negative/type-error.fixture.ts"],  // for type=typescript
        "temp_dir": true  // whether to use temp directory (default: false)
    }
    
    Returns (success, output, return_code).
    """
    with open(fixture_path, 'r', encoding='utf-8') as f:
        fixture = json.load(f)
    
    fixture_name = fixture.get('name', fixture_path.name)
    fixture_type = fixture.get('type', 'typescript')
    command = fixture.get('command', '')
    expect_fail = fixture.get('expect_fail', True)
    files = fixture.get('files', [])
    use_temp = fixture.get('temp_dir', False)
    
    print(f"\nRunning JSON fixture: {fixture_name}")
    print(f"  Type: {fixture_type}")
    print(f"  Files: {files}")
    print(f"  Expect fail: {expect_fail}")
    print(f"  Use temp dir: {use_temp}")
    
    temp_dir = None
    
    try:
        if fixture_type == 'typescript' and files:
            # For TypeScript fixtures, compile each file and check for errors
            all_outputs = []
            all_failed = False
            
            for file_rel_path in files:
                file_path = frontend_root / file_rel_path
                if not file_path.exists():
                    return False, f"File not found: {file_path}", -1
                
                if use_temp:
                    # Copy file to temp dir and compile from there
                    temp_dir = Path(tempfile.mkdtemp(prefix="negative_fixture_"))
                    temp_file = temp_dir / file_path.name
                    
                    # Create minimal tsconfig in temp dir
                    tsconfig = {
                        "compilerOptions": {
                            "strict": True,
                            "noEmit": True,
                            "skipLibCheck": False,
                            "target": "ES2020",
                            "module": "ESNext",
                            "moduleResolution": "bundler",
                        },
                        "include": [file_path.name],
                    }
                    tsconfig_path = temp_dir / "tsconfig.fixture.json"
                    with open(tsconfig_path, 'w', encoding='utf-8') as f:
                        json.dump(tsconfig, f, indent=2)
                    
                    shutil.copy2(file_path, temp_file)
                    
                    # Run tsc in temp dir
                    result = subprocess.run(
                        ["npx", "tsc", "--project", str(tsconfig_path)],
                        cwd=str(temp_dir),
                        capture_output=True,
                        text=True,
                        timeout=30,
                        shell=True,
                    )
                    
                    # Cleanup temp dir
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    temp_dir = None
                    
                    # Also clean up tsconfig if it still exists
                    if tsconfig_path.exists():
                        tsconfig_path.unlink()
                else:
                    # Use existing run_tsc_check
                    success, output, code = run_tsc_check(file_path, frontend_root)
                    result = type('Result', (), {'returncode': code, 'stdout': '', 'stderr': output})()
                
                output = result.stdout + result.stderr
                all_outputs.append(f"{file_rel_path}: exit={result.returncode}\n{output}")
                
                if result.returncode == 0:
                    all_failed = False  # Compilation succeeded (unexpected for negative fixture)
                else:
                    all_failed = True  # Compilation failed (expected for negative fixture)
            
            output = "\n---\n".join(all_outputs)
            actual_fail = all_failed
            
        elif fixture_type == 'shell':
            # For shell commands, just run the command
            if not command:
                return False, "No command specified for shell fixture", -1
            
            print(f"  Command: {command}")
            result = subprocess.run(
                command,
                cwd=str(frontend_root),
                capture_output=True,
                text=True,
                timeout=60,
                shell=True,
            )
            output = result.stdout + result.stderr
            actual_fail = result.returncode != 0
        else:
            return False, f"Unknown fixture type: {fixture_type}", -1
        
        # Check if result matches expectation
        if expect_fail == actual_fail:
            print(f"  PASS: Result matches expectation (exit code={'non-zero' if actual_fail else 0})")
            return True, output, 0 if actual_fail else 1
        else:
            print(f"  FAIL: Expected fail={expect_fail}, got fail={actual_fail}")
            return False, output, 0 if actual_fail else 1
            
    except subprocess.TimeoutExpired:
        return False, "Timeout", -1
    except Exception as e:
        return False, str(e), -1
    finally:
        # Ensure temp dir cleanup
        if temp_dir and temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
            print(f"  Cleanup: removed temp dir {temp_dir}")


def run_self_test() -> bool:
    """
    Run self-test: verify the harness correctly detects failures.
    Returns True if self-test passes.
    """
    print("Running self-test...")

    frontend_root = get_frontend_root()
    fixture_dir = get_fixture_dir()

    if not fixture_dir.exists():
        print("ERROR: Fixture directory does not exist:", fixture_dir)
        return False

    # Find all .ts fixture files
    fixture_files = list(fixture_dir.glob("*.ts"))
    if not fixture_files:
        print("ERROR: No fixture files found in", fixture_dir)
        return False

    print(f"Found {len(fixture_files)} fixture file(s)")

    all_passed = True
    for fixture_file in fixture_files:
        print(f"\nTesting fixture: {fixture_file.name}")

        # For negative fixtures, we expect compilation to FAIL
        success, output, code = run_tsc_check(fixture_file, frontend_root)

        if success:
            print(f"  FAIL: Expected compilation to fail, but it succeeded")
            all_passed = False
        else:
            print(f"  PASS: Compilation failed as expected (code={code})")

    return all_passed


def run_fixtures() -> bool:
    """
    Run all negative fixtures and verify they fail.
    Returns True if all fixtures behave as expected.
    """
    print("Running negative fixtures...")

    frontend_root = get_frontend_root()
    fixture_dir = get_fixture_dir()

    if not fixture_dir.exists():
        print("ERROR: Fixture directory does not exist:", fixture_dir)
        return False

    fixture_files = list(fixture_dir.glob("*.ts"))
    if not fixture_files:
        print("ERROR: No fixture files found in", fixture_dir)
        return False

    print(f"Found {len(fixture_files)} fixture file(s)")

    results = []
    for fixture_file in fixture_files:
        print(f"\nChecking fixture: {fixture_file.name}")
        success, output, code = run_tsc_check(fixture_file, frontend_root)

        # Negative fixtures should FAIL to compile
        if success:
            print(f"  UNEXPECTED: Compilation succeeded (should have failed)")
            results.append((fixture_file.name, False, "Compilation succeeded unexpectedly"))
        else:
            print(f"  EXPECTED: Compilation failed (code={code})")
            results.append((fixture_file.name, True, "Failed as expected"))

    # Summary
    print("\n" + "=" * 50)
    print("Summary:")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"  {passed}/{total} fixtures behaved as expected")

    if passed == total:
        print("\nAll negative fixtures passed!")
        return True
    else:
        print("\nSome fixtures did not behave as expected:")
        for name, ok, msg in results:
            if not ok:
                print(f"  - {name}: {msg}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run negative fixture tests for TypeScript compilation"
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Run self-test to verify the harness works correctly",
    )
    parser.add_argument(
        "--fixture",
        type=str,
        help="Path to a JSON fixture file to run",
    )
    args = parser.parse_args()

    frontend_root = get_frontend_root()

    if args.fixture:
        # Run JSON fixture
        fixture_path = Path(args.fixture)
        if not fixture_path.exists():
            print(f"ERROR: Fixture file not found: {fixture_path}")
            return 1
        success, output, code = run_json_fixture(fixture_path, frontend_root)
        print(f"\nFixture result: {'PASS' if success else 'FAIL'} (code={code})")
        return 0 if success else 1
    elif args.self_test:
        success = run_self_test()
    else:
        success = run_fixtures()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
