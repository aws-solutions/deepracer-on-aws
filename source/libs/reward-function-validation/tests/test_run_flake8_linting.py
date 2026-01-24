# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import sys
import unittest

sys.path.append(
    os.path.join(os.path.dirname(__file__), "..", "lib", "reward_func_validator")
)
from reward_function_fixtures import (
    ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED,
    ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING,
    BASIC_REWARD_FUNCTION,
    OBJECT_AVOIDANCE_REWARD_FUNCTION,
)
from test_reward_function import run_flake8


class TestRunFlake8Linting(unittest.TestCase):
    """Test cases for the run_flake8 function linting capabilities."""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.reward_function_path = "/tmp/reward_function.py" # NOSONAR

    def tearDown(self):
        """Clean up after each test method."""
        if os.path.exists(self.reward_function_path):
            os.remove(self.reward_function_path)

    def _write_test_code(self, code):
        """Helper method to write test code to the expected file path."""
        with open(self.reward_function_path, "w") as f:
            f.write(code)

    def _run_flake8_and_get_result(self, code):
        """Helper method to write code and run flake8."""
        self._write_test_code(code)
        return run_flake8()

    def _get_message_text(self, error_dict):
        """Helper method to extract message text from error dict, handling both string and list cases."""
        message = error_dict.get("message", "")
        if isinstance(message, list):
            return " ".join(str(m) for m in message).lower()
        else:
            return str(message).lower()

    def _assert_error_like(self, result, expected_error):
        """
        Assert that result contains an error matching the expected structure.

        Args:
            result: List of error dictionaries from run_flake8
            expected_error: Dict with expected error properties like:
                {
                    'type': 'F821',
                    'message_contains': 'undefined',
                    'has_line_number': True,
                    'has_line': True
                }
        """
        # Find errors matching the expected type
        matching_errors = [
            item
            for item in result
            if isinstance(item, dict) and item.get("type") == expected_error["type"]
        ]

        self.assertGreater(
            len(matching_errors),
            0,
            f"Should find at least one error of type {expected_error['type']}",
        )

        # Validate the first matching error
        error = matching_errors[0]

        # Check required fields exist
        required_fields = ["type", "message", "lineNumber", "line"]
        for field in required_fields:
            self.assertIn(field, error, f"Error should have '{field}' field")

        # Check message content if specified
        if "message_contains" in expected_error:
            message_text = self._get_message_text(error)
            self.assertIn(
                expected_error["message_contains"].lower(),
                message_text,
                f"Error message should contain '{expected_error['message_contains']}'",
            )

        # Check line number is valid if specified
        if expected_error.get("has_line_number", True):
            line_num = error.get("lineNumber", "")
            self.assertTrue(
                str(line_num).isdigit() or line_num == "",
                "lineNumber should be numeric or empty",
            )

        return error

    def test_valid_code(self):
        """Test that valid code produces no flake8 errors."""
        code = '''
def reward_function(params):
    """A valid reward function."""
    speed = params['speed']
    return float(speed * 10)
'''
        result = self._run_flake8_and_get_result(code)
        self.assertEqual(result, [], "Valid code should produce no flake8 errors")

    def test_syntax_error_missing_parenthesis(self):
        """Test detection of syntax error with missing parenthesis."""
        code = """
def reward_function(params):
    speed = params['speed'
    return speed * 10
"""
        result = self._run_flake8_and_get_result(code)
        self.assertGreater(len(result), 0, "Should detect syntax error")

        self._assert_error_like(
            result,
            {
                "type": "SyntaxError",
                "message_contains": "never closed",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_syntax_error_missing_colon(self):
        """Test detection of syntax error with missing colon."""
        code = """
def reward_function(params)
    speed = params['speed']
    return speed * 10
"""
        result = self._run_flake8_and_get_result(code)
        self.assertGreater(len(result), 0, "Should detect syntax error")

        self._assert_error_like(
            result,
            {
                "type": "SyntaxError",
                "message_contains": "expected",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_undefined_variable(self):
        """Test detection of undefined variable."""
        code = """
def reward_function(params):
    speed = params['speed']
    return undefined_variable * 10
"""
        result = self._run_flake8_and_get_result(code)
        self.assertGreater(len(result), 0, "Should detect undefined variable")

        self._assert_error_like(
            result,
            {
                "type": "F821",
                "message_contains": "undefined",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_import_error(self):
        """Test handling of import-related issues."""
        code = """
import nonexistent_module

def reward_function(params):
    return nonexistent_module.some_function()
"""
        result = self._run_flake8_and_get_result(code)
        # With --ignore=E5, E502 (missing blank lines) should be ignored
        # But we might still get other E-category errors that aren't E5xx
        # This test mainly verifies the function handles import scenarios
        self.assertIsInstance(result, list, "Should return a list")

    def test_indentation_error(self):
        """Test detection of indentation error."""
        code = """
def reward_function(params):
speed = params['speed']
    return speed * 10
"""
        result = self._run_flake8_and_get_result(code)
        self.assertGreater(len(result), 0, "Should detect indentation error")

        self._assert_error_like(
            result,
            {
                "type": "IndentationError",
                "message_contains": "indent",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_multiple_errors(self):
        """Test handling of multiple simultaneous errors."""
        code = """
import nonexistent_module

def reward_function(params):
speed = params['speed'
    return undefined_var + nonexistent_module.func()
"""
        result = self._run_flake8_and_get_result(code)
        self.assertGreater(len(result), 0, "Should detect multiple errors")

        self._assert_error_like(
            result,
            {
                "type": "IndentationError",
                "message_contains": "indent",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_empty_file(self):
        """Test handling of empty file."""
        code = ""
        result = self._run_flake8_and_get_result(code)
        self.assertEqual(result, [], "Empty file should produce no errors")

    def test_only_comments(self):
        """Test handling of comment-only file."""
        code = '''
# This is a comment
# Another comment
""" This is a docstring """
'''
        result = self._run_flake8_and_get_result(code)
        self.assertEqual(result, [], "Comment-only file should produce no errors")

    def test_division_by_zero_static_analysis(self):
        """Test that division by zero is not caught by static analysis."""
        code = """
def reward_function(params):
    return 10 / 0
"""
        result = self._run_flake8_and_get_result(code)
        # Should not detect division by zero (runtime error) - static analysis can't catch this
        self.assertEqual(
            result, [], "Static analysis should not catch runtime division by zero"
        )

    def test_unused_import(self):
        """Test detection of unused imports."""
        code = """
import math
import os

def reward_function(params):
    speed = params['speed']
    return speed * 10
"""
        result = self._run_flake8_and_get_result(code)
        self.assertGreater(len(result), 0, "Should detect unused imports")

        self._assert_error_like(
            result,
            {
                "type": "F401",
                "message_contains": "unused",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_function_returns_list(self):
        """Test that run_flake8 returns a list."""
        code = """
def reward_function(params):
    return 1.0
"""
        result = self._run_flake8_and_get_result(code)
        self.assertIsInstance(result, list, "run_flake8 should return a list")

    def test_function_handles_exceptions(self):
        """Test that run_flake8 handles exceptions gracefully."""
        # Test with a file that doesn't exist (should be handled by the function)
        if os.path.exists(self.reward_function_path):
            os.remove(self.reward_function_path)

        # This should not raise an exception but handle it internally
        try:
            result = run_flake8()
            # The function should handle the missing file gracefully
            self.assertIsInstance(
                result, list, "Should return a list even with missing file"
            )
        except Exception as e:
            self.fail(
                f"run_flake8 should handle missing file gracefully, but raised: {e}"
            )

    def test_result_structure(self):
        """Test that results have the expected structure."""
        code = """
def reward_function(params):
    return undefined_variable
"""
        result = self._run_flake8_and_get_result(code)

        if result:
            self._assert_error_like(
                result,
                {
                    "type": "F821",
                    "message_contains": "undefined",
                    "has_line_number": True,
                    "has_line": True,
                },
            )

    def test_flake8_options_select_e_and_f_only(self):
        """Test that flake8 only selects E and F category errors due to --select=E,F option."""
        code = """
import math
def reward_function(params):
    x=1+2  # This could trigger W (warning) categories in some linters
    return undefined_variable
"""
        result = self._run_flake8_and_get_result(code)

        if result:
            # All error types should start with E or F due to --select=E,F
            for item in result:
                if isinstance(item, dict):
                    error_type = item.get("type", "")
                    self.assertTrue(
                        error_type.startswith("E") or error_type.startswith("F"),
                        f"Error type '{error_type}' should start with E or F due to --select=E,F option",
                    )

            # Also verify we get the expected F821 error
            self._assert_error_like(
                result,
                {
                    "type": "F821",
                    "message_contains": "undefined",
                    "has_line_number": True,
                    "has_line": True,
                },
            )

    def test_flake8_options_ignore_e5_errors(self):
        """Test that E5xx errors are ignored due to --ignore=E5 option."""
        code = """
import math


def reward_function(params):  # This might normally trigger E302 (expected 2 blank lines)
    return params['speed']
"""
        result = self._run_flake8_and_get_result(code)

        # Check that no E5xx errors are present
        if result:
            for item in result:
                if isinstance(item, dict):
                    error_type = item.get("type", "")
                    self.assertFalse(
                        error_type.startswith("E5"),
                        f"Error type '{error_type}' should be ignored due to --ignore=E5 option",
                    )

            self._assert_error_like(
                result,
                {
                    "type": "F401",
                    "message_contains": "unused",
                    "has_line_number": True,
                    "has_line": True,
                },
            )

    def test_flake8_options_still_catches_other_e_errors(self):
        """Test that non-E5xx E-category errors are still caught."""
        code = """
def reward_function(params):
    # This should trigger E999 (syntax error) or similar non-E5xx errors
    if True
        return 1.0
"""
        result = self._run_flake8_and_get_result(code)

        self.assertGreater(len(result), 0, "Should catch non-E5xx errors")

        self._assert_error_like(
            result,
            {
                "type": "SyntaxError",
                "message_contains": "expected",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_flake8_error_message_format(self):
        """Test that the error message format is correctly parsed with new options."""
        code = """
def reward_function(params):
    return undefined_var
"""
        result = self._run_flake8_and_get_result(code)

        self._assert_error_like(
            result,
            {
                "type": "F821",
                "message_contains": "undefined",
                "has_line_number": True,
                "has_line": True,
            },
        )

    def test_basic_reward_function_valid(self):
        """Test that the BASIC_REWARD_FUNCTION from UI constants is valid."""
        result = self._run_flake8_and_get_result(BASIC_REWARD_FUNCTION)
        self.assertEqual(
            result, [], "Basic reward function should have no linting errors"
        )

    def test_advanced_reward_function_penalizing_steering_valid(self):
        """Test that the ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING from UI constants is valid."""
        result = self._run_flake8_and_get_result(
            ADVANCED_REWARD_FUNCTION_PENALIZING_STEERING
        )
        self.assertEqual(
            result,
            [],
            "Advanced reward function (penalizing steering) should have no linting errors",
        )

    def test_advanced_reward_function_penalizing_speed_valid(self):
        """Test that the ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED from UI constants is valid."""
        result = self._run_flake8_and_get_result(
            ADVANCED_REWARD_FUNCTION_PENALIZING_SPEED
        )
        self.assertEqual(
            result,
            [],
            "Advanced reward function (penalizing speed) should have no linting errors",
        )

    def test_object_avoidance_reward_function_valid(self):
        """Test that the OBJECT_AVOIDANCE_REWARD_FUNCTION from UI constants is valid."""
        result = self._run_flake8_and_get_result(OBJECT_AVOIDANCE_REWARD_FUNCTION)
        self.assertEqual(
            result, [], "Object avoidance reward function should have no linting errors"
        )


if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTest(loader.loadTestsFromTestCase(TestRunFlake8Linting))

    # Run the tests with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print(f"\n{'=' * 60}")
    print("TEST SUMMARY")
    print(f"{'=' * 60}")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(
        f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%"
    )

    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() else 1)
