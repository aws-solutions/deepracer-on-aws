# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import ast
import os
import sys
import unittest

sys.path.append(
    os.path.join(os.path.dirname(__file__), "..", "lib", "reward_func_validator")
)
from test_reward_function import parse


class TestParse(unittest.TestCase):
    """Test cases for the parse function that extracts function/attribute names from AST."""

    def _parse_code(self, code):
        """Helper method to parse code and return extracted names."""
        tree = ast.parse(code)
        results = []
        parse(tree, results)
        return results

    def test_simple_function_call(self):
        """Test parsing a simple function call."""
        code = "print('hello')"
        results = self._parse_code(code)
        self.assertIn("print", results)

    def test_method_call_on_object(self):
        """Test parsing a method call on an object."""
        code = "my_list.append(1)"
        results = self._parse_code(code)
        self.assertIn("my_list.append", results)

    def test_chained_attribute_access(self):
        """Test parsing chained attribute access."""
        code = "os.path.join('a', 'b')"
        results = self._parse_code(code)
        self.assertIn("os.path.join", results)

    def test_builtin_open(self):
        """Test parsing builtin open function."""
        code = "open('file.txt')"
        results = self._parse_code(code)
        self.assertIn("open", results)

    def test_builtin_eval(self):
        """Test parsing builtin eval function."""
        code = "eval('1+1')"
        results = self._parse_code(code)
        self.assertIn("eval", results)

    def test_builtin_exec(self):
        """Test parsing builtin exec function."""
        code = "exec('print(1)')"
        results = self._parse_code(code)
        self.assertIn("exec", results)

    def test_nested_function_calls(self):
        """Test parsing nested function calls."""
        code = "print(len(my_list))"
        results = self._parse_code(code)
        self.assertIn("print", results)
        self.assertIn("len", results)

    def test_function_with_attribute_argument(self):
        """Test parsing function call with attribute as argument."""
        code = "print(obj.value)"
        results = self._parse_code(code)
        self.assertIn("print", results)
        self.assertIn("obj.value", results)

    def test_multiple_statements(self):
        """Test parsing multiple statements."""
        code = """
x = len(items)
y = str(x)
print(y)
"""
        results = self._parse_code(code)
        self.assertIn("len", results)
        self.assertIn("str", results)
        self.assertIn("print", results)

    def test_function_definition_with_calls(self):
        """Test parsing function definition containing calls."""
        code = """
def reward_function(params):
    speed = params['speed']
    return float(speed * 10)
"""
        results = self._parse_code(code)
        self.assertIn("float", results)

    def test_class_method_call(self):
        """Test parsing class method calls."""
        code = "MyClass.static_method()"
        results = self._parse_code(code)
        self.assertIn("MyClass.static_method", results)

    def test_no_function_calls(self):
        """Test parsing code with no function calls."""
        code = """
x = 1
y = 2
z = x + y
"""
        results = self._parse_code(code)
        self.assertEqual(results, [])

    def test_attribute_access_without_call(self):
        """Test parsing attribute access without function call."""
        code = "value = obj.attr"
        results = self._parse_code(code)
        self.assertIn("obj.attr", results)

    def test_complex_reward_function(self):
        """Test parsing a realistic reward function."""
        code = """
def reward_function(params):
    track_width = params['track_width']
    distance_from_center = params['distance_from_center']
    
    marker_1 = 0.1 * track_width
    marker_2 = 0.25 * track_width
    
    if distance_from_center <= marker_1:
        reward = 1.0
    else:
        reward = float(0.5)
    
    return float(reward)
"""
        results = self._parse_code(code)
        self.assertIn("float", results)


if __name__ == "__main__":
    unittest.main()
