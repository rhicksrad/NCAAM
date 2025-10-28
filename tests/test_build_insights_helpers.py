"""Unit tests for helper utilities in :mod:`scripts.build_insights`."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from scripts import build_insights


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("3.5", 3.5),
        (" 2 ", 2.0),
        ("", None),
        (None, None),
        ("not-a-number", None),
    ],
)
def test_to_float(raw: str | None, expected: float | None) -> None:
    """``_to_float`` should gracefully coerce numeric strings to floats."""

    result = build_insights._to_float(raw)
    if expected is None:
        assert result is None
    else:
        assert result == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("3", 3),
        (" 9.0 ", 9),
        ("", None),
        (None, None),
        ("abc", None),
    ],
)
def test_to_int(raw: str | None, expected: int | None) -> None:
    """``_to_int`` coerces stringified numbers to integers or returns ``None``."""

    assert build_insights._to_int(raw) == expected


@pytest.mark.parametrize(
    "raw",
    ["1", "true", "Yes", "T", " true "],
)
def test_to_bool_truthy(raw: str) -> None:
    """Truthy values should be converted to ``True``."""

    assert build_insights._to_bool(raw) is True


@pytest.mark.parametrize(
    "raw",
    [None, "0", "false", "", "random"],
)
def test_to_bool_falsy(raw: str | None) -> None:
    """Falsy or unexpected values should be converted to ``False``."""

    assert build_insights._to_bool(raw) is False


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2024-10-01", 2024),
        ("2024-10-01 19:00:00", 2024),
        ("", None),
        (None, None),
        ("not-a-date", None),
    ],
)
def test_year_from_date(raw: str | None, expected: int | None) -> None:
    """Year parsing should support date and datetime strings."""

    assert build_insights._year_from_date(raw) == expected


def test_decade_label() -> None:
    """Decade labels should round down to the nearest ten and append ``s``."""

    assert build_insights._decade_label(1994) == "1990s"
    assert build_insights._decade_label(2000) == "2000s"


def test_push_top_skips_nan() -> None:
    """``_push_top`` must ignore ``NaN`` keys to avoid polluting the heap."""

    heap: list[tuple[float, dict[str, int]]] = []
    build_insights._push_top(heap, float("nan"), {"value": 1}, size=3)
    assert heap == []


def test_push_top_bounds_and_orders() -> None:
    """Ensure the heap keeps only the ``size`` largest entries in sorted order."""

    heap: list[tuple[float, dict[str, int]]] = []
    for score in [1.0, 5.0, 3.0, 10.0, 7.5]:
        build_insights._push_top(heap, score, {"score": score}, size=3)

    assert len(heap) == 3
    scores = [item["score"] for item in build_insights._sorted_heap(heap)]
    assert scores == [10.0, 7.5, 5.0]
