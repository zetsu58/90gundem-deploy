FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir "requests-oauthlib>=2.0,<3" "Pillow>=10,<13"
COPY viral_futbol /app/viral_futbol
COPY scripts /app/scripts
RUN useradd --create-home --uid 10001 app && mkdir -p /data && chown -R app:app /app /data
USER app
ENV PORT=8080 PYTHONUNBUFFERED=1 NEWS_DB_PATH=/data/viral_futbol.sqlite3
EXPOSE 8080
CMD ["python", "-m", "viral_futbol.web"]
