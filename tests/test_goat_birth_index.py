import json
from math import isfinite
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"


@pytest.fixture(scope="module")
def goat_index():
    path = DATA_DIR / "goat_birth_index.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture(scope="module")
def state_legends():
    path = DATA_DIR / "state_birth_legends.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture(scope="module")
def world_legends():
    path = DATA_DIR / "world_birth_legends.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def test_goat_birth_index_rank_order(goat_index):
    players = goat_index.get("players", [])
    assert players, "GOAT index payload should include players"

    previous_score = float("inf")
    previous_rank = 0
    for player in players:
        rank = player["rank"]
        assert isinstance(rank, int) and rank > 0
        assert rank > previous_rank
        previous_rank = rank
        score = player["goatScore"]
        assert isinstance(score, (int, float)) and isfinite(score)
        assert score <= 100
        assert score <= previous_score + 1e-9
        previous_score = score


def _assert_top_group(entries: list[dict]) -> None:
    assert len(entries) <= 10
    previous_score = float("inf")
    for idx, entry in enumerate(entries, start=1):
        assert entry.get("groupRank") == idx
        score = entry.get("goatScore")
        assert isinstance(score, (int, float)) and isfinite(score)
        assert score <= previous_score + 1e-9
        previous_score = score
        franchises = entry.get("franchises") or []
        assert all(isinstance(team, str) and team for team in franchises)


def test_state_legends_top_players(state_legends):
    states = state_legends.get("states", [])
    assert states, "State legends payload should include entries"
    for state in states:
        top_players = state.get("topPlayers") or []
        _assert_top_group(top_players)

    michigan = next((item for item in states if item.get("state") == "MI"), None)
    assert michigan is not None
    top_michigan = michigan["topPlayers"][0]
    assert top_michigan["name"] == "Magic Johnson"
    assert top_michigan["rank"] == 5
    assert top_michigan["goatScore"] >= 70


def test_world_legends_top_players(world_legends):
    countries = world_legends.get("countries", [])
    assert countries, "World legends payload should include entries"
    for country in countries:
        top_players = country.get("topPlayers") or []
        _assert_top_group(top_players)

    virgin_islands = next((item for item in countries if item.get("country") == "VI"), None)
    assert virgin_islands is not None
    top_vi = virgin_islands["topPlayers"][0]
    assert top_vi["name"] == "Tim Duncan"
    assert top_vi["rank"] == 6
    assert top_vi["goatScore"] >= 70
