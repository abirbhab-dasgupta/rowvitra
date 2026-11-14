import csv
import os
import subprocess
import sys
import tempfile
from pathlib import Path
import pytest
from rowvitra.engine import (parse_csv, as_csv, protected_columns, get_profile, apply_operations, preview, DataError, check_rules, chart_query, generate_script)

SAMPLE = "order_id,region,sales,age\n001,North,100,20\n002,NORTH,200,21\n003,north ,300,-5\n004,South,400,\n004,South,400,\n"

def test_preserves_leading_zero_identifiers():
    f = parse_csv(SAMPLE)
    assert f.iloc[0]["order_id"] == "001"
    assert "order_id" in protected_columns(f)
    assert "001" in as_csv(f)

def test_profile_detects_missing_duplicates_categories_goal():
    p = get_profile(parse_csv(SAMPLE), "Sales by region")
    assert p["rowCount"] == 5 and p["duplicateRows"] == 1
    assert any(i["kind"]=="inconsistent_category" for i in p["issues"])
    assert any(i["kind"]=="missing" and i["column"]=="age" for i in p["issues"])
    assert any(i["goalRelevant"] for i in p["issues"] if i["column"] == "region")

def test_protected_column_reject_bulk_changes():
    with pytest.raises(DataError,match="protected"):
        apply_operations(parse_csv(SAMPLE), [{"operation":"cast_numeric","column":"order_id"}])

def test_explicit_manual_identifier_edit():
    p = preview(parse_csv(SAMPLE),[{"operation":"edit_cell","column":"order_id","parameters":{"rowId":"1","value":"0001"}}])
    assert "0001" in p["csv"] and p["diff"]["totalCellChanges"] == 1

def test_normalize_batch_preview_diffs_and_duplicates():
    p = preview(parse_csv(SAMPLE),[{"operation":"normalize_category","column":"region"},{"operation":"drop_duplicates"}])
    assert p["after"]["rowCount"] == 4
    assert p["diff"]["removedRowCount"] == 1
    assert "North" in p["csv"]
    assert p["diff"]["totalCellChanges"] >= 2

def test_unsafe_fill_rejected():
    with pytest.raises(DataError):
        apply_operations(parse_csv(SAMPLE), [{"operation":"fill_missing","column":"age","parameters":{"value":""}}])

def test_numeric_cast_invalid_rejected():
    with pytest.raises(DataError):
        apply_operations(parse_csv("sku,sales\n001,12\n002,broken\n"),[{"operation":"cast_numeric","column":"sales"}])

def test_rules_pass_and_fail():
    f = parse_csv(SAMPLE)
    results = check_rules(f,[{"type":"not_null","column":"age"},{"type":"unique","column":"order_id"},{"type":"range","column":"sales","min":0,"max":500},{"type":"allowed_values","column":"region","values":["North"]}])
    assert not results[0]["passed"] and results[0]["count"] == 2
    assert not results[1]["passed"] and results[1]["count"] == 2
    assert results[2]["passed"]
    assert not results[3]["passed"]

def test_chart_aggregation_has_row_lineage():
    r = chart_query(parse_csv(SAMPLE),{"type":"bar","x":"region","y":"sales","aggregation":"sum"})
    assert r["points"][0]["y"] == 100
    assert r["points"][0]["rowIds"] == ["1"]
    assert len(r["points"]) == 4

def test_scatter_and_histogram():
    f = parse_csv(SAMPLE)
    assert len(chart_query(f,{"type":"scatter","x":"sales","y":"age"})["points"]) == 3
    assert len(chart_query(f,{"type":"histogram","x":"sales"})["points"]) == 5

def test_csv_injection_is_not_executed():
    f = parse_csv('id,note\n001,"=1+1"\n')
    assert f.iloc[0]["note"] == "=1+1"
    assert "=1+1" in as_csv(f)

def test_unknown_operations_rejected():
    with pytest.raises(DataError, match="Unsupported operation"):
        apply_operations(parse_csv(SAMPLE), [{"operation":"execute_python","parameters":{"code":"print(1)"}}])

def test_replay_python_script_produces_identical_csv():
    original = "id,region,revenue\n001,NORTH,100\n002,north ,200\n003,South,300\n003,South,300\n"
    ops=[{"operation":"normalize_category","column":"region","parameters":{}},{"operation":"drop_duplicates","parameters":{}}]
    expected=preview(parse_csv(original),ops)["csv"]
    with tempfile.TemporaryDirectory() as tmp:
        p=Path(tmp)
        (p/"original.csv").write_text(original)
        (p/"clean.py").write_text(generate_script(ops), encoding="utf-8")
        completed=subprocess.run([sys.executable,str(p/"clean.py"),str(p/"original.csv"),str(p/"out.csv")],capture_output=True,text=True)
        assert completed.returncode == 0,completed.stderr
        assert (p/"out.csv").read_text() == expected

@pytest.mark.parametrize("input_data",["", "justonecolumn\n1\n", "__rv_row_id,x\n1,y\n"])
def test_bad_input(input_data):
    if not input_data: 
        with pytest.raises(DataError): parse_csv(input_data)
    elif input_data.startswith("__rv_"):
        with pytest.raises(DataError): parse_csv(input_data)

def test_chart_filters_and_lineage():
    f=parse_csv(SAMPLE)
    result=chart_query(f,{"type":"bar","x":"region","y":"sales","aggregation":"sum","filters":[{"column":"sales","operator":"greater","value":"250"}]})
    assert sum(len(p["rowIds"]) for p in result["points"])==3
    with pytest.raises(DataError):
        chart_query(f,{"type":"bar","x":"region","filters":[{"column":"sales","operator":"execute","value":"250"}]})

def test_malformed_chart_filter_is_rejected():
    with pytest.raises(DataError, match="filter"):
        chart_query(parse_csv(SAMPLE), {"type":"bar","x":"region","filters":[None]})

def test_chart_title_and_filter_value_are_bounded():
    frame = parse_csv(SAMPLE)
    with pytest.raises(DataError, match="title"):
        chart_query(frame, {"type":"bar","x":"region","title":{"unsafe":"object"}})
    with pytest.raises(DataError, match="filter"):
        chart_query(frame, {"type":"bar","x":"region","filters":[{"column":"region","value":"x"*201}]})

def test_nonfinite_and_reversed_range_rules_are_rejected():
    frame = parse_csv(SAMPLE)
    for minimum, maximum in [(float("nan"), 10), (20, 10), (0, float("inf"))]:
        with pytest.raises(DataError, match="range"):
            check_rules(frame, [{"type":"range","column":"sales","min":minimum,"max":maximum}])

def test_rule_limit_cannot_silently_skip_a_rule():
    frame = parse_csv(SAMPLE)
    rules = [{"type":"not_null","column":"region"} for _ in range(50)]
    rules.append({"type":"not_null","column":"missing_column"})
    with pytest.raises(DataError, match="50 rules"):
        check_rules(frame, rules)

def test_allowed_values_rule_is_bounded():
    with pytest.raises(DataError, match="allowed_values"):
        check_rules(parse_csv(SAMPLE), [{"type":"allowed_values","column":"region","values":["x"]*101}])

def test_missing_persisted_rule_column_blocks_preview():
    result = preview(parse_csv(SAMPLE), [{"operation":"trim","column":"region"}], [{"type":"not_null","column":"missing_column"}])
    assert result["valid"] is False

def test_preview_rejects_output_larger_than_storage_read_limit():
    with pytest.raises(DataError, match="Processed CSV exceeds"):
        preview(parse_csv("id,note\n001,short\n"), [{"operation":"edit_cell","column":"note","parameters":{"rowId":"1","value":"x"*1_500_001}}])

def test_invalid_pagination_is_rejected():
    from rowvitra.engine import get_rows
    frame = parse_csv(SAMPLE)
    for offset, limit in [(-1, 100), (0, 0), (0, 201), (10001, 1)]:
        with pytest.raises(DataError, match="pagination"):
            get_rows(frame, offset=offset, limit=limit)

def test_existing_rule_violations_are_retained_not_blocking():
    p=preview(parse_csv(SAMPLE),[{"operation":"normalize_category","column":"region"}],[{"type":"not_null","column":"age"}])
    assert p["valid"] is True and p["rules"][0]["count"] == 2

def test_recipe_replay_preview_detects_drift():
    from rowvitra.engine import replay_recipe
    incoming='order_id,region,sales,age\n001,North,100,20\n002,Central,250,21\n'
    result=replay_recipe(SAMPLE,incoming,[{"operation":"normalize_category","column":"region"}])
    assert result['canPreview'] and result['preview']['after']['rowCount']==2
    assert any('New categories' in w for w in result['warnings'])

def test_recipe_replay_stops_for_missing_columns():
    from rowvitra.engine import replay_recipe
    result=replay_recipe(SAMPLE,'order_id,age\n001,21\n',[{"operation":"normalize_category","column":"region"}])
    assert not result['canPreview']


def test_checkpoint_allows_replay_of_manual_edits_after_row_deletion():
    """Version 2 row IDs must match reload semantics, not original input indexes."""
    original = "id,region\n001,North\n001,North\n003,West\n"
    first = [{"operation": "drop_duplicates"}]
    version_one = preview(parse_csv(original), first)["csv"]
    assert version_one == "id,region\n001,North\n003,West\n"
    second = [{"operation": "edit_cell", "column": "region", "parameters": {"rowId": "2", "value": "East"}}]
    version_two = preview(parse_csv(version_one), second)["csv"]
    cumulative = first + [{"operation": "checkpoint"}] + second + [{"operation": "checkpoint"}]
    assert preview(parse_csv(original), cumulative)["csv"] == version_two
    with tempfile.TemporaryDirectory() as folder:
        p=Path(folder)
        (p/"original.csv").write_text(original)
        (p/"replay.py").write_text(generate_script(cumulative), encoding="utf-8")
        run=subprocess.run([sys.executable,str(p/"replay.py"),str(p/"original.csv"),str(p/"new.csv")],capture_output=True,text=True)
        assert run.returncode == 0, run.stderr
        assert (p/"new.csv").read_text() == version_two


@pytest.mark.parametrize("csv_text", [
    "id,price,price\n001,10,20\n",
    "id, id\n001,002\n",
    "sku, ,price\n001,x,20\n",
])
def test_rejects_duplicate_or_blank_raw_headers(csv_text):
    with pytest.raises(DataError, match="Duplicate column|valid column"):
        parse_csv(csv_text)

def test_bom_and_leading_zero_identifier_roundtrip():
    text = "\ufeffproduct_code,value\n000123,42\n"
    frame = parse_csv(text)
    assert frame["product_code"].iloc[0] == "000123"
    assert "product_code" in protected_columns(frame)
    assert "000123" in as_csv(frame)
