"""Deterministic, stateless Rowvitra table engine. Never executes model-generated code."""
from __future__ import annotations

import csv
import io
import json
import math
import re
import statistics
from collections import Counter, defaultdict
from typing import Any

import pandas as pd

MAX_ROWS = 10000
MAX_COLUMNS = 100
MAX_BYTES = 1_500_000
MISSING = {"", "null", "none", "nan", "n/a", "na", "-", "unknown"}
IDENTIFIER_RE = re.compile(r"(^id$|_id$|\bid\b|zip|postal|pin.?code|phone|mobile|account.?number|sku|product.?code|order.?code|invoice.?number)", re.I)
NUMERIC_RE = re.compile(r"price|revenue|sales|amount|quantity|qty|age|cost|total|salary|profit|units|score", re.I)


class DataError(ValueError):
    pass


def missing(value: Any) -> bool:
    return str(value).strip().lower() in MISSING


def parse_csv(text: str) -> pd.DataFrame:
    if not isinstance(text, str) or not text.strip():
        raise DataError("A nonempty CSV file is required")
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise DataError("CSV exceeds the 1.5 MB demo processing limit")
    # Check the original header before pandas can silently rename duplicate columns
    # (for example, 'price,price' would otherwise become 'price,price.1').
    try:
        headers = next(csv.reader(io.StringIO(text.lstrip("\ufeff"))))
    except (csv.Error, StopIteration) as exc:
        raise DataError("CSV must contain a valid header row") from exc
    clean_headers = [column.strip() for column in headers]
    if not clean_headers or not all(clean_headers):
        raise DataError("CSV must have valid column headers")
    if len(set(clean_headers)) != len(clean_headers):
        raise DataError("Duplicate column names are not supported")
    try:
        frame = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False, na_filter=False, on_bad_lines="error", encoding="utf-8")
    except Exception as exc:
        raise DataError(f"Unable to read CSV: {str(exc)[:180]}") from exc
    if len(frame) > MAX_ROWS or len(frame.columns) > MAX_COLUMNS:
        raise DataError("CSV exceeds the 10,000 row or 100 column limit")
    if len(frame.columns) == 0 or any(not str(col).strip() for col in frame.columns):
        raise DataError("CSV must have valid column headers")
    if any(str(col).startswith("__rv_") for col in frame.columns):
        raise DataError("Columns starting with __rv_ are reserved")
    if frame.columns.duplicated().any():
        raise DataError("Duplicate column names are not supported")
    frame.columns = [str(c).strip() for c in frame.columns]
    frame.insert(0, "__rv_row_id", [str(i + 1) for i in range(len(frame))])
    return frame


def as_csv(frame: pd.DataFrame) -> str:
    out = io.StringIO()
    frame.drop(columns=["__rv_row_id"], errors="ignore").to_csv(out, index=False, lineterminator="\n")
    return out.getvalue()


def protected_columns(frame: pd.DataFrame) -> list[str]:
    result = []
    for column in frame.columns:
        if column == "__rv_row_id":
            continue
        vals = [str(v) for v in frame[column].head(150) if not missing(v)]
        if IDENTIFIER_RE.search(column) or (vals and sum(bool(re.fullmatch(r"0\d{2,}", v)) for v in vals) >= max(2, len(vals) // 3)):
            result.append(column)
    return result


def _numeric(values: pd.Series) -> pd.Series:
    return pd.to_numeric(values.astype(str).str.replace(",", "", regex=False).str.replace("₹", "", regex=False).str.replace("$", "", regex=False).str.strip(), errors="coerce")


def get_profile(frame: pd.DataFrame, goal: str = "") -> dict[str, Any]:
    protected = protected_columns(frame)
    total = len(frame)
    issues: list[dict[str, Any]] = []
    cols = []
    goal_tokens = set(re.findall(r"[a-z0-9]+", goal.lower()))
    def issue(kind: str, column: str | None, count: int, description: str, severity: str = "medium", rows: list[str] | None = None):
        if count <= 0:
            return
        relevant = bool(column and (column.lower() in goal.lower() or bool(set(re.findall(r"[a-z0-9]+", column.lower())) & goal_tokens)))
        score = (50 if severity == "high" else 30 if severity == "medium" else 15) + (35 if relevant else 0) + min(count, 20)
        issues.append({"id": f"{kind}:{column or 'dataset'}", "kind": kind, "column": column, "count": count, "severity": severity, "description": description, "priority": min(100, score), "goalRelevant": relevant, "rowIds": (rows or [])[:50]})

    for col in frame.columns:
        if col == "__rv_row_id":
            continue
        values = frame[col].astype(str)
        not_blank = values[~values.map(missing)]
        miss = total - len(not_blank)
        nums = _numeric(not_blank)
        numeric_count = int(nums.notna().sum())
        numeric = len(not_blank) > 0 and numeric_count == len(not_blank) and col not in protected
        inferred = "identifier" if col in protected else "number" if numeric else "mixed" if numeric_count and numeric_count < len(not_blank) else "text"
        cols.append({"name": col, "type": inferred, "protected": col in protected, "missing": miss, "unique": int(not_blank.nunique()), "examples": not_blank.drop_duplicates().head(4).tolist()})
        issue("missing", col, miss, f"{miss} missing or blank values", "medium", frame.loc[values.map(missing), "__rv_row_id"].tolist())
        if 0 < numeric_count < len(not_blank) and col not in protected and (NUMERIC_RE.search(col) or numeric_count / len(not_blank) >= 0.5):
            issue("mixed_types", col, len(not_blank) - numeric_count, "Numeric and non-numeric values mixed", "high")
        if inferred == "text" and col not in protected and len(not_blank) <= 10000:
            normalized = defaultdict(set)
            for v in not_blank.unique():
                normalized[v.strip().casefold()].add(v)
            inconsistent = [vs for vs in normalized.values() if len(vs) > 1]
            if inconsistent:
                affected = sum(sum((not_blank == v).sum() for v in group) for group in inconsistent)
                issue("inconsistent_category", col, int(affected), f"{len(inconsistent)} category groups differ by case or whitespace", "medium")
        if numeric and NUMERIC_RE.search(col):
            negative = nums < 0
            if bool(negative.any()):
                issue("negative_value", col, int(negative.sum()), "Negative values may require review, depending on context", "low")

    visible = frame.drop(columns=["__rv_row_id"])
    duplicate_mask = visible.duplicated(keep="first")
    issue("exact_duplicate", None, int(duplicate_mask.sum()), "Exact duplicate rows found; review before removal", "high", frame.loc[duplicate_mask, "__rv_row_id"].tolist())
    issues.sort(key=lambda it: (-it["priority"], it["id"]))
    missing_cells = sum(c["missing"] for c in cols)
    issue_cells = sum(i["count"] for i in issues)
    health = max(0, round(100 - 60 * (issue_cells / max(1, total * len(cols)))))
    return {"rowCount": total, "columnCount": len(cols), "missingCells": missing_cells, "duplicateRows": int(duplicate_mask.sum()), "protectedColumns": protected, "columns": cols, "issues": issues, "healthScore": health, "goal": goal, "preview": frame.head(60).to_dict(orient="records")}


def _safe_column(frame: pd.DataFrame, col: str | None, allow_protected: bool = False) -> str:
    if not col or col not in frame.columns or col == "__rv_row_id":
        raise DataError(f"Column {col!r} does not exist")
    if col in protected_columns(frame) and not allow_protected:
        raise DataError(f"Column '{col}' is protected; use an explicit manual cell edit")
    return col


def apply_operations(frame: pd.DataFrame, operations: list[dict[str, Any]]) -> pd.DataFrame:
    if len(operations) > 30:
        raise DataError("A batch may contain no more than 30 operations")
    out = frame.copy(deep=True)
    for step in operations:
        name = step.get("operation")
        col = step.get("column")
        opts = step.get("parameters") or {}
        if not isinstance(opts, dict):
            raise DataError("Operation parameters must be an object")
        if name == "checkpoint":
            # Mirrors the row reindexing that occurs when a committed CSV version is reloaded.
            out["__rv_row_id"] = [str(i+1) for i in range(len(out))]
        elif name == "trim":
            col = _safe_column(out, col)
            out[col] = out[col].astype(str).str.strip()
        elif name == "normalize_category":
            col = _safe_column(out, col)
            mapping = opts.get("mapping", {})
            if not isinstance(mapping, dict) or len(mapping) > 100:
                raise DataError("Invalid category mapping")
            if mapping:
                out[col] = out[col].map(lambda v: str(mapping.get(v, v)))
            else:
                canonical = {}
                for value in out[col].unique():
                    k = str(value).strip().casefold()
                    if k and k not in canonical:
                        canonical[k] = str(value).strip().title()
                out[col] = out[col].map(lambda v: canonical.get(str(v).strip().casefold(), str(v)))
        elif name == "replace_values":
            col = _safe_column(out, col)
            mapping = opts.get("mapping", {})
            if not isinstance(mapping, dict) or len(mapping) > 100:
                raise DataError("Provide a mapping with up to 100 entries")
            out[col] = out[col].map(lambda v: str(mapping.get(v, v)))
        elif name == "fill_missing":
            col = _safe_column(out, col)
            value = str(opts.get("value", ""))
            if missing(value):
                raise DataError("Replacement must be an explicit nonempty value")
            out[col] = out[col].map(lambda v: value if missing(v) else v)
        elif name == "cast_numeric":
            col = _safe_column(out, col)
            values = out[col].astype(str)
            parsed = _numeric(values)
            invalid = (~values.map(missing)) & parsed.isna()
            if bool(invalid.any()):
                raise DataError(f"Cannot convert {int(invalid.sum())} nonnumeric cells in '{col}'")
            out[col] = ["" if missing(orig) else format(float(num), ".15g") for orig, num in zip(values, parsed)]
        elif name == "drop_duplicates":
            out = out.loc[~out.drop(columns=["__rv_row_id"]).duplicated(keep="first")].copy()
        elif name == "edit_cell":
            col = _safe_column(out, col, allow_protected=True)
            row_id = str(opts.get("rowId", ""))
            matched = out["__rv_row_id"] == row_id
            if int(matched.sum()) != 1:
                raise DataError("Row identifier not found")
            value = opts.get("value", "")
            if not isinstance(value, (str, int, float, bool)):
                raise DataError("Cell value must be a scalar")
            out.loc[matched, col] = str(value)
        elif name == "delete_rows":
            ids = opts.get("rowIds", [])
            if not isinstance(ids, list) or len(ids) > MAX_ROWS:
                raise DataError("Invalid row selection")
            out = out.loc[~out["__rv_row_id"].isin([str(v) for v in ids])].copy()
        elif name == "rename_column":
            col = _safe_column(out, col, allow_protected=True)
            target = str(opts.get("name", "")).strip()
            if not target or target in out.columns or target.startswith("__rv_") or len(target) > 100:
                raise DataError("Invalid target column name")
            out = out.rename(columns={col: target})
        else:
            raise DataError(f"Unsupported operation '{name}'")
    return out.reset_index(drop=True)


def diff_tables(before: pd.DataFrame, after: pd.DataFrame, limit: int = 150) -> dict[str, Any]:
    original = before.set_index("__rv_row_id")
    updated = after.set_index("__rv_row_id")
    changes = []
    same_ids = original.index.intersection(updated.index)
    common_cols = original.columns.intersection(updated.columns)
    total = 0
    for row_id in same_ids:
        for col in common_cols:
            old = str(original.at[row_id, col]); new = str(updated.at[row_id, col])
            if old != new:
                total += 1
                if len(changes) < limit:
                    changes.append({"rowId": str(row_id), "column": col, "before": old, "after": new})
    removed = original.index.difference(updated.index).tolist()
    added = updated.index.difference(original.index).tolist()
    return {"changes": changes, "totalCellChanges": total, "removedRowIds": removed[:100], "removedRowCount": len(removed), "addedRowCount": len(added), "truncated": total > limit}


def metrics(frame: pd.DataFrame) -> dict[str, Any]:
    result: dict[str, Any] = {"rowCount": len(frame), "columnCount": len(frame.columns)-1, "numeric": {}}
    for col in frame.columns:
        if col == "__rv_row_id" or col in protected_columns(frame):
            continue
        values = frame[col].astype(str)
        eligible = values[~values.map(missing)]
        nums = _numeric(eligible)
        if len(eligible) and nums.notna().all():
            result["numeric"][col] = {"sum": round(float(nums.sum()), 4), "mean": round(float(nums.mean()), 4), "min": round(float(nums.min()), 4), "max": round(float(nums.max()), 4)}
    return result


def check_rules(frame: pd.DataFrame, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    violations = []
    for rule in rules[:50]:
        kind = rule.get("type"); col = rule.get("column")
        if col not in frame.columns or col == "__rv_row_id":
            violations.append({"rule": rule, "passed": False, "count": len(frame), "message": "Missing column"}); continue
        s = frame[col].astype(str)
        if kind == "not_null": mask = s.map(missing)
        elif kind == "unique": mask = s.duplicated(keep=False)
        elif kind == "range":
            nums = _numeric(s); lo = rule.get("min"); hi = rule.get("max")
            mask = nums.isna() | (nums < float(lo) if lo is not None else False) | (nums > float(hi) if hi is not None else False)
        elif kind == "allowed_values":
            allowed = rule.get("values", [])
            if not isinstance(allowed, list): raise DataError("allowed_values needs a list")
            mask = ~s.isin([str(v) for v in allowed])
        else: raise DataError(f"Unknown rule type: {kind}")
        count = int(mask.sum())
        violations.append({"rule": rule, "passed": count == 0, "count": count, "rowIds": frame.loc[mask, "__rv_row_id"].head(50).tolist()})
    return violations


def preview(frame: pd.DataFrame, operations: list[dict[str, Any]], rules: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    after = apply_operations(frame, operations)
    protected = protected_columns(frame)
    # Protect identifier values from bulk edits and preserve their formatting.
    before_ids = frame.set_index("__rv_row_id")
    after_ids = after.set_index("__rv_row_id")
    # Previously approved version checkpoints reassign display row IDs.
    # Each individual commit already undergoes protected-column validation.
    for col in (protected if not any(op.get("operation") == "checkpoint" for op in operations) else []):
        if col in after.columns:
            for row_id in before_ids.index.intersection(after_ids.index):
                if str(before_ids.at[row_id, col]) != str(after_ids.at[row_id, col]):
                    if not any(op.get("operation") == "edit_cell" and op.get("column") == col and str(op.get("parameters",{}).get("rowId")) == str(row_id) for op in operations):
                        raise DataError(f"Protected identifier '{col}' changed")
    before_metrics = metrics(frame); after_metrics = metrics(after)
    checks = check_rules(after, rules or [])
    baseline = check_rules(frame, rules or [])
    no_new_violations = all(new["count"] <= old["count"] for old,new in zip(baseline,checks))
    return {"csv": as_csv(after), "diff": diff_tables(frame, after), "before": before_metrics, "after": after_metrics, "rules": checks, "protectedColumns": protected, "valid": no_new_violations, "previewRows": after.head(50).to_dict(orient="records")}


def chart_query(frame: pd.DataFrame, spec: dict[str, Any]) -> dict[str, Any]:
    kind = spec.get("type", "bar")
    if kind not in {"bar", "line", "pie", "scatter", "histogram", "box", "heatmap", "map"}:
        raise DataError("Unsupported chart type")
    x = spec.get("x")
    y = spec.get("y")
    aggregation = spec.get("aggregation", "count")
    if aggregation not in {"sum", "mean", "median", "count", "min", "max"}:
        raise DataError("Unsupported aggregation")
    if x not in frame.columns or x == "__rv_row_id":
        raise DataError("Select a valid X column")
    filters = spec.get("filters", []) or []
    if not isinstance(filters,list) or len(filters)>5: raise DataError("No more than five chart filters")
    for fil in filters:
        field = fil.get("column")
        operator = fil.get("operator","equals")
        value = str(fil.get("value", ""))
        if field not in frame.columns or field == "__rv_row_id": raise DataError("Unknown filter column")
        if operator == "equals": mask = frame[field].astype(str) == value
        elif operator == "contains": mask = frame[field].astype(str).str.contains(value,regex=False,case=False,na=False)
        elif operator == "not_equals": mask = frame[field].astype(str) != value
        elif operator in {"greater","less"}:
            values = _numeric(frame[field]); threshold = pd.to_numeric(value,errors="coerce")
            if pd.isna(threshold): raise DataError("Numeric filter needs a number")
            mask = values > threshold if operator == "greater" else values < threshold
        else: raise DataError("Unsupported chart filter")
        frame = frame.loc[mask].copy()
    if kind in {"bar", "line", "pie"}:
        if aggregation != "count" and (y not in frame.columns or y == "__rv_row_id"):
            raise DataError("Choose a numeric Y column")
        groups = frame.groupby(x, sort=False, dropna=False)
        points = []
        for label, group in list(groups)[:80]:
            if aggregation == "count": val = len(group)
            else:
                nums = _numeric(group[y]); nums = nums.dropna()
                if nums.empty: continue
                val = {"sum":nums.sum(),"mean":nums.mean(),"median":nums.median(),"min":nums.min(),"max":nums.max()}[aggregation]
            points.append({"x": str(label), "y": round(float(val), 6), "rowIds": group["__rv_row_id"].tolist()[:300]})
        return {"type":kind,"title":spec.get("title") or f"{aggregation.title()} by {x}","xLabel":x,"yLabel":y or "Count","points":points}
    if kind in {"scatter","map"}:
        if y not in frame.columns: raise DataError("Scatter and map plots require a Y column")
        xs = _numeric(frame[x]); ys = _numeric(frame[y]); valid = xs.notna() & ys.notna()
        pts = [{"x":float(xs.iloc[i]),"y":float(ys.iloc[i]),"rowIds":[str(frame["__rv_row_id"].iloc[i])]} for i in range(min(len(frame),2000)) if valid.iloc[i]]
        if kind=="map":
            pts=[p for p in pts if -90 <= p["x"] <= 90 and -180 <= p["y"] <= 180]
        return {"type":kind,"title":spec.get("title") or f"{x} vs {y}","xLabel":x,"yLabel":y,"points":pts}
    if kind in {"histogram","box"}:
        nums = _numeric(frame[x]); pts = [{"x":float(value),"rowIds":[str(row_id)]} for value,row_id in zip(nums, frame["__rv_row_id"]) if pd.notna(value)][:5000]
        return {"type":kind,"title":spec.get("title") or f"{x} distribution","xLabel":x,"yLabel":"Count","points":pts}
    # Correlation heatmap of numeric fields, capped for performance.
    numeric = {}
    for col in frame.columns:
        if col != "__rv_row_id" and col not in protected_columns(frame):
            values = _numeric(frame[col]);
            if values.notna().sum() >= 3 and values.notna().sum() >= len(frame) * .65: numeric[col] = values
    if len(numeric) < 2: raise DataError("Heatmap needs two numeric columns")
    matrix = pd.DataFrame(numeric).iloc[:, :12].corr().round(3)
    return {"type":"heatmap","title":spec.get("title") or "Correlation heatmap","labels":matrix.columns.tolist(),"matrix":json.loads(matrix.fillna(0).to_json(orient="values"))}


def suggest_repairs(frame: pd.DataFrame, goal: str = "") -> list[dict[str, Any]]:
    prof = get_profile(frame, goal)
    proposals = []
    for issue in prof["issues"]:
        k = issue["kind"]
        if k == "inconsistent_category": op = {"operation":"normalize_category","column":issue["column"],"parameters":{}}
        elif k == "exact_duplicate": op = {"operation":"drop_duplicates","column":None,"parameters":{}}
        else: continue
        proposals.append({"issueId":issue["id"],"title":"Standardize category labels" if k == "inconsistent_category" else "Remove exact duplicates", "reason":"Normalize case and whitespace for equivalent categories" if k == "inconsistent_category" else "Remove rows that are identical across every column; review first", "risk":"medium", "operation":op, "source":"rules"})
    return proposals


def generate_script(operations: list[dict[str, Any]]) -> str:
    # JSON is embedded as a Python literal via repr, not executed model code.
    encoded = repr(operations)
    return '''"""Rowvitra reproducible cleaning recipe. Run: python clean.py original.csv cleaned.csv"""\nimport sys\nimport pandas as pd\n\nMISSING = {"", "null", "none", "nan", "n/a", "na", "-", "unknown"}\ndef empty(v): return str(v).strip().lower() in MISSING\n\ndef run(csv_path, output_path):\n    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False, na_filter=False)\n    df.insert(0, "__rv_row_id", [str(i + 1) for i in range(len(df))])\n    operations = ''' + encoded + '''\n    for step in operations:\n        action = step["operation"]\n        col = step.get("column")\n        opts = step.get("parameters") or {}\n        if action == "checkpoint": df["__rv_row_id"] = [str(i+1) for i in range(len(df))]
        elif action == "trim": df[col] = df[col].astype(str).str.strip()\n        elif action == "normalize_category":\n            mapping = opts.get("mapping", {})\n            if mapping: df[col] = df[col].map(lambda v: str(mapping.get(v, v)))\n            else:\n                canon = {}\n                for v in df[col].unique():\n                    k = str(v).strip().casefold()\n                    if k and k not in canon: canon[k] = str(v).strip().title()\n                df[col] = df[col].map(lambda v: canon.get(str(v).strip().casefold(), str(v)))\n        elif action == "replace_values": df[col] = df[col].map(lambda v: str(opts["mapping"].get(v, v)))\n        elif action == "fill_missing": df[col] = df[col].map(lambda v: str(opts["value"]) if empty(v) else v)\n        elif action == "cast_numeric":\n            nums = pd.to_numeric(df[col].astype(str).str.replace(",", "", regex=False).str.replace("₹", "", regex=False).str.replace("$", "", regex=False).str.strip(), errors="coerce")\n            if bool(((~df[col].map(empty)) & nums.isna()).any()): raise ValueError("Invalid numeric values")\n            df[col] = ["" if empty(a) else format(float(b), ".15g") for a,b in zip(df[col],nums)]\n        elif action == "drop_duplicates": df = df.loc[~df.drop(columns=["__rv_row_id"]).duplicated(keep="first")].copy()\n        elif action == "edit_cell": df.loc[df["__rv_row_id"] == str(opts["rowId"]), col] = str(opts["value"])\n        elif action == "delete_rows": df = df.loc[~df["__rv_row_id"].isin([str(v) for v in opts["rowIds"]])].copy()\n        elif action == "rename_column": df = df.rename(columns={col: opts["name"]})\n        else: raise ValueError("Unknown operation: " + action)\n    df.drop(columns=["__rv_row_id"]).to_csv(output_path, index=False, lineterminator="\\n")\n\nif __name__ == "__main__":\n    if len(sys.argv) != 3: raise SystemExit("Usage: python clean.py original.csv cleaned.csv")\n    run(sys.argv[1], sys.argv[2])\n'''


def get_rows(frame: pd.DataFrame, row_ids: list[str] | None = None, offset: int = 0, limit: int = 100) -> dict[str, Any]:
    if row_ids is not None:
        if len(row_ids) > 300: raise DataError("Too many row IDs")
        selected = frame[frame["__rv_row_id"].isin([str(i) for i in row_ids])]
    else: selected = frame
    return {"rows": selected.iloc[max(0,offset):max(0,offset)+min(200,max(1,limit))].to_dict(orient="records"), "total": len(selected), "columns": [c for c in frame.columns if c != "__rv_row_id"]}

def verify_export_script(original_csv: str, operations: list[dict[str,Any]]) -> tuple[str,bool]:
    import subprocess, tempfile, sys
    from pathlib import Path
    script = generate_script(operations)
    expected = preview(parse_csv(original_csv), operations)["csv"]
    with tempfile.TemporaryDirectory(prefix="rowvitra-") as folder:
        p = Path(folder)
        (p/"original.csv").write_text(original_csv, encoding="utf-8")
        (p/"clean.py").write_text(script, encoding="utf-8")
        try:
            run = subprocess.run([sys.executable, str(p/"clean.py"), str(p/"original.csv"), str(p/"cleaned.csv")],capture_output=True,text=True,timeout=12,cwd=folder)
        except subprocess.TimeoutExpired as exc: raise DataError("Script replay exceeded time limit") from exc
        if run.returncode != 0 or not (p/"cleaned.csv").exists():
            raise DataError("Generated script failed verification: " + run.stderr[-400:])
        if (p/"cleaned.csv").read_text(encoding="utf-8") != expected:
            raise DataError("Generated script did not reproduce the processed CSV exactly")
    return script, True


def replay_recipe(reference_csv: str, incoming_csv: str, operations: list[dict[str, Any]]) -> dict[str, Any]:
    """Preview a saved recipe on a second CSV. Never commit the result automatically."""
    source = parse_csv(reference_csv)
    incoming = parse_csv(incoming_csv)
    original_cols = set(source.columns)-{"__rv_row_id"}
    new_cols = set(incoming.columns)-{"__rv_row_id"}
    warnings: list[str] = []
    if original_cols-new_cols:
        warnings.append("Missing original columns: " + ", ".join(sorted(original_cols-new_cols)))
    if new_cols-original_cols:
        warnings.append("New columns detected: " + ", ".join(sorted(new_cols-original_cols)))
    for operation in operations:
        col = operation.get('column')
        if col and col not in incoming.columns:
            warnings.append(f"Recipe step '{operation.get('operation')}' needs missing column '{col}'")
    for col in sorted(original_cols & new_cols):
        if col in protected_columns(source): continue
        source_values = set(source[col].map(lambda v: str(v).strip().casefold()).unique())
        new_values = set(incoming[col].map(lambda v: str(v).strip().casefold()).unique())
        # Only categorical columns with manageable cardinality contribute drift hints.
        if len(source_values)<=30 and len(new_values)<=50:
            additions = {v for v in new_values-source_values if not missing(v)}
            if additions:
                warnings.append(f"New categories in {col}: " + ', '.join(sorted(additions)[:7]))
    if any("needs missing column" in w for w in warnings):
        return {"canPreview":False,"warnings":warnings,"preview":None}
    try:
        result = preview(incoming,operations)
        return {"canPreview":True,"warnings":warnings,"preview":result}
    except DataError as exc:
        return {"canPreview":False,"warnings":warnings+["Recipe stopped: "+str(exc)],"preview":None}
