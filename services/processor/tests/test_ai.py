from types import SimpleNamespace

from google import genai

from rowvitra.ai import plan


PROFILE = {"columns": [{"name": "region", "type": "text", "protected": False, "missing": 0}], "issues": []}
FALLBACK = [{"operation": {"operation": "normalize_category", "column": "region"}}]


def test_invalid_gemini_proposals_are_labeled_as_fallback(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "synthetic-test-key")
    response = SimpleNamespace(text='{"proposals":[{"title":"Unsafe","reason":"No","operation":"execute_python","column":"region"}]}')
    monkeypatch.setattr(genai, "Client", lambda **_kwargs: SimpleNamespace(models=SimpleNamespace(generate_content=lambda **_kwargs: response)))
    result = plan(PROFILE, FALLBACK, "regional totals")
    assert result["mode"] == "rules"
    assert result["proposals"] == FALLBACK


def test_provider_exception_is_not_reflected_to_client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "synthetic-test-key")

    def fail(**_kwargs):
        raise RuntimeError("provider secret and private request details")

    monkeypatch.setattr(genai, "Client", fail)
    result = plan(PROFILE, FALLBACK, "regional totals")
    assert result["mode"] == "rules"
    assert "secret" not in result["notice"]
    assert result["proposals"] == FALLBACK
