#!/usr/bin/env python3
"""Backup chat.geniuzs.com (Open WebUI) state to R2 (or local fallback).

Runs ON the Genius Substrates host. Captures a WAL-consistent snapshot of
webui.db plus the small uploads/ and vector_db/ dirs, tars them, and uploads
to the genius-server-backups R2 bucket. Durable + idempotent.

Modes:
  default            -> push to R2 under chat-geniuzs/<YYYY-MM-DD>.tar.gz
  --local <dir>      -> write chat-geniuzs-<ts>.tar.gz to <dir> on the host instead

Requires from caller env (secrets, never printed) for R2 mode:
  CLOUDFLARE_S3_API_ENDPOINT, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY
Optional: CL_BACKUP_HOST_DATA_DIR overrides the backend-data volume path.
"""
import argparse, io, os, shutil, sqlite3, tarfile, tempfile, time

DATA_DIR = os.environ.get("CL_BACKUP_HOST_DATA_DIR", "/data/coolify/volumes/ynuu6714x5m50f42ok769jiu/backend-data")
BUCKET = "genius-server-backups"
PREFIX = "chat-geniuzs"
KEY = f"{PREFIX}/{time.strftime('%Y-%m-%d')}.tar.gz"
DB_SRC = os.path.join(DATA_DIR, "webui.db")


def consistent_db_snapshot(tmpdir: str) -> str:
    """Use sqlite3 online-backup API so the copy is WAL/checkpoint-consistent."""
    dst = os.path.join(tmpdir, "webui.db")
    src = sqlite3.connect(DB_SRC)
    snap = sqlite3.connect(dst)
    with src:
        src.backup(snap)
    snap.close(); src.close()
    return dst


def build_tarball(tmpdir: str) -> io.BytesIO:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(os.path.join(tmpdir, "webui.db"), arcname="webui.db")
        for sub in ("uploads", "vector_db"):
            p = os.path.join(DATA_DIR, sub)
            if os.path.isdir(p):
                tar.add(p, arcname=sub)
    buf.seek(0)
    return buf


def upload(blob: io.BytesIO, size: int) -> str:
    import boto3
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["CLOUDFLARE_S3_API_ENDPOINT"],
        aws_access_key_id=os.environ["CLOUDFLARE_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["CLOUDFLARE_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    s3.put_object(Bucket=BUCKET, Key=KEY, Body=blob, ContentType="application/gzip")
    return KEY


def main():
    ap = argparse.ArgumentParser(description="Backup chat.geniuzs.com state")
    ap.add_argument("--local", metavar="DIR", help="write tarball locally instead of R2")
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        snap = consistent_db_snapshot(tmp)
        mtime = os.path.getmtime(DB_SRC)
        os.utime(snap, (mtime, mtime))
        blob = build_tarball(tmp)

    size = len(blob.getvalue())
    ts = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    if a.local:
        os.makedirs(a.local, exist_ok=True)
        path = os.path.join(a.local, f"chat-geniuzs-{ts}.tar.gz")
        blob.seek(0)
        with open(path, "wb") as f:
            shutil.copyfileobj(blob, f)
        print(f"OK_TS={ts}")
        print(f"OK_LOCAL={path}")
        print(f"OK_BYTES={size}")
        print(f"OK_SOURCE_DB={DB_SRC}")
        return

    key = upload(blob, size)
    print(f"OK_TS={ts}")
    print(f"OK_BUCKET={BUCKET}")
    print(f"OK_KEY={key}")
    print(f"OK_BYTES={size}")
    print(f"OK_SOURCE_DB={DB_SRC}")


if __name__ == "__main__":
    main()
