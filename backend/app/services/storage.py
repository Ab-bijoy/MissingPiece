"""StorageService (build prompt 10): upload proof documents, make short-lived links.

- Supabase Storage private bucket, when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
  Create the bucket first: Storage > New bucket > name it STORAGE_BUCKET, keep it PRIVATE.
- Otherwise a local folder (backend/uploads), the fake for development and tests.
"""

from pathlib import Path
from typing import Protocol

import httpx

from app.config import get_settings
from app.errors import ApiError

LOCAL_DIR = Path(__file__).resolve().parents[2] / "uploads"


class StorageService(Protocol):
    def upload(self, key: str, data: bytes, content_type: str) -> None: ...
    def signed_url(self, key: str, seconds: int = 300) -> str | None: ...


class SupabaseStorage:
    def __init__(self, url: str, service_key: str, bucket: str):
        self.base = url.rstrip("/") + "/storage/v1"
        self.bucket = bucket
        self.headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    def upload(self, key: str, data: bytes, content_type: str) -> None:
        r = httpx.post(
            f"{self.base}/object/{self.bucket}/{key}",
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            content=data,
            timeout=30,
        )
        if r.status_code >= 300:
            # Pass on Supabase's own reason, plus what to change in the dashboard.
            try:
                reason = str(r.json().get("message") or r.json().get("error") or r.text)[:200]
            except ValueError:
                reason = r.text[:200]
            low = reason.lower()
            if "not found" in low:
                hint = f" Create a private bucket named '{self.bucket}' in Supabase Storage."
            elif "mime" in low:
                hint = (
                    f" In Supabase Storage, allow application/pdf, image/jpeg and image/png on bucket '{self.bucket}'."
                )
            elif "size" in low:
                hint = f" In Supabase Storage, raise the file size limit on bucket '{self.bucket}' to 5 MB."
            else:
                hint = ""
            raise ApiError(502, f"Could not store the document: {reason}.{hint}", "storage_failed")

    def signed_url(self, key: str, seconds: int = 300) -> str | None:
        r = httpx.post(
            f"{self.base}/object/sign/{self.bucket}/{key}",
            headers=self.headers,
            json={"expiresIn": seconds},
            timeout=15,
        )
        if r.status_code >= 300:
            return None
        path = r.json().get("signedURL") or r.json().get("signedUrl")
        return f"{self.base}{path}" if path else None


class LocalStorage:
    """Development fake: files go to backend/uploads (git-ignored). No links."""

    def upload(self, key: str, data: bytes, content_type: str) -> None:
        target = LOCAL_DIR / key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def signed_url(self, key: str, seconds: int = 300) -> str | None:
        return None


def storage() -> StorageService:
    s = get_settings()
    if s.supabase_url and s.supabase_service_role_key:
        return SupabaseStorage(s.supabase_url, s.supabase_service_role_key, s.storage_bucket)
    return LocalStorage()
