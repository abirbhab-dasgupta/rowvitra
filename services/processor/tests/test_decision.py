import pytest
from fastapi.testclient import TestClient
from rowvitra.main import app
from rowvitra.decision import DecisionSpec, simulate
from rowvitra.engine import apply_operations, as_csv, parse_csv, DataError

SPEC = DecisionSpec(goal="highest", aggregation="sum", group="team", metric="sales")
CSV = "team,sales\nA,6\nA,6\nB,10\n"


def analyze(csv=CSV, spec=SPEC, ops=None):
    original = parse_csv(csv)
    before = original.copy()
    current = parse_csv(as_csv(apply_operations(original, ops or [])))
    snapshot = current.copy()
    result = simulate(original, current, ops or [], spec)
    assert original.equals(before) and current.equals(snapshot)
    return result


def test_duplicate_reverses_ranking_and_row_impact_is_measured():
    result = analyze()
    assert result["status"] == "Unstable"
    original, current, dedup, capped = result["scenarios"]
    assert original["winners"] == current["winners"] == capped["winners"] == ["A"]
    assert dedup["winners"] == ["B"]
    rows = result["critical"]["rows"]
    assert [r["rowId"] for r in rows] == ["1", "2"]
    assert all((r["before"], r["after"], r["rank"], r["afterRank"]) == (12, 6, 1, 2) for r in rows)


def test_lineage_across_delete_checkpoint_edit_and_rename():
    ops = [{"operation":"delete_rows","parameters":{"rowIds":["1"]}}, {"operation":"checkpoint"},
           {"operation":"edit_cell","column":"sales","parameters":{"rowId":"1","value":"6"}},
           {"operation":"rename_column","column":"team","parameters":{"name":"region"}}, {"operation":"checkpoint"}]
    result = analyze("team,sales\nZ,99\nA,4\nA,6\nB,10\n", SPEC.model_copy(update={"group":"region"}), ops)
    row = result["critical"]["rows"][0]
    assert row["rowId"] == "1" and row["originalValues"] == {"team":"A","sales":"4"}
    assert row["currentValues"] == {"region":"A","sales":"6"}
    assert result["scenarios"][0]["winners"] == ["Z"]


@pytest.mark.parametrize("csv,status", [
    ("team,sales\nA,2\nB,4\n", "Stable"),
    ("team,sales\nA,2\nB,2\n", "Inconclusive"),
    ("team,sales\nA,invalid\nB,inf\n", "Inconclusive"),
    ("team,sales\nA,1\n", "Inconclusive"),
])
def test_status(csv, status):
    assert analyze(csv)["status"] == status


def test_lowest_average_and_iqr():
    result = analyze("team,sales\nA,1\nA,1\nA,1\nA,81\nB,12\nB,12\nB,12\nB,12\n",
                     SPEC.model_copy(update={"goal":"lowest","aggregation":"mean"}))
    assert result["scenarios"][1]["winners"] == ["B"]
    assert result["scenarios"][3]["winners"] == ["A"]
    outlier = result["critical"]["rows"][0]
    assert outlier["before"] == 21 and outlier["after"] == 1 and outlier["effect"] == 20


def test_identifier_protection_and_missing_lineage():
    with pytest.raises(DataError, match="Protected"):
        analyze("team,sales\nA,001\nB,002\n")
    r = simulate(parse_csv(CSV), parse_csv(CSV.replace("6", "7")), [], SPEC)
    assert r["status"] == "Inconclusive"
    assert r["critical"]["rows"][0]["originalValues"] is None


def test_api_auth_and_validation(monkeypatch):
    monkeypatch.setenv("PROCESSOR_SERVICE_TOKEN", "decision-test")
    client = TestClient(app)
    payload = {"csv":CSV,"originalCsv":CSV,"spec":SPEC.model_dump()}
    assert client.post("/v1/decision", json=payload).status_code == 401
    headers = {"X-Processor-Token":"decision-test"}
    assert client.post("/v1/decision", json=payload, headers=headers).json()["status"] == "Unstable"
    payload["spec"]["metric"] = "__rv_row_id"
    assert client.post("/v1/decision", json=payload, headers=headers).status_code == 422
