"""Deterministic admission rules for the zero-new-API-fees pilot."""
from decimal import Decimal, InvalidOperation
import math
import time

MODEL = "nvidia/nemotron-3.5-lightning:free"
CATALOG_TTL = 30


class PolicyError(ValueError):
    pass


def require_free(catalog, fetched_at, now=None):
    now = time.time() if now is None else now
    if not isinstance(fetched_at, (int, float)) or not math.isfinite(fetched_at) or not 0 <= now - fetched_at <= CATALOG_TTL:
        raise PolicyError("Catalogue absent ou périmé.")
    if not isinstance(catalog, dict) or not isinstance(catalog.get("data"), list):
        raise PolicyError("Catalogue non vérifiable.")
    matches = [m for m in catalog["data"] if isinstance(m, dict) and m.get("id") == MODEL]
    if len(matches) != 1:
        raise PolicyError("Modèle gratuit indisponible.")
    pricing = matches[0].get("pricing")
    if not isinstance(pricing, dict) or not {"prompt", "completion"} <= pricing.keys():
        raise PolicyError("Tarification inconnue.")
    for value in pricing.values():
        try:
            price = Decimal(str(value))
        except InvalidOperation:
            raise PolicyError("Tarification inconnue.") from None
        if not price.is_finite() or price != 0:
            raise PolicyError("Une tarification non nulle ou inconnue est refusée.")
    return {"model": MODEL, "checkedAt": fetched_at, "pricing": pricing}


def safe_completion(body):
    if not isinstance(body, dict) or body.get("model") != MODEL:
        raise PolicyError("Modèle non autorisé ; aucun repli.")
    if body.get("stream") not in (None, False) or body.get("tools") not in (None, []):
        raise PolicyError("Outils et streaming non autorisés dans ce pilote.")
    if any(body.get(field) for field in ("models", "plugins", "transforms", "route")):
        raise PolicyError("Extension ou routage non autorisé.")
    messages = body.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 32:
        raise PolicyError("Messages non valides.")
    clean = []
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in {"system", "user", "assistant"} or not isinstance(message.get("content"), str):
            raise PolicyError("Message ou appel d'outil non autorisé.")
        if message.get("tool_calls") or message.get("function_call"):
            raise PolicyError("Appel d'outil non autorisé.")
        clean.append({"role": message["role"], "content": message["content"]})
    if len(str(clean).encode()) > 100_000:
        raise PolicyError("Contexte trop volumineux.")
    # Never forward caller routing, credentials, plugins, tools or paid sidecars.
    return {"model": MODEL, "messages": clean, "max_tokens": 1536, "stream": False,
            "reasoning": {"enabled": False},
            "provider": {"allow_fallbacks": False, "max_price": {"prompt": 0, "completion": 0}},
            "usage": {"include": True}}


def verified_usage(response):
    if not isinstance(response, dict) or response.get("model") not in {MODEL, MODEL.removesuffix(":free")}:
        raise PolicyError("Modèle effectif non vérifié.")
    usage = response.get("usage")
    try:
        cost = Decimal(str(usage["cost"]))
    except (KeyError, TypeError, InvalidOperation):
        raise PolicyError("Coût de la réponse non vérifiable.") from None
    if not cost.is_finite() or cost != 0:
        raise PolicyError("Le coût rapporté n'est pas nul.")
    return {"costUsd": "0", "model": response["model"],
            "promptTokens": usage.get("prompt_tokens"), "completionTokens": usage.get("completion_tokens")}
