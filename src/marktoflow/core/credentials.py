"""Credential encryption and management.

This module provides secure credential storage with encryption support for:
- Age encryption (modern, recommended)
- GPG encryption (traditional, widely supported)
- Fernet encryption (built-in, no external dependencies)

Credentials are stored encrypted at rest and decrypted only when needed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any


class EncryptionBackend(str, Enum):
    """Supported encryption backends."""

    AGE = "age"
    GPG = "gpg"
    FERNET = "fernet"  # Built-in, no external dependencies


class CredentialType(str, Enum):
    """Types of credentials."""

    API_KEY = "api_key"
    TOKEN = "token"
    PASSWORD = "password"
    CERTIFICATE = "certificate"
    SSH_KEY = "ssh_key"
    SECRET = "secret"
    OAUTH_TOKEN = "oauth_token"
    CUSTOM = "custom"


@dataclass
class Credential:
    """A credential entry."""

    name: str
    credential_type: CredentialType
    value: str  # Encrypted or plaintext depending on context
    description: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    expires_at: datetime | None = None
    tags: list[str] = field(default_factory=list)

    def is_expired(self) -> bool:
        """Check if credential has expired."""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "credential_type": self.credential_type.value,
            "value": self.value,
            "description": self.description,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Credential:
        """Deserialize from dictionary."""
        return cls(
            name=data["name"],
            credential_type=CredentialType(data["credential_type"]),
            value=data["value"],
            description=data.get("description", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            expires_at=datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at")
            else None,
            tags=data.get("tags", []),
        )


class EncryptionError(Exception):
    """Raised when encryption/decryption fails."""

    pass


class KeyNotFoundError(Exception):
    """Raised when encryption key is not found."""

    pass


class CredentialNotFoundError(Exception):
    """Raised when credential is not found."""

    pass


class Encryptor(ABC):
    """Abstract base class for encryption backends."""

    @abstractmethod
    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext and return ciphertext."""
        pass

    @abstractmethod
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext and return plaintext."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this encryption backend is available."""
        pass

    @abstractmethod
    def generate_key(self) -> str:
        """Generate a new encryption key."""
        pass


class FernetEncryptor(Encryptor):
    """Built-in encryption using Fernet (symmetric encryption).

    This is the default backend when no external tools are available.
    Uses the cryptography library's Fernet implementation.
    """

    def __init__(self, key: str | None = None, key_file: Path | None = None):
        """Initialize Fernet encryptor.

        Args:
            key: Base64-encoded Fernet key
            key_file: Path to file containing the key
        """
        self._key: bytes | None = None

        if key:
            self._key = key.encode()
        elif key_file and key_file.exists():
            self._key = key_file.read_text().strip().encode()

    def _get_fernet(self) -> Any:
        """Get Fernet instance."""
        try:
            from cryptography.fernet import Fernet
        except ImportError:
            raise EncryptionError(
                "cryptography package not installed. Install with: pip install cryptography"
            )

        if not self._key:
            raise KeyNotFoundError("No Fernet key configured")

        return Fernet(self._key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext using Fernet."""
        fernet = self._get_fernet()
        encrypted = fernet.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext using Fernet."""
        fernet = self._get_fernet()
        try:
            decrypted = fernet.decrypt(ciphertext.encode())
            return decrypted.decode()
        except Exception as e:
            raise EncryptionError(f"Decryption failed: {e}")

    def is_available(self) -> bool:
        """Check if cryptography package is available."""
        try:
            from cryptography.fernet import Fernet  # noqa: F401

            return True
        except ImportError:
            return False

    def generate_key(self) -> str:
        """Generate a new Fernet key."""
        try:
            from cryptography.fernet import Fernet

            return Fernet.generate_key().decode()
        except ImportError:
            raise EncryptionError(
                "cryptography package not installed. Install with: pip install cryptography"
            )

    def set_key(self, key: str) -> None:
        """Set the encryption key."""
        self._key = key.encode()


class AgeEncryptor(Encryptor):
    """Encryption using age (https://age-encryption.org/).

    Age is a modern, secure encryption tool that's simpler than GPG.
    Supports:
    - X25519 key pairs (recommended)
    - Passphrase-based encryption
    """

    def __init__(
        self,
        recipient: str | None = None,
        identity_file: Path | None = None,
        passphrase: str | None = None,
    ):
        """Initialize age encryptor.

        Args:
            recipient: Age public key (starts with "age1")
            identity_file: Path to identity file containing private key
            passphrase: Passphrase for symmetric encryption
        """
        self.recipient = recipient
        self.identity_file = identity_file
        self.passphrase = passphrase

    def _find_age_binary(self) -> str:
        """Find the age binary."""
        age_path = shutil.which("age")
        if not age_path:
            raise EncryptionError("age binary not found. Install from: https://age-encryption.org/")
        return age_path

    def _find_age_keygen_binary(self) -> str:
        """Find the age-keygen binary."""
        keygen_path = shutil.which("age-keygen")
        if not keygen_path:
            raise EncryptionError("age-keygen binary not found")
        return keygen_path

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext using age."""
        age_path = self._find_age_binary()

        cmd = [age_path, "--armor"]

        if self.passphrase:
            cmd.extend(["--passphrase"])
        elif self.recipient:
            cmd.extend(["--recipient", self.recipient])
        else:
            raise EncryptionError("No recipient or passphrase configured for age")

        try:
            env = os.environ.copy()
            if self.passphrase:
                # Use AGE_PASSPHRASE environment variable for non-interactive use
                env["AGE_PASSPHRASE"] = self.passphrase

            result = subprocess.run(
                cmd,
                input=plaintext.encode(),
                capture_output=True,
                env=env,
                check=True,
            )
            return result.stdout.decode()
        except subprocess.CalledProcessError as e:
            raise EncryptionError(f"age encryption failed: {e.stderr.decode()}")

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext using age."""
        age_path = self._find_age_binary()

        cmd = [age_path, "--decrypt"]

        if self.identity_file:
            cmd.extend(["--identity", str(self.identity_file)])

        try:
            env = os.environ.copy()
            if self.passphrase:
                env["AGE_PASSPHRASE"] = self.passphrase

            result = subprocess.run(
                cmd,
                input=ciphertext.encode(),
                capture_output=True,
                env=env,
                check=True,
            )
            return result.stdout.decode()
        except subprocess.CalledProcessError as e:
            raise EncryptionError(f"age decryption failed: {e.stderr.decode()}")

    def is_available(self) -> bool:
        """Check if age is available."""
        return shutil.which("age") is not None

    def generate_key(self) -> str:
        """Generate a new age key pair.

        Returns the identity (private key) content.
        The public key is included in the comment.
        """
        keygen_path = self._find_age_keygen_binary()

        try:
            result = subprocess.run(
                [keygen_path],
                capture_output=True,
                check=True,
            )
            return result.stdout.decode()
        except subprocess.CalledProcessError as e:
            raise EncryptionError(f"age-keygen failed: {e.stderr.decode()}")

    @staticmethod
    def extract_public_key(identity_content: str) -> str:
        """Extract public key from identity file content."""
        for line in identity_content.splitlines():
            line = line.strip()
            if line.startswith("# public key:"):
                return line.split(":", 1)[1].strip()
            if line.startswith("age1") and not line.startswith("AGE-SECRET-KEY"):
                return line
        raise EncryptionError("Could not extract public key from identity")


class GPGEncryptor(Encryptor):
    """Encryption using GPG (GNU Privacy Guard).

    GPG is the traditional encryption tool with wide support.
    Supports:
    - Asymmetric encryption with key IDs
    - Symmetric encryption with passphrases
    """

    def __init__(
        self,
        recipient: str | None = None,
        key_id: str | None = None,
        passphrase: str | None = None,
        symmetric: bool = False,
    ):
        """Initialize GPG encryptor.

        Args:
            recipient: Email or key ID of recipient
            key_id: GPG key ID for decryption
            passphrase: Passphrase for symmetric encryption or key unlock
            symmetric: Use symmetric encryption (passphrase-based)
        """
        self.recipient = recipient
        self.key_id = key_id
        self.passphrase = passphrase
        self.symmetric = symmetric

    def _find_gpg_binary(self) -> str:
        """Find the GPG binary."""
        for name in ["gpg2", "gpg"]:
            path = shutil.which(name)
            if path:
                return path
        raise EncryptionError("GPG binary not found. Install gnupg.")

    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext using GPG."""
        gpg_path = self._find_gpg_binary()

        cmd = [gpg_path, "--armor", "--batch", "--yes"]

        if self.symmetric:
            cmd.append("--symmetric")
            if self.passphrase:
                cmd.extend(["--passphrase", self.passphrase])
        else:
            if not self.recipient:
                raise EncryptionError("No recipient configured for GPG encryption")
            cmd.extend(["--encrypt", "--recipient", self.recipient])

        try:
            result = subprocess.run(
                cmd,
                input=plaintext.encode(),
                capture_output=True,
                check=True,
            )
            return result.stdout.decode()
        except subprocess.CalledProcessError as e:
            raise EncryptionError(f"GPG encryption failed: {e.stderr.decode()}")

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt ciphertext using GPG."""
        gpg_path = self._find_gpg_binary()

        cmd = [gpg_path, "--decrypt", "--batch", "--yes"]

        if self.passphrase:
            cmd.extend(["--passphrase", self.passphrase])

        try:
            result = subprocess.run(
                cmd,
                input=ciphertext.encode(),
                capture_output=True,
                check=True,
            )
            return result.stdout.decode()
        except subprocess.CalledProcessError as e:
            raise EncryptionError(f"GPG decryption failed: {e.stderr.decode()}")

    def is_available(self) -> bool:
        """Check if GPG is available."""
        return shutil.which("gpg") is not None or shutil.which("gpg2") is not None

    def generate_key(self) -> str:
        """Generate GPG key generation parameters.

        Returns a batch file content for GPG key generation.
        Note: Actual key generation requires user interaction or
        pre-configured parameters.
        """
        # Return batch parameters for key generation
        return """Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: AI Workflow
Name-Email: marktoflow@localhost
Expire-Date: 1y
%no-protection
%commit"""


class CredentialStore(ABC):
    """Abstract base class for credential storage."""

    @abstractmethod
    def save(self, credential: Credential) -> None:
        """Save a credential."""
        pass

    @abstractmethod
    def get(self, name: str) -> Credential | None:
        """Get a credential by name."""
        pass

    @abstractmethod
    def delete(self, name: str) -> bool:
        """Delete a credential. Returns True if deleted."""
        pass

    @abstractmethod
    def list(self, tag: str | None = None) -> list[Credential]:
        """List all credentials, optionally filtered by tag."""
        pass

    @abstractmethod
    def exists(self, name: str) -> bool:
        """Check if a credential exists."""
        pass


class InMemoryCredentialStore(CredentialStore):
    """In-memory credential store for testing."""

    def __init__(self) -> None:
        self._credentials: dict[str, Credential] = {}

    def save(self, credential: Credential) -> None:
        """Save a credential."""
        credential.updated_at = datetime.now()
        self._credentials[credential.name] = credential

    def get(self, name: str) -> Credential | None:
        """Get a credential by name."""
        return self._credentials.get(name)

    def delete(self, name: str) -> bool:
        """Delete a credential."""
        if name in self._credentials:
            del self._credentials[name]
            return True
        return False

    def list(self, tag: str | None = None) -> list[Credential]:
        """List all credentials."""
        credentials = list(self._credentials.values())
        if tag:
            credentials = [c for c in credentials if tag in c.tags]
        return credentials

    def exists(self, name: str) -> bool:
        """Check if a credential exists."""
        return name in self._credentials


class SQLiteCredentialStore(CredentialStore):
    """SQLite-based credential store for persistent storage."""

    def __init__(self, db_path: Path | str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        """Initialize the database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS credentials (
                    name TEXT PRIMARY KEY,
                    credential_type TEXT NOT NULL,
                    value TEXT NOT NULL,
                    description TEXT,
                    metadata TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    expires_at TEXT,
                    tags TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_credentials_type 
                ON credentials(credential_type)
            """)
            conn.commit()

    def save(self, credential: Credential) -> None:
        """Save a credential."""
        credential.updated_at = datetime.now()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO credentials 
                (name, credential_type, value, description, metadata, 
                 created_at, updated_at, expires_at, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    credential.name,
                    credential.credential_type.value,
                    credential.value,
                    credential.description,
                    json.dumps(credential.metadata),
                    credential.created_at.isoformat(),
                    credential.updated_at.isoformat(),
                    credential.expires_at.isoformat() if credential.expires_at else None,
                    json.dumps(credential.tags),
                ),
            )
            conn.commit()

    def get(self, name: str) -> Credential | None:
        """Get a credential by name."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM credentials WHERE name = ?", (name,))
            row = cursor.fetchone()
            if row:
                return self._row_to_credential(row)
        return None

    def delete(self, name: str) -> bool:
        """Delete a credential."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM credentials WHERE name = ?", (name,))
            conn.commit()
            return cursor.rowcount > 0

    def list(self, tag: str | None = None) -> list[Credential]:
        """List all credentials."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM credentials ORDER BY name")
            credentials = [self._row_to_credential(row) for row in cursor]

        if tag:
            credentials = [c for c in credentials if tag in c.tags]

        return credentials

    def exists(self, name: str) -> bool:
        """Check if a credential exists."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT 1 FROM credentials WHERE name = ?", (name,))
            return cursor.fetchone() is not None

    def _row_to_credential(self, row: sqlite3.Row) -> Credential:
        """Convert database row to Credential."""
        return Credential(
            name=row["name"],
            credential_type=CredentialType(row["credential_type"]),
            value=row["value"],
            description=row["description"] or "",
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            expires_at=datetime.fromisoformat(row["expires_at"]) if row["expires_at"] else None,
            tags=json.loads(row["tags"]) if row["tags"] else [],
        )


class CredentialManager:
    """High-level credential management with encryption.

    This class provides a unified interface for storing and retrieving
    encrypted credentials.
    """

    def __init__(
        self,
        store: CredentialStore,
        encryptor: Encryptor,
    ):
        """Initialize credential manager.

        Args:
            store: Credential storage backend
            encryptor: Encryption backend
        """
        self.store = store
        self.encryptor = encryptor

    def set(
        self,
        name: str,
        value: str,
        credential_type: CredentialType = CredentialType.SECRET,
        description: str = "",
        metadata: dict[str, Any] | None = None,
        expires_at: datetime | None = None,
        tags: list[str] | None = None,
    ) -> Credential:
        """Store an encrypted credential.

        Args:
            name: Unique credential name
            value: The secret value to store
            credential_type: Type of credential
            description: Human-readable description
            metadata: Additional metadata
            expires_at: Optional expiration datetime
            tags: Optional list of tags for filtering

        Returns:
            The stored Credential object (with encrypted value)
        """
        encrypted_value = self.encryptor.encrypt(value)

        credential = Credential(
            name=name,
            credential_type=credential_type,
            value=encrypted_value,
            description=description,
            metadata=metadata or {},
            expires_at=expires_at,
            tags=tags or [],
        )

        self.store.save(credential)
        return credential

    def get(self, name: str, decrypt: bool = True) -> str:
        """Retrieve a credential value.

        Args:
            name: Credential name
            decrypt: Whether to decrypt the value (default True)

        Returns:
            The credential value (decrypted by default)

        Raises:
            CredentialNotFoundError: If credential doesn't exist
        """
        credential = self.store.get(name)
        if not credential:
            raise CredentialNotFoundError(f"Credential '{name}' not found")

        if credential.is_expired():
            raise CredentialNotFoundError(f"Credential '{name}' has expired")

        if decrypt:
            return self.encryptor.decrypt(credential.value)
        return credential.value

    def get_credential(self, name: str) -> Credential | None:
        """Get the full Credential object (value remains encrypted)."""
        return self.store.get(name)

    def delete(self, name: str) -> bool:
        """Delete a credential."""
        return self.store.delete(name)

    def exists(self, name: str) -> bool:
        """Check if a credential exists."""
        return self.store.exists(name)

    def list(self, tag: str | None = None, include_expired: bool = False) -> list[Credential]:
        """List all credentials (values remain encrypted).

        Args:
            tag: Optional tag filter
            include_expired: Whether to include expired credentials
        """
        credentials = self.store.list(tag)
        if not include_expired:
            credentials = [c for c in credentials if not c.is_expired()]
        return credentials

    def rotate(self, name: str, new_value: str) -> Credential:
        """Rotate a credential's value.

        Preserves metadata, description, and tags.
        """
        existing = self.store.get(name)
        if not existing:
            raise CredentialNotFoundError(f"Credential '{name}' not found")

        return self.set(
            name=name,
            value=new_value,
            credential_type=existing.credential_type,
            description=existing.description,
            metadata=existing.metadata,
            expires_at=existing.expires_at,
            tags=existing.tags,
        )

    def export(self, name: str) -> dict[str, Any]:
        """Export credential as dictionary (encrypted)."""
        credential = self.store.get(name)
        if not credential:
            raise CredentialNotFoundError(f"Credential '{name}' not found")
        return credential.to_dict()

    def import_credential(self, data: dict[str, Any]) -> Credential:
        """Import credential from dictionary.

        Note: Assumes the value is already encrypted with compatible key.
        """
        credential = Credential.from_dict(data)
        self.store.save(credential)
        return credential


class KeyManager:
    """Manages encryption keys for credential storage."""

    def __init__(self, key_dir: Path):
        """Initialize key manager.

        Args:
            key_dir: Directory to store key files
        """
        self.key_dir = Path(key_dir)
        self.key_dir.mkdir(parents=True, exist_ok=True)

    def _key_file(self, name: str) -> Path:
        """Get path to key file."""
        return self.key_dir / f"{name}.key"

    def generate_fernet_key(self, name: str = "default") -> str:
        """Generate and store a new Fernet key."""
        encryptor = FernetEncryptor()
        key = encryptor.generate_key()

        key_file = self._key_file(name)
        key_file.write_text(key)
        key_file.chmod(0o600)  # Read/write for owner only

        return key

    def generate_age_identity(self, name: str = "default") -> tuple[str, str]:
        """Generate and store a new age identity.

        Returns:
            Tuple of (identity_content, public_key)
        """
        encryptor = AgeEncryptor()
        identity = encryptor.generate_key()

        identity_file = self.key_dir / f"{name}.age"
        identity_file.write_text(identity)
        identity_file.chmod(0o600)

        public_key = AgeEncryptor.extract_public_key(identity)
        pub_file = self.key_dir / f"{name}.age.pub"
        pub_file.write_text(public_key)

        return identity, public_key

    def get_fernet_key(self, name: str = "default") -> str | None:
        """Get a stored Fernet key."""
        key_file = self._key_file(name)
        if key_file.exists():
            return key_file.read_text().strip()
        return None

    def get_age_identity_file(self, name: str = "default") -> Path | None:
        """Get path to age identity file."""
        identity_file = self.key_dir / f"{name}.age"
        if identity_file.exists():
            return identity_file
        return None

    def get_age_public_key(self, name: str = "default") -> str | None:
        """Get age public key."""
        pub_file = self.key_dir / f"{name}.age.pub"
        if pub_file.exists():
            return pub_file.read_text().strip()
        return None

    def list_keys(self) -> list[dict[str, Any]]:
        """List all stored keys."""
        keys = []

        for key_file in self.key_dir.glob("*.key"):
            keys.append(
                {
                    "name": key_file.stem,
                    "type": "fernet",
                    "file": str(key_file),
                }
            )

        for age_file in self.key_dir.glob("*.age"):
            if not age_file.name.endswith(".age.pub"):
                pub_key = self.get_age_public_key(age_file.stem)
                keys.append(
                    {
                        "name": age_file.stem,
                        "type": "age",
                        "file": str(age_file),
                        "public_key": pub_key,
                    }
                )

        return keys

    def delete_key(self, name: str) -> bool:
        """Delete a key and its associated files."""
        deleted = False

        # Fernet key
        key_file = self._key_file(name)
        if key_file.exists():
            key_file.unlink()
            deleted = True

        # Age identity
        age_file = self.key_dir / f"{name}.age"
        if age_file.exists():
            age_file.unlink()
            deleted = True

        # Age public key
        pub_file = self.key_dir / f"{name}.age.pub"
        if pub_file.exists():
            pub_file.unlink()
            deleted = True

        return deleted


def create_credential_manager(
    state_dir: Path,
    backend: EncryptionBackend = EncryptionBackend.FERNET,
    key_name: str = "default",
    passphrase: str | None = None,
) -> CredentialManager:
    """Create a credential manager with the specified backend.

    This is a convenience function for common setups.

    Args:
        state_dir: Directory for storing credentials and keys
        backend: Encryption backend to use
        key_name: Name of the key to use
        passphrase: Passphrase for age symmetric encryption

    Returns:
        Configured CredentialManager
    """
    state_dir = Path(state_dir)
    key_dir = state_dir / "keys"
    db_path = state_dir / "credentials.db"

    key_manager = KeyManager(key_dir)
    store = SQLiteCredentialStore(db_path)

    if backend == EncryptionBackend.FERNET:
        key = key_manager.get_fernet_key(key_name)
        if not key:
            key = key_manager.generate_fernet_key(key_name)
        encryptor = FernetEncryptor(key=key)

    elif backend == EncryptionBackend.AGE:
        if passphrase:
            encryptor = AgeEncryptor(passphrase=passphrase)
        else:
            identity_file = key_manager.get_age_identity_file(key_name)
            public_key = key_manager.get_age_public_key(key_name)

            if not identity_file or not public_key:
                _, public_key = key_manager.generate_age_identity(key_name)
                identity_file = key_manager.get_age_identity_file(key_name)

            encryptor = AgeEncryptor(
                recipient=public_key,
                identity_file=identity_file,
            )

    elif backend == EncryptionBackend.GPG:
        if passphrase:
            encryptor = GPGEncryptor(passphrase=passphrase, symmetric=True)
        else:
            raise EncryptionError(
                "GPG asymmetric encryption requires recipient configuration. "
                "Use passphrase for symmetric encryption or configure recipient manually."
            )

    else:
        raise ValueError(f"Unknown backend: {backend}")

    return CredentialManager(store=store, encryptor=encryptor)


def get_available_backends() -> list[EncryptionBackend]:
    """Get list of available encryption backends."""
    available = []

    # Fernet is always available if cryptography is installed
    try:
        from cryptography.fernet import Fernet  # noqa: F401

        available.append(EncryptionBackend.FERNET)
    except ImportError:
        pass

    # Check for age
    if shutil.which("age"):
        available.append(EncryptionBackend.AGE)

    # Check for GPG
    if shutil.which("gpg") or shutil.which("gpg2"):
        available.append(EncryptionBackend.GPG)

    return available
