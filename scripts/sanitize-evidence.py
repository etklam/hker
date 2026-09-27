"""Redact credentials from diagnostic artifacts, including Playwright trace JSON."""
import json
import pathlib
import re
import zipfile

SECRET_KEYS = {"cookie", "cookies", "set-cookie", "authorization", "password", "token", "signature", "sessiontoken", "session_token", "auth_session_secret", "telegram_bot_token", "telegram_webhook_secret"}

def redact(value):
    if isinstance(value, dict):
        if str(value.get("name", "")).lower() in SECRET_KEYS and "value" in value:
            return {**value, "value": "[REDACTED]"}
        return {key: "[REDACTED]" if key.lower() in SECRET_KEYS else redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        if value.lstrip().startswith(("{", "[")):
            try:
                return json.dumps(redact(json.loads(value)), ensure_ascii=False)
            except json.JSONDecodeError:
                pass
        value = re.sub(r"postgres(?:ql)?://[^\s\"']+", "[REDACTED_DATABASE_URL]", value)
        return re.sub(r'("signature"\s*:\s*")[^"]+', r'\1[REDACTED]', value)
    return value

def clean_text(raw):
    text = raw.decode("utf-8")
    try:
        return json.dumps(redact(json.loads(text)), ensure_ascii=False).encode()
    except json.JSONDecodeError:
        output = []
        for line in text.splitlines():
            try:
                output.append(json.dumps(redact(json.loads(line)), ensure_ascii=False))
            except json.JSONDecodeError:
                output.append(redact(line))
        return ("\n".join(output) + "\n").encode()

for root in ["artifacts/release-candidate", "test-results", "playwright-report"]:
    for path in pathlib.Path(root).rglob("*"):
        if not path.is_file():
            continue
        if path.suffix == ".zip":
            with zipfile.ZipFile(path) as archive:
                entries = [(entry, archive.read(entry)) for entry in archive.infolist()]
            with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
                for entry, data in entries:
                    try:
                        if entry.filename.endswith((".trace", ".network", ".json")) or data.lstrip().startswith((b"{", b"[")):
                            data = clean_text(data)
                    except UnicodeDecodeError:
                        pass
                    archive.writestr(entry, data)
        elif path.suffix in {".json", ".log", ".jsonl"}:
            path.write_bytes(clean_text(path.read_bytes()))
