"""Gemini AI istemcisi (Replit AI Integrations proxy üzerinden)."""
from __future__ import annotations
import os
import json
import base64
import aiohttp
import google.generativeai as genai
from google.api_core import client_options as client_options_lib

FLASH_MODEL = "gemini-2.5-flash"

_configured = False


def _configure():
    global _configured
    if _configured:
        return
    api_key = os.environ.get("AI_INTEGRATIONS_GEMINI_API_KEY", "")
    base_url = os.environ.get("AI_INTEGRATIONS_GEMINI_BASE_URL", "")
    opts = {}
    if base_url:
        opts["client_options"] = client_options_lib.ClientOptions(api_endpoint=base_url)
    genai.configure(api_key=api_key, transport="rest", **opts)
    _configured = True


def _get_model() -> genai.GenerativeModel:
    _configure()
    return genai.GenerativeModel(FLASH_MODEL)


async def generate_json(prompt: str) -> dict:
    """Metin prompt'tan JSON üret."""
    import asyncio
    model = _get_model()
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                max_output_tokens=8192,
                temperature=0.85,
            ),
        ),
    )
    text = response.text or ""
    if not text:
        raise ValueError("Gemini boş yanıt döndürdü")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini yanıtı JSON değil: {e}\n\nYanıt: {text[:500]}")


async def generate_text(prompt: str) -> str:
    """Metin prompt'tan serbest metin üret."""
    import asyncio
    model = _get_model()
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                max_output_tokens=8192,
                temperature=0.9,
            ),
        ),
    )
    return response.text or ""


async def analyze_image_lineup(image_url: str, mime_type: str) -> dict:
    """Görsel üzerinden 11'lik kadro ve dizilişi çıkar."""
    import asyncio

    prompt = """Bu bir futbol takımının 11 kişilik kadro/diziliş görseli. Görseldeki tüm oyuncuların adlarını ve dizilişini çıkar.

Görselde olabilecekler:
- Diziliş diyagramı (formasyon)
- Oyuncu isimleri listesi
- FIFA/PES/eFootball gibi oyun ekran görüntüsü
- Takım fotoğrafı altında isimler

KURALLAR:
- En az 11, en fazla 11 oyuncu adı bul
- Diziliş formatı: "4-4-2", "4-3-3", "4-2-3-1" vb.
- Oyuncu adları olabildiğince doğru/eksiksiz yazılsın
- Diziliş tespit edilemiyorsa null dön

YANIT FORMATI (sadece bu JSON, başka hiçbir şey ekleme):
{
  "formation": "4-3-3",
  "playerNames": ["Ad1", "Ad2", ..., "Ad11"],
  "rawAnalysis": "Görseli kısaca tarif et (Türkçe, 1-2 cümle)"
}"""

    async with aiohttp.ClientSession() as session:
        async with session.get(image_url) as resp:
            if not resp.ok:
                raise ValueError(f"Görsel indirilemedi ({resp.status})")
            img_bytes = await resp.read()

    img_b64 = base64.b64encode(img_bytes).decode()

    _configure()
    model = _get_model()
    loop = asyncio.get_event_loop()

    import google.generativeai.types as genai_types
    response = await loop.run_in_executor(
        None,
        lambda: model.generate_content(
            [
                {"mime_type": mime_type, "data": img_b64},
                prompt,
            ],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                max_output_tokens=4096,
                temperature=0.4,
            ),
        ),
    )
    text = response.text or ""
    if not text:
        raise ValueError("Gemini görsel analizinde boş yanıt döndü")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI yanıtı JSON değil: {e}\n\n{text[:500]}")
