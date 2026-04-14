from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"
    render_external_url: str = "http://localhost:8000"
    internal_api_key: str = "dev_internal_key_change_me"

    # Database
    mongodb_url: str = "mongodb://localhost:27017"

    # API Keys
    clerk_secret_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    unsplash_access_key: Optional[str] = None
    ocr_space_api_key: Optional[str] = None
    google_maps_api_key: Optional[str] = None
    resend_api_key: Optional[str] = None

    # Cloudinary
    cloudinary_cloud_name: Optional[str] = None
    cloudinary_api_key: Optional[str] = None
    cloudinary_api_secret: Optional[str] = None

    # Twilio
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_whatsapp_from: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
