FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x docker/entrypoint.sh \
    && mkdir -p /app/logs /app/snapshot

EXPOSE 8000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["python", "-u", "main.py"]
