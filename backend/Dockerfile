# Kaiwa backend image — for the hosted cloud demo (Google Cloud Run).
# Build context is the backend/ directory. Deploy with
# `gcloud run deploy --source backend` — see README "Deploying a live demo".
FROM python:3.12-slim

# uv for dependency management, matching the local tooling.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# ffmpeg is only needed for local Whisper STT. The hosted demo uses Google STT
# (KAIWA_STT_PROVIDER=google), so it is omitted to keep the image lean. Add
# `apt-get install -y ffmpeg` here if you switch STT back to whisper.

# Install dependencies first for layer caching. Include the anthropic extra —
# the hosted demo runs the cloud LLM provider.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --extra anthropic

# Application code and the dictionary builder.
COPY app ./app
COPY scripts ./scripts

# Bake the reading-aids dictionary (JMdict + KANJIDIC2) into the image so it is
# present at runtime without a writable/persistent disk. Needs network at build.
RUN uv run python scripts/build_dictionaries.py

# Cloud Run provides $PORT. --proxy-headers + forwarded-allow-ips let per-IP
# rate limiting see the real client IP behind the platform proxy, not the proxy's.
EXPOSE 8000
CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
