"""Security, hashing and session helpers."""

import hashlib
import secrets
from typing import Tuple

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
    _ph = PasswordHasher()
    _HAS_ARGON2 = True
except ImportError:
    _HAS_ARGON2 = False


def hash_password(password: str) -> str:
    """Hash password using Argon2id with secure fallback."""
    if _HAS_ARGON2:
        return _ph.hash(password)
    # Secure fallback for environments without argon2-cffi compiled yet
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"$pbkdf2-sha256$100000${salt}${derived.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed string."""
    if not hashed_password:
        return False
    if hashed_password.startswith("$argon2"):
        if _HAS_ARGON2:
            try:
                return _ph.verify(hashed_password, plain_password)
            except VerifyMismatchError:
                return False
        # If stored with argon2 but library not loaded, reject for security
        return False
    if hashed_password.startswith("$pbkdf2-sha256$"):
        parts = hashed_password.split("$")
        if len(parts) == 5:
            salt = parts[3]
            expected = parts[4]
            derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
            return secrets.compare_digest(derived.hex(), expected)
    return False


def generate_session_credentials() -> Tuple[str, str, str]:
    """
    Generate raw session cookie token, its SHA-256 hash for DB storage, and a CSRF token.
    Never store raw session tokens in the database.
    """
    raw_session_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_session_token.encode("utf-8")).hexdigest()
    csrf_token = secrets.token_urlsafe(32)
    return raw_session_token, token_hash, csrf_token


def hash_session_token(raw_token: str) -> str:
    """Compute SHA-256 hash of a raw session token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

