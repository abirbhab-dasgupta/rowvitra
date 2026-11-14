"""Gemini is a proposal source, never a code execution path."""
from __future__ import annotations
import os
from .engine import suggest_repairs, DataError

ALLOWED = {"trim","normalize_category","replace_values","fill_missing","cast_numeric","drop_duplicates","edit_cell"}

def plan(csv_profile: dict, fallback: list[dict], goal: str) -> dict:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        return {"mode":"rules", "notice":"Gemini key not set; deterministic suggestions are shown", "proposals":fallback}
    try:
        from google import genai
        from pydantic import BaseModel, Field
        class Proposal(BaseModel):
            title: str
            reason: str
            operation: str
            column: str | None = None
            parameters: dict[str, str] = Field(default_factory=dict)
        class Response(BaseModel):
            proposals: list[Proposal]
        client = genai.Client(api_key=key)
        metadata = {"columns":[{"name":c["name"],"type":c["type"],"protected":c["protected"],"missing":c["missing"]} for c in csv_profile["columns"]], "issues":[{"id":i["id"],"kind":i["kind"],"column":i["column"],"count":i["count"]} for i in csv_profile["issues"][:20]],"goal":goal[:240]}
        response = client.models.generate_content(model=os.getenv("GEMINI_MODEL","gemini-2.5-flash"), contents="You are a careful data repair planner. Recommend only justified transformations with no made-up replacements. Never modify protected identifiers. Allowed operations: trim, normalize_category, drop_duplicates. Return at most 8 proposals. Metadata: " + str(metadata), config={"response_mime_type":"application/json","response_schema":Response,"temperature":0.1})
        parsed = Response.model_validate_json(response.text or "{}")
        permitted = {c["name"] for c in csv_profile["columns"] if not c["protected"]}
        proposals = []
        for i,item in enumerate(parsed.proposals[:8]):
            if item.operation not in {"trim","normalize_category","drop_duplicates"}: continue
            if item.operation != "drop_duplicates" and item.column not in permitted: continue
            proposals.append({"issueId":f"gemini-{i}","title":item.title[:120],"reason":item.reason[:500],"risk":"medium", "operation":{"operation":item.operation,"column":item.column,"parameters":{}},"source":"gemini"})
        return {"mode":"gemini", "notice":"AI plans require user approval and deterministic validation", "proposals": proposals or fallback}
    except Exception as exc:
        return {"mode":"rules", "notice":f"Gemini unavailable: {str(exc)[:120]}. Showing rules-based suggestions.", "proposals":fallback}

def recommend_chart(profile: dict, goal: str) -> dict:
    columns = profile["columns"]
    available = [c["name"] for c in columns]
    numerical = [c["name"] for c in columns if c["type"]=="number"]
    categorical = [c["name"] for c in columns if c["type"]=="text"]
    default = {"type":"bar","x":categorical[0] if categorical else available[0],"y":numerical[0] if numerical else available[min(1,len(available)-1)],"aggregation":"sum" if numerical else "count","title":"Dataset overview"}
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        return {"mode":"rules","spec":default,"reason":"Chart selected from column types; Gemini key is not configured"}
    try:
        from pydantic import BaseModel
        from google import genai
        class ChartChoice(BaseModel):
            type: str
            x: str
            y: str
            aggregation: str
            title: str
            reason: str
        client = genai.Client(api_key=key)
        response = client.models.generate_content(model=os.getenv("GEMINI_MODEL","gemini-2.5-flash"),contents=f"Given columns {[(c['name'],c['type']) for c in columns]} and goal {goal[:200]!r}, choose a suitable meaningful chart. Only types bar, line, pie, scatter, histogram, box; aggregations sum, mean, median, count. Never return numeric chart data.",config={"response_mime_type":"application/json","response_schema":ChartChoice,"temperature":0.1})
        plan = ChartChoice.model_validate_json(response.text or "{}")
        if plan.type not in {"bar","line","pie","scatter","histogram","box"} or plan.x not in available or plan.y not in available or plan.aggregation not in {"sum","mean","median","count"}:
            raise ValueError("AI requested unsupported chart settings")
        return {"mode":"gemini","spec":plan.model_dump(exclude={"reason"}),"reason":plan.reason[:300]}
    except Exception as exc:
        return {"mode":"rules","spec":default,"reason":"Falling back to column metadata after unavailable AI chart advice"}
