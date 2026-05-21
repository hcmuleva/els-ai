import io
import sys

import numpy as np
import soundfile as sf
import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="Kokoro TTS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Lazy-loaded pipeline (first request triggers model load ~2–3s)
_pipeline = None


def get_pipeline(lang_code: str = "a"):
    global _pipeline
    if _pipeline is None:
        print("Loading Kokoro model...", flush=True)
        from kokoro import KPipeline
        _pipeline = KPipeline(lang_code=lang_code)
        print("Kokoro model ready.", flush=True)
    return _pipeline


@app.get("/health")
def health():
    return {"status": "ok", "service": "tts-service"}


@app.get("/tts")
def tts(
    text: str = Query(..., description="Text to speak"),
    voice: str = Query("af_heart", description="Kokoro voice ID"),
    speed: float = Query(1.0, ge=0.5, le=2.0, description="Speech speed"),
):
    """
    Returns WAV audio for the given text using the Kokoro TTS model.
    Default voice is af_heart (American female, Heart ❤️).
    """
    pipeline = get_pipeline()

    audio_chunks = []
    sample_rate = 24000

    try:
        generator = pipeline(text, voice=voice, speed=speed)
        for _gs, _ps, audio in generator:
            if audio is not None:
                audio_chunks.append(audio)
    except Exception as e:
        print(f"TTS generation error: {e}", file=sys.stderr)
        # Return silence on error so the app doesn't crash
        audio_chunks = [np.zeros(sample_rate, dtype=np.float32)]

    combined = np.concatenate(audio_chunks) if audio_chunks else np.zeros(sample_rate, dtype=np.float32)

    buf = io.BytesIO()
    sf.write(buf, combined, sample_rate, format="WAV")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={"Cache-Control": "no-cache"},
    )


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    print(f"Starting Kokoro TTS Service on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
