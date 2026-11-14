import json

import httpx
import pytest
from fastapi.testclient import TestClient

from rowvitra.ai import DEFAULT_MODEL, NVIDIA_URL, plan, recommend_chart
from rowvitra.main import app


PROFILE = {
    "columns": [
        {"name": "region", "type": "text", "protected": False, "missing": 0},
        {"name": "revenue", "type": "number", "protected": False, "missing": 0},
        {"name": "account_id", "type": "text", "protected": True, "missing": 0},
    ],
    "issues": [],
}
FALLBACK = [{"operation": {"operation": "normalize_category", "column": "region"}}]


def mock_completion(monkeypatch, content, status=200, finish_reason="stop"):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        request = httpx.Request("POST", url)
        return httpx.Response(
            status,
            json={"choices": [{"message": {"content": json.dumps(content)}, "finish_reason": finish_reason}]},
            request=request,
        )

    monkeypatch.setattr(httpx, "post", post)
    return calls


def test_nvidia_repair_request_and_validated_response(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    monkeypatch.delenv("NVIDIA_MODEL", raising=False)
    assert DEFAULT_MODEL == "nvidia/nemotron-3.5-bolt-e4b"
    calls = mock_completion(monkeypatch, {"proposals": [
        {"title": "Trim region", "reason": "Whitespace", "operation": "trim", "column": "region"},
        {"title": "Unsafe", "reason": "No", "operation": "execute_python", "column": "region"},
        {"title": "Protected", "reason": "No", "operation": "trim", "column": "account_id"},
    ]})
    result = plan(PROFILE, FALLBACK, "regional totals")
    assert result["mode"] == "nvidia"
    assert len(result["proposals"]) == 1
    assert result["proposals"][0]["source"] == "nvidia"
    assert calls[0][0] == NVIDIA_URL
    assert calls[0][1]["headers"]["Authorization"] == "Bearer synthetic-test-key"
    assert calls[0][1]["json"]["model"] == DEFAULT_MODEL
    assert calls[0][1]["json"]["stream"] is False
    assert calls[0][1]["json"]["response_format"]["type"] == "json_schema"
    assert "synthetic-test-key" not in str(result)


def test_configured_model_and_chart_response(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("NVIDIA_MODEL", "other/model")
    calls = mock_completion(monkeypatch, {"type": "bar", "x": "region", "y": "revenue", "aggregation": "sum", "title": "Revenue", "reason": "Compare regions"})
    result = recommend_chart(PROFILE, "compare revenue")
    assert result["mode"] == "nvidia"
    assert result["spec"]["x"] == "region"
    assert calls[0][1]["json"]["model"] == "other/model"
    assert "chat_template_kwargs" not in calls[0][1]["json"]


@pytest.mark.parametrize("content", [
    {"proposals": [{"title": "Unsafe", "reason": "No", "operation": "execute_python", "column": "region"}]},
    {"proposals": [{"title": "Protected", "reason": "No", "operation": "trim", "column": "account_id"}]},
    {"unexpected": "shape"},
])
def test_invalid_repair_output_uses_rules(monkeypatch, content):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    mock_completion(monkeypatch, content)
    result = plan(PROFILE, FALLBACK, "regional totals")
    assert result["mode"] == "rules"
    assert result["proposals"] == FALLBACK


def test_incomplete_response_uses_rules(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    mock_completion(monkeypatch, {"proposals": []}, finish_reason="length")
    assert plan(PROFILE, FALLBACK, "regional totals")["mode"] == "rules"


def test_missing_key_does_not_call_provider(monkeypatch):
    monkeypatch.delenv("NVIDIA_API_KEY", raising=False)
    monkeypatch.setattr(httpx, "post", lambda *_args, **_kwargs: pytest.fail("unexpected provider call"))
    assert plan(PROFILE, FALLBACK, "")["mode"] == "rules"
    assert recommend_chart(PROFILE, "")["mode"] == "rules"


@pytest.mark.parametrize(("status", "phrase"), [(401, "API key"), (402, "credits"), (404, "model"), (429, "rate limit"), (500, "unavailable")])
def test_http_failures_are_labelled_without_provider_body(monkeypatch, status, phrase):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    mock_completion(monkeypatch, {"error": "private provider details"}, status=status)
    result = plan(PROFILE, FALLBACK, "")
    assert result["mode"] == "rules"
    assert phrase in result["notice"]
    assert "private" not in result["notice"]


def test_timeout_uses_labelled_fallback(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    monkeypatch.setattr(httpx, "post", lambda *_args, **_kwargs: (_ for _ in ()).throw(httpx.ReadTimeout("secret request details")))
    result = plan(PROFILE, FALLBACK, "")
    assert result["mode"] == "rules"
    assert "timed out" in result["notice"]
    assert "secret" not in result["notice"]


def test_invalid_chart_output_uses_metadata(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    mock_completion(monkeypatch, {"type": "script", "x": "region", "y": "revenue", "aggregation": "sum", "title": "Bad", "reason": "No"})
    result = recommend_chart(PROFILE, "")
    assert result["mode"] == "rules"
    assert result["spec"]["type"] == "bar"


def test_authenticated_processor_routes_return_nvidia_results(monkeypatch):
    monkeypatch.setenv("PROCESSOR_SERVICE_TOKEN", "synthetic-processor-token")
    monkeypatch.setenv("NVIDIA_API_KEY", "synthetic-test-key")
    mock_completion(monkeypatch, {"proposals": [
        {"title": "Normalize region", "reason": "Case mismatch", "operation": "normalize_category", "column": "region"},
    ]})
    client = TestClient(app)
    body = {"csv": "account_id,region,revenue\n001,North,30\n002,NORTH,50\n"}
    assert client.post("/v1/suggest", json=body).status_code == 401
    result = client.post("/v1/suggest", headers={"X-Processor-Token": "synthetic-processor-token"}, json=body)
    assert result.status_code == 200
    assert result.json()["mode"] == "nvidia"
    assert result.json()["proposals"][0]["operation"]["operation"] == "normalize_category"
