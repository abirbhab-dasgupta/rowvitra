"""Read-only decision analysis over verified CSV snapshots."""
from bisect import bisect_left, bisect_right
from math import isfinite
from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel

from .engine import (DataError, MAX_RECIPE_OPERATIONS, _numeric, apply_operations,
                     missing, protected_columns)


class DecisionSpec(BaseModel):
    goal: Literal["highest", "lowest"]
    aggregation: Literal["sum", "mean"]
    metric: str
    group: str


def snapshot_lineage(original, current, operations):
    """Keep the original Pandas index across deletes and row-ID checkpoints."""
    replayed = apply_operations(original, operations, MAX_RECIPE_OPERATIONS, keep_index=True)
    if not replayed.reset_index(drop=True).equals(current):
        return None
    return replayed.index


def inputs(frame, metric, group):
    values = _numeric(frame[metric]).astype(float)
    eligible = np.isfinite(values) & ~frame[group].map(missing)
    return pd.DataFrame({"label": frame.loc[eligible, group], "value": values[eligible]})


def ranking(data, spec):
    scores = data.groupby("label").value.agg(spec.aggregation)
    if not np.isfinite(scores).all():
        raise DataError("Metric totals exceed the supported numeric range")
    scores = scores.round(10).sort_values(ascending=spec.goal == "lowest", kind="stable")
    ranks = scores.rank(method="min", ascending=spec.goal == "lowest").astype(int)
    return scores, ranks


def bounds(values):
    if len(values) < 4:
        return None
    q1, q3 = values.quantile([0.25, 0.75])
    spread = q3 - q1
    return q1 - 1.5 * spread, q3 + 1.5 * spread


def influential_rows(current, original, lineage, data, duplicates, limits, spec):
    scores, ranks = ranking(data, spec)
    members = {label: series for label, series in data.groupby("label").value}
    exclusion_scores = {}
    labels = data.label
    variants = labels.groupby(labels.str.strip().str.casefold()).transform("nunique").gt(1)
    if spec.group in protected_columns(current):
        variants[:] = False
    outliers = (~data.value.between(*limits) if limits else pd.Series(False, index=data.index))
    candidates = data[duplicates.reindex(data.index) | variants | outliers]
    ordered = sorted(scores.tolist())
    impacts = []
    for idx, (label, value) in zip(candidates.index, candidates.itertuples(index=False, name=None)):
        group_values = members[label]
        before = float(scores[label])
        after = None
        after_rank = None
        if len(group_values) > 1:
            # Recompute on the remaining observations to avoid subtractive cancellation.
            key = (label, value)
            if key not in exclusion_scores:
                remaining = group_values.drop(idx)
                exclusion_scores[key] = round(float(remaining.agg(spec.aggregation)), 10)
            after = exclusion_scores[key]
            if not isfinite(after):
                raise DataError("Row impact exceeds the supported numeric range")
            if spec.goal == "lowest":
                after_rank = 1 + bisect_left(ordered, after) - int(before < after)
            else:
                after_rank = 1 + len(ordered) - bisect_right(ordered, after) - int(before > after)
        delta = abs(before - (after if after is not None else 0))
        rank = int(ranks[label])
        if rank == after_rank and (delta == 0 or delta < abs(before) * 0.05):
            continue
        issues = []
        if duplicates[idx]:
            issues.append("Exact duplicate")
        if variants[idx]:
            issues.append("Inconsistent group label")
        if outliers[idx]:
            issues.append("Metric outside the IQR fences")
        impacts.append(dict(index=idx, rowId=current.at[idx, "__rv_row_id"], group=label,
                            issues=issues, before=before, after=after, effect=delta,
                            rank=rank, afterRank=after_rank))
    impacts.sort(key=lambda r: (-r["effect"], r["index"]))
    for row in impacts[:20]:
        idx = row.pop("index")
        row["currentValues"] = current.iloc[idx].drop("__rv_row_id").to_dict()
        row["originalValues"] = (original.loc[lineage[idx]].drop("__rv_row_id").to_dict()
                                 if lineage is not None else None)
    return {"rows": impacts[:20], "count": len(impacts), "examined": len(candidates)}


def simulate(original, current, operations, spec):
    if spec.group == spec.metric or any(c not in current or c.startswith("__rv_") for c in (spec.group, spec.metric)):
        raise DataError("Select distinct, existing grouping and metric columns")
    lineage = snapshot_lineage(original, current, operations)
    names = {c: c for c in original.columns}
    for op in operations:
        if op.get("operation") == "rename_column" and op.get("column") in names:
            names[op["parameters"]["name"]] = names.pop(op["column"])
    old_metric, old_group = names.get(spec.metric), names.get(spec.group)
    if spec.metric in protected_columns(current) or old_metric in protected_columns(original):
        raise DataError("Protected identifiers cannot be used as numeric metrics")
    original_data = inputs(original, old_metric, old_group) if old_metric and old_group else pd.DataFrame(columns=["label", "value"], dtype=float)
    data = inputs(current, spec.metric, spec.group)
    duplicates = current.drop(columns="__rv_row_id").duplicated(keep=False)
    repeated = current.drop(columns="__rv_row_id").duplicated()
    limits = bounds(data.value)
    capped = data.copy()
    if limits:
        capped["value"] = capped.value.clip(*limits)
    cases = [("Original upload", original_data), ("Current version", data),
             ("Remove exact duplicates", data.loc[~repeated.reindex(data.index)]),
             ("Cap extreme values", capped)]
    scenarios, signatures = [], []
    ambiguous = False
    for name, rows in cases:
        scores, ranks = ranking(rows, spec)
        winners = ranks[ranks == 1].index.tolist()
        signatures.append(ranks.to_dict())
        ambiguous |= len(scores) < 2 or len(winners) != 1
        scenarios.append({"name": name, "eligible": len(rows), "groups": len(scores),
                          "winners": winners[:10], "winnerCount": len(winners),
                          "points": [{"x": k, "y": float(v), "rank": int(ranks[k]), "rowIds": []}
                                     for k, v in scores.head(20).items()]})
    if ambiguous or lineage is None:
        status = "Inconclusive"
        reason = ("The original-to-current row mapping could not be verified." if lineage is None
                  else "At least one scenario has fewer than two eligible groups or a tie for first place.")
    elif any(r != signatures[0] for r in signatures[1:]):
        status, reason = "Unstable", "Group membership or rank changes between scenarios."
    else:
        status, reason = "Stable", "All tested scenarios preserve the complete group ranking."
    return {"status": status, "reason": reason, "scenarios": scenarios,
            "critical": influential_rows(current, original, lineage, data, duplicates, limits, spec),
            "assumptions": [
                "Each alternative starts independently from the current version. Exact duplicates match every data column.",
                "Missing group labels and non-finite or nonnumeric metrics are excluded. Group labels otherwise match exactly.",
                "Extreme metrics are capped at the overall quartiles plus or minus 1.5 interquartile ranges, with at least four eligible values.",
                "Ranks compare scores rounded to ten decimal places. Charts show the first 20 groups per scenario; classification uses every group.",
                "Each suspicious current row is omitted separately. Rows qualify if their group disappears, changes rank, or its score moves by at least 5%.",
                "Rows are ordered by absolute group-score change (up to 20 shown). A disappearing group uses zero only to measure impact magnitude."
            ]}
