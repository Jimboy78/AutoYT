import os
from dataclasses import dataclass
from typing import Optional, Dict


@dataclass
class PresignResult:
  url: str
  method: str = "POST"
  fields: Dict[str, str] | None = None
  headers: Dict[str, str] | None = None


class LocalStorage:
  def __init__(self, upload_endpoint: str = "/api/v1/uploads/upload_file"):
    self.upload_endpoint = upload_endpoint

  def presign(self, filename: str, content_type: Optional[str] = None, size: Optional[int] = None) -> PresignResult:
    return PresignResult(url=self.upload_endpoint, method="POST", fields={})


class S3Storage:
  def __init__(self):
    import boto3  # type: ignore
    self.bucket = os.getenv("S3_BUCKET", "autoyt")
    self.prefix = os.getenv("S3_PREFIX", "uploads/")
    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    self.client = boto3.client(
      "s3",
      endpoint_url=endpoint_url,
      aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
      aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
      region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    )

  def presign(self, filename: str, content_type: Optional[str] = None, size: Optional[int] = None) -> PresignResult:
    key = f"{self.prefix}{filename}"
    params = {"Bucket": self.bucket, "Key": key}
    if content_type:
      params["ContentType"] = content_type
    url = self.client.generate_presigned_url(
      ClientMethod="put_object",
      Params=params,
      ExpiresIn=int(os.getenv("S3_PRESIGN_TTL", "3600")),
    )
    headers = {"Content-Type": content_type or "application/octet-stream"}
    return PresignResult(url=url, method="PUT", headers=headers)


def get_storage():
  use_s3 = os.getenv("USE_S3", "false").lower() in ("1", "true", "yes")
  if use_s3:
    try:
      return S3Storage()
    except Exception:
      return LocalStorage()
  return LocalStorage()


def ensure_bucket_exists():
  """Crea el bucket en S3/MinIO si no existe (best-effort)."""
  use_s3 = os.getenv("USE_S3", "false").lower() in ("1", "true", "yes")
  if not use_s3:
    return
  try:
    import boto3  # type: ignore
    bucket = os.getenv("S3_BUCKET", "autoyt")
    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    client = boto3.client(
      "s3",
      endpoint_url=endpoint_url,
      aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
      aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
      region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    )
    existing = client.list_buckets().get("Buckets", [])
    if not any(b.get("Name") == bucket for b in existing):
      client.create_bucket(Bucket=bucket)
  except Exception:
    # Evitar fallo de arranque si no está disponible
    pass
