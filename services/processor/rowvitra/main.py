"""Rowvitra protected internal FastAPI processor (stateless, CSV input)."""
import os
from typing import Any
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from .engine import DataError, MAX_RECIPE_OPERATIONS, parse_csv, get_profile, preview, chart_query, check_rules, generate_script, verify_export_script, get_rows, replay_recipe, suggest_repairs
from .decision import simulate, DecisionSpec
from .ai import plan, recommend_chart

app = FastAPI(title="Rowvitra Processor", version="1.0.0", docs_url=None if os.getenv("VERCEL") else "/docs")

class CSVRequest(BaseModel):
    csv: str = Field(max_length=1_500_000)
    goal: str = Field(default="", max_length=240)

class OperationsRequest(CSVRequest):
    operations: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    rules: list[dict[str, Any]] = Field(default_factory=list, max_length=50)

class ImpactRequest(OperationsRequest):
    spec: dict[str,Any]

class RecipeRequest(CSVRequest):
    operations: list[dict[str, Any]] = Field(default_factory=list, max_length=MAX_RECIPE_OPERATIONS)
    rules: list[dict[str, Any]] = Field(default_factory=list, max_length=50)

class ChartRequest(CSVRequest):
    spec: dict[str, Any]

class RowsRequest(CSVRequest):
    rowIds: list[str] | None = None
    offset: int = 0
    limit: int = 100

class ReplayRequest(CSVRequest):
    newCsv: str = Field(max_length=1_500_000)
    operations: list[dict[str,Any]] = Field(default_factory=list,max_length=MAX_RECIPE_OPERATIONS)

class RulesRequest(CSVRequest):
    rules: list[dict[str, Any]]

def authenticated(x_processor_token: str | None = Header(default=None)):
    expected = os.getenv("PROCESSOR_SERVICE_TOKEN", "")
    if not expected or x_processor_token != expected:
        raise HTTPException(status_code=401, detail="Invalid processing service token")

@app.get("/health")
def health():
    return {"status":"ok","service":"rowvitra-processor","version":"1.0.0"}

@app.post("/v1/profile", dependencies=[Depends(authenticated)])
def profile(body: CSVRequest):
    try: return get_profile(parse_csv(body.csv), body.goal)
    except DataError as exc: raise HTTPException(422, detail=str(exc))

@app.post("/v1/suggest", dependencies=[Depends(authenticated)])
def suggest(body: CSVRequest):
    try:
        frame = parse_csv(body.csv)
        return plan(get_profile(frame, body.goal), suggest_repairs(frame, body.goal), body.goal)
    except DataError as exc: raise HTTPException(422, detail=str(exc))

@app.post("/v1/chart-advisor", dependencies=[Depends(authenticated)])
def advisor(body: CSVRequest):
    try: return recommend_chart(get_profile(parse_csv(body.csv),body.goal),body.goal)
    except DataError as exc: raise HTTPException(422,detail=str(exc))

@app.post("/v1/preview", dependencies=[Depends(authenticated)])
def repair_preview(body: OperationsRequest):
    try: return preview(parse_csv(body.csv), body.operations, body.rules)
    except (DataError, TypeError, ValueError) as exc: raise HTTPException(422, detail=str(exc))

@app.post("/v1/impact-chart", dependencies=[Depends(authenticated)])
def impact_chart(body: ImpactRequest):
    try:
        before=parse_csv(body.csv)
        modified=preview(before,body.operations,body.rules)
        return {"before":chart_query(before,body.spec),"after":chart_query(parse_csv(modified["csv"]),body.spec),"diff":modified["diff"]}
    except (DataError,TypeError,ValueError) as exc: raise HTTPException(422,detail=str(exc))

@app.post("/v1/chart", dependencies=[Depends(authenticated)])
def chart(body: ChartRequest):
    try: return chart_query(parse_csv(body.csv), body.spec)
    except (DataError, TypeError, ValueError) as exc: raise HTTPException(422, detail=str(exc))

@app.post("/v1/rows", dependencies=[Depends(authenticated)])
def rows(body: RowsRequest):
    try: return get_rows(parse_csv(body.csv), body.rowIds, body.offset, body.limit)
    except DataError as exc: raise HTTPException(422, detail=str(exc))

@app.post("/v1/rules", dependencies=[Depends(authenticated)])
def rules(body: RulesRequest):
    try: return {"results":check_rules(parse_csv(body.csv), body.rules)}
    except (DataError, TypeError, ValueError) as exc: raise HTTPException(422, detail=str(exc))

@app.post("/v1/replay", dependencies=[Depends(authenticated)])
def replay(body: ReplayRequest):
    try: return replay_recipe(body.csv,body.newCsv,body.operations)
    except DataError as exc: raise HTTPException(422,detail=str(exc))

@app.post("/v1/script", dependencies=[Depends(authenticated)])
def script(body: RecipeRequest):
    try:
        # Only valid, safe plans get export scripts.
        preview(parse_csv(body.csv), body.operations, body.rules, max_operations=MAX_RECIPE_OPERATIONS)
        script_text, verified = verify_export_script(body.csv, body.operations)
        return {"script":script_text, "replayVerified":verified}
    except (DataError, TypeError, ValueError) as exc: raise HTTPException(422, detail=str(exc))


class DecisionRequest(RecipeRequest):
    originalCsv: str = Field(max_length=1_500_000)
    spec: DecisionSpec


@app.post("/v1/decision", dependencies=[Depends(authenticated)])
def decision(body: DecisionRequest):
    try:
        return simulate(parse_csv(body.originalCsv), parse_csv(body.csv), body.operations, body.spec)
    except DataError as exc:
        raise HTTPException(422, detail=str(exc))


class DecisionQuestion(CSVRequest):
    question: str = Field(min_length=1, max_length=240)


@app.post("/v1/decision-question", dependencies=[Depends(authenticated)])
def decision_question(body: DecisionQuestion):
    from .ai import interpret_decision
    try:
        columns = get_profile(parse_csv(body.csv))["columns"]
        return interpret_decision(body.question, columns)
    except DataError as exc:
        raise HTTPException(422, detail=str(exc))
    except Exception:
        raise HTTPException(503, detail="Question interpretation unavailable. Choose settings manually.")
