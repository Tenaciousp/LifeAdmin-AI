"""Discoverable API regression tests."""
import pathlib
import sys

API_DIR = str(pathlib.Path(__file__).resolve().parents[1])
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)