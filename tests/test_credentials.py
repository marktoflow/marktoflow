"""Tests for credential encryption and management."""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from marktoflow.core.credentials import (
    AgeEncryptor,
    Credential,
    CredentialManager,
    CredentialNotFoundError,
    CredentialStore,
    CredentialType,
    EncryptionBackend,
    EncryptionError,
    Encryptor,
    FernetEncryptor,
    GPGEncryptor,
    InMemoryCredentialStore,
    KeyManager,
    KeyNotFoundError,
    SQLiteCredentialStore,
    create_credential_manager,
    get_available_backends,
)


# =============================================================================
# CredentialType Tests
# =============================================================================


class TestCredentialType:
    """Tests for CredentialType enum."""

    def test_all_types_exist(self):
        """All expected credential types should exist."""
        assert CredentialType.API_KEY == "api_key"
        assert CredentialType.TOKEN == "token"
        assert CredentialType.PASSWORD == "password"
        assert CredentialType.CERTIFICATE == "certificate"
        assert CredentialType.SSH_KEY == "ssh_key"
        assert CredentialType.SECRET == "secret"
        assert CredentialType.OAUTH_TOKEN == "oauth_token"
        assert CredentialType.CUSTOM == "custom"

    def test_credential_type_count(self):
        """Should have 8 credential types."""
        assert len(CredentialType) == 8


# =============================================================================
# EncryptionBackend Tests
# =============================================================================


class TestEncryptionBackend:
    """Tests for EncryptionBackend enum."""

    def test_all_backends_exist(self):
        """All expected backends should exist."""
        assert EncryptionBackend.AGE == "age"
        assert EncryptionBackend.GPG == "gpg"
        assert EncryptionBackend.FERNET == "fernet"

    def test_backend_count(self):
        """Should have 3 backends."""
        assert len(EncryptionBackend) == 3


# =============================================================================
# Credential Tests
# =============================================================================


class TestCredential:
    """Tests for Credential dataclass."""

    def test_create_credential(self):
        """Create a basic credential."""
        cred = Credential(
            name="api-key",
            credential_type=CredentialType.API_KEY,
            value="secret123",
        )
        assert cred.name == "api-key"
        assert cred.credential_type == CredentialType.API_KEY
        assert cred.value == "secret123"
        assert cred.description == ""
        assert cred.metadata == {}
        assert cred.tags == []
        assert cred.expires_at is None

    def test_create_credential_with_metadata(self):
        """Create credential with all fields."""
        expires = datetime.now() + timedelta(days=30)
        cred = Credential(
            name="oauth-token",
            credential_type=CredentialType.OAUTH_TOKEN,
            value="token_value",
            description="GitHub OAuth token",
            metadata={"scope": "repo,user"},
            expires_at=expires,
            tags=["github", "oauth"],
        )
        assert cred.description == "GitHub OAuth token"
        assert cred.metadata["scope"] == "repo,user"
        assert cred.expires_at == expires
        assert "github" in cred.tags

    def test_credential_not_expired(self):
        """Credential without expiration should not be expired."""
        cred = Credential(
            name="test",
            credential_type=CredentialType.SECRET,
            value="value",
        )
        assert not cred.is_expired()

    def test_credential_expired(self):
        """Expired credential should return True."""
        cred = Credential(
            name="test",
            credential_type=CredentialType.SECRET,
            value="value",
            expires_at=datetime.now() - timedelta(hours=1),
        )
        assert cred.is_expired()

    def test_credential_not_yet_expired(self):
        """Future expiration should not be expired."""
        cred = Credential(
            name="test",
            credential_type=CredentialType.SECRET,
            value="value",
            expires_at=datetime.now() + timedelta(days=1),
        )
        assert not cred.is_expired()

    def test_credential_to_dict(self):
        """Serialize credential to dictionary."""
        cred = Credential(
            name="test",
            credential_type=CredentialType.API_KEY,
            value="secret",
            description="Test key",
            tags=["test"],
        )
        data = cred.to_dict()
        assert data["name"] == "test"
        assert data["credential_type"] == "api_key"
        assert data["value"] == "secret"
        assert data["description"] == "Test key"
        assert data["tags"] == ["test"]
        assert "created_at" in data
        assert "updated_at" in data

    def test_credential_from_dict(self):
        """Deserialize credential from dictionary."""
        data = {
            "name": "test",
            "credential_type": "password",
            "value": "secret123",
            "description": "Test password",
            "metadata": {"user": "admin"},
            "created_at": "2026-01-22T10:00:00",
            "updated_at": "2026-01-22T10:00:00",
            "expires_at": None,
            "tags": ["admin"],
        }
        cred = Credential.from_dict(data)
        assert cred.name == "test"
        assert cred.credential_type == CredentialType.PASSWORD
        assert cred.value == "secret123"
        assert cred.metadata["user"] == "admin"
        assert "admin" in cred.tags


# =============================================================================
# FernetEncryptor Tests
# =============================================================================


class TestFernetEncryptor:
    """Tests for FernetEncryptor."""

    def test_fernet_available(self):
        """Fernet should be available if cryptography is installed."""
        encryptor = FernetEncryptor()
        # This will be True if cryptography is installed
        available = encryptor.is_available()
        assert isinstance(available, bool)

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_generate_key(self):
        """Generate a valid Fernet key."""
        encryptor = FernetEncryptor()
        key = encryptor.generate_key()
        assert key is not None
        assert len(key) > 0

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_encrypt_decrypt(self):
        """Encrypt and decrypt a message."""
        encryptor = FernetEncryptor()
        key = encryptor.generate_key()
        encryptor.set_key(key)

        plaintext = "my secret message"
        ciphertext = encryptor.encrypt(plaintext)

        assert ciphertext != plaintext
        assert encryptor.decrypt(ciphertext) == plaintext

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_encrypt_decrypt_unicode(self):
        """Encrypt and decrypt unicode content."""
        encryptor = FernetEncryptor()
        key = encryptor.generate_key()
        encryptor.set_key(key)

        plaintext = "Hello 世界 🔐 émojis"
        ciphertext = encryptor.encrypt(plaintext)
        assert encryptor.decrypt(ciphertext) == plaintext

    def test_encrypt_without_key_raises(self):
        """Encrypting without key should raise error."""
        encryptor = FernetEncryptor()
        if not encryptor.is_available():
            pytest.skip("cryptography not installed")

        with pytest.raises(KeyNotFoundError):
            encryptor.encrypt("test")

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_decrypt_invalid_ciphertext(self):
        """Decrypting invalid data should raise error."""
        encryptor = FernetEncryptor()
        key = encryptor.generate_key()
        encryptor.set_key(key)

        with pytest.raises(EncryptionError):
            encryptor.decrypt("not-valid-ciphertext")


# =============================================================================
# AgeEncryptor Tests
# =============================================================================


class TestAgeEncryptor:
    """Tests for AgeEncryptor."""

    def test_age_availability_check(self):
        """Check if age is available."""
        encryptor = AgeEncryptor()
        available = encryptor.is_available()
        assert isinstance(available, bool)

    def test_age_init_with_recipient(self):
        """Initialize with recipient."""
        encryptor = AgeEncryptor(recipient="age1abc123")
        assert encryptor.recipient == "age1abc123"

    def test_age_init_with_passphrase(self):
        """Initialize with passphrase."""
        encryptor = AgeEncryptor(passphrase="secret")
        assert encryptor.passphrase == "secret"

    @pytest.mark.skipif(
        not AgeEncryptor().is_available(),
        reason="age not installed",
    )
    def test_generate_key(self):
        """Generate age key pair."""
        encryptor = AgeEncryptor()
        identity = encryptor.generate_key()
        assert "AGE-SECRET-KEY" in identity
        assert "public key:" in identity

    @pytest.mark.skipif(
        not AgeEncryptor().is_available(),
        reason="age not installed",
    )
    def test_extract_public_key(self):
        """Extract public key from identity."""
        encryptor = AgeEncryptor()
        identity = encryptor.generate_key()
        public_key = AgeEncryptor.extract_public_key(identity)
        assert public_key.startswith("age1")


# =============================================================================
# GPGEncryptor Tests
# =============================================================================


class TestGPGEncryptor:
    """Tests for GPGEncryptor."""

    def test_gpg_availability_check(self):
        """Check if GPG is available."""
        encryptor = GPGEncryptor()
        available = encryptor.is_available()
        assert isinstance(available, bool)

    def test_gpg_init_symmetric(self):
        """Initialize for symmetric encryption."""
        encryptor = GPGEncryptor(passphrase="secret", symmetric=True)
        assert encryptor.passphrase == "secret"
        assert encryptor.symmetric is True

    def test_gpg_init_asymmetric(self):
        """Initialize for asymmetric encryption."""
        encryptor = GPGEncryptor(recipient="user@example.com")
        assert encryptor.recipient == "user@example.com"
        assert encryptor.symmetric is False

    def test_generate_key_returns_batch_params(self):
        """Generate key should return batch parameters."""
        encryptor = GPGEncryptor()
        params = encryptor.generate_key()
        assert "Key-Type:" in params
        assert "Key-Length:" in params


# =============================================================================
# InMemoryCredentialStore Tests
# =============================================================================


class TestInMemoryCredentialStore:
    """Tests for InMemoryCredentialStore."""

    def test_save_and_get(self):
        """Save and retrieve a credential."""
        store = InMemoryCredentialStore()
        cred = Credential(
            name="test",
            credential_type=CredentialType.SECRET,
            value="value",
        )
        store.save(cred)

        retrieved = store.get("test")
        assert retrieved is not None
        assert retrieved.name == "test"
        assert retrieved.value == "value"

    def test_get_nonexistent(self):
        """Get nonexistent credential returns None."""
        store = InMemoryCredentialStore()
        assert store.get("nonexistent") is None

    def test_exists(self):
        """Check if credential exists."""
        store = InMemoryCredentialStore()
        cred = Credential(
            name="test",
            credential_type=CredentialType.SECRET,
            value="value",
        )
        store.save(cred)

        assert store.exists("test")
        assert not store.exists("other")

    def test_delete(self):
        """Delete a credential."""
        store = InMemoryCredentialStore()
        cred = Credential(
            name="test",
            credential_type=CredentialType.SECRET,
            value="value",
        )
        store.save(cred)

        assert store.delete("test")
        assert not store.exists("test")
        assert not store.delete("test")  # Already deleted

    def test_list_all(self):
        """List all credentials."""
        store = InMemoryCredentialStore()
        store.save(Credential("a", CredentialType.SECRET, "1"))
        store.save(Credential("b", CredentialType.API_KEY, "2"))

        credentials = store.list()
        assert len(credentials) == 2
        names = [c.name for c in credentials]
        assert "a" in names
        assert "b" in names

    def test_list_by_tag(self):
        """List credentials filtered by tag."""
        store = InMemoryCredentialStore()
        store.save(Credential("a", CredentialType.SECRET, "1", tags=["prod"]))
        store.save(Credential("b", CredentialType.API_KEY, "2", tags=["dev"]))
        store.save(Credential("c", CredentialType.TOKEN, "3", tags=["prod", "api"]))

        prod_creds = store.list(tag="prod")
        assert len(prod_creds) == 2
        names = [c.name for c in prod_creds]
        assert "a" in names
        assert "c" in names


# =============================================================================
# SQLiteCredentialStore Tests
# =============================================================================


class TestSQLiteCredentialStore:
    """Tests for SQLiteCredentialStore."""

    def test_save_and_get(self):
        """Save and retrieve a credential."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "creds.db"
            store = SQLiteCredentialStore(db_path)

            cred = Credential(
                name="test",
                credential_type=CredentialType.API_KEY,
                value="secret",
                description="Test API key",
                metadata={"env": "prod"},
                tags=["api"],
            )
            store.save(cred)

            retrieved = store.get("test")
            assert retrieved is not None
            assert retrieved.name == "test"
            assert retrieved.credential_type == CredentialType.API_KEY
            assert retrieved.value == "secret"
            assert retrieved.description == "Test API key"
            assert retrieved.metadata["env"] == "prod"
            assert "api" in retrieved.tags

    def test_get_nonexistent(self):
        """Get nonexistent credential returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "creds.db"
            store = SQLiteCredentialStore(db_path)
            assert store.get("nonexistent") is None

    def test_update_credential(self):
        """Update an existing credential."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "creds.db"
            store = SQLiteCredentialStore(db_path)

            cred = Credential("test", CredentialType.SECRET, "old_value")
            store.save(cred)

            cred.value = "new_value"
            store.save(cred)

            retrieved = store.get("test")
            assert retrieved is not None
            assert retrieved.value == "new_value"

    def test_delete(self):
        """Delete a credential."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "creds.db"
            store = SQLiteCredentialStore(db_path)

            store.save(Credential("test", CredentialType.SECRET, "value"))
            assert store.exists("test")

            assert store.delete("test")
            assert not store.exists("test")

    def test_list(self):
        """List all credentials."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "creds.db"
            store = SQLiteCredentialStore(db_path)

            store.save(Credential("a", CredentialType.SECRET, "1"))
            store.save(Credential("b", CredentialType.API_KEY, "2"))

            credentials = store.list()
            assert len(credentials) == 2

    def test_persistence(self):
        """Credentials should persist across store instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "creds.db"

            # Save with first instance
            store1 = SQLiteCredentialStore(db_path)
            store1.save(Credential("test", CredentialType.SECRET, "value"))

            # Load with second instance
            store2 = SQLiteCredentialStore(db_path)
            retrieved = store2.get("test")
            assert retrieved is not None
            assert retrieved.value == "value"


# =============================================================================
# CredentialManager Tests
# =============================================================================


class TestCredentialManager:
    """Tests for CredentialManager."""

    @pytest.fixture
    def manager(self):
        """Create a credential manager with mock encryptor."""
        store = InMemoryCredentialStore()
        encryptor = MagicMock(spec=Encryptor)
        encryptor.encrypt.side_effect = lambda x: f"encrypted:{x}"
        encryptor.decrypt.side_effect = lambda x: x.replace("encrypted:", "")
        return CredentialManager(store=store, encryptor=encryptor)

    def test_set_credential(self, manager):
        """Set a new credential."""
        cred = manager.set(
            name="api-key",
            value="secret123",
            credential_type=CredentialType.API_KEY,
            description="Test API key",
        )
        assert cred.name == "api-key"
        assert cred.value == "encrypted:secret123"

    def test_get_credential_decrypted(self, manager):
        """Get credential value decrypted."""
        manager.set("test", "secret")
        value = manager.get("test")
        assert value == "secret"

    def test_get_credential_encrypted(self, manager):
        """Get credential value without decryption."""
        manager.set("test", "secret")
        value = manager.get("test", decrypt=False)
        assert value == "encrypted:secret"

    def test_get_nonexistent_raises(self, manager):
        """Get nonexistent credential raises error."""
        with pytest.raises(CredentialNotFoundError):
            manager.get("nonexistent")

    def test_get_expired_raises(self, manager):
        """Get expired credential raises error."""
        manager.set(
            name="test",
            value="secret",
            expires_at=datetime.now() - timedelta(hours=1),
        )
        with pytest.raises(CredentialNotFoundError):
            manager.get("test")

    def test_get_credential_object(self, manager):
        """Get full credential object."""
        manager.set("test", "secret", description="Test credential")
        cred = manager.get_credential("test")
        assert cred is not None
        assert cred.name == "test"
        assert cred.description == "Test credential"

    def test_delete(self, manager):
        """Delete a credential."""
        manager.set("test", "secret")
        assert manager.exists("test")
        assert manager.delete("test")
        assert not manager.exists("test")

    def test_list(self, manager):
        """List credentials."""
        manager.set("a", "1")
        manager.set("b", "2")
        credentials = manager.list()
        assert len(credentials) == 2

    def test_list_excludes_expired(self, manager):
        """List excludes expired credentials by default."""
        manager.set("valid", "1")
        manager.set(
            "expired",
            "2",
            expires_at=datetime.now() - timedelta(hours=1),
        )
        credentials = manager.list()
        assert len(credentials) == 1
        assert credentials[0].name == "valid"

    def test_list_includes_expired(self, manager):
        """List can include expired credentials."""
        manager.set("valid", "1")
        manager.set(
            "expired",
            "2",
            expires_at=datetime.now() - timedelta(hours=1),
        )
        credentials = manager.list(include_expired=True)
        assert len(credentials) == 2

    def test_rotate(self, manager):
        """Rotate credential value."""
        manager.set(
            "test",
            "old_value",
            description="Test",
            tags=["prod"],
        )
        manager.rotate("test", "new_value")

        value = manager.get("test")
        assert value == "new_value"

        cred = manager.get_credential("test")
        assert cred is not None
        assert cred.description == "Test"
        assert "prod" in cred.tags

    def test_rotate_nonexistent_raises(self, manager):
        """Rotate nonexistent credential raises error."""
        with pytest.raises(CredentialNotFoundError):
            manager.rotate("nonexistent", "value")

    def test_export(self, manager):
        """Export credential as dictionary."""
        manager.set("test", "secret", description="Test")
        data = manager.export("test")
        assert data["name"] == "test"
        assert data["value"] == "encrypted:secret"
        assert data["description"] == "Test"

    def test_import_credential(self, manager):
        """Import credential from dictionary."""
        data = {
            "name": "imported",
            "credential_type": "api_key",
            "value": "encrypted:secret",
            "description": "Imported credential",
            "metadata": {},
            "created_at": "2026-01-22T10:00:00",
            "updated_at": "2026-01-22T10:00:00",
            "expires_at": None,
            "tags": [],
        }
        cred = manager.import_credential(data)
        assert cred.name == "imported"
        assert manager.exists("imported")


# =============================================================================
# KeyManager Tests
# =============================================================================


class TestKeyManager:
    """Tests for KeyManager."""

    def test_list_keys_empty(self):
        """List keys in empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            key_manager = KeyManager(Path(tmpdir))
            keys = key_manager.list_keys()
            assert keys == []

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_generate_fernet_key(self):
        """Generate and store Fernet key."""
        with tempfile.TemporaryDirectory() as tmpdir:
            key_manager = KeyManager(Path(tmpdir))
            key = key_manager.generate_fernet_key("test")

            assert key is not None
            assert len(key) > 0

            # Key should be retrievable
            stored_key = key_manager.get_fernet_key("test")
            assert stored_key == key

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_list_fernet_keys(self):
        """List Fernet keys."""
        with tempfile.TemporaryDirectory() as tmpdir:
            key_manager = KeyManager(Path(tmpdir))
            key_manager.generate_fernet_key("key1")
            key_manager.generate_fernet_key("key2")

            keys = key_manager.list_keys()
            assert len(keys) == 2
            names = [k["name"] for k in keys]
            assert "key1" in names
            assert "key2" in names

    @pytest.mark.skipif(
        not AgeEncryptor().is_available(),
        reason="age not installed",
    )
    def test_generate_age_identity(self):
        """Generate and store age identity."""
        with tempfile.TemporaryDirectory() as tmpdir:
            key_manager = KeyManager(Path(tmpdir))
            identity, public_key = key_manager.generate_age_identity("test")

            assert "AGE-SECRET-KEY" in identity
            assert public_key.startswith("age1")

            # Should be retrievable
            stored_pub = key_manager.get_age_public_key("test")
            assert stored_pub == public_key

            identity_file = key_manager.get_age_identity_file("test")
            assert identity_file is not None
            assert identity_file.exists()

    def test_delete_key(self):
        """Delete a key."""
        with tempfile.TemporaryDirectory() as tmpdir:
            key_manager = KeyManager(Path(tmpdir))

            # Create a key file manually
            key_file = Path(tmpdir) / "test.key"
            key_file.write_text("test-key")

            assert key_manager.delete_key("test")
            assert not key_file.exists()
            assert not key_manager.delete_key("test")  # Already deleted


# =============================================================================
# Convenience Function Tests
# =============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_get_available_backends(self):
        """Get list of available backends."""
        backends = get_available_backends()
        assert isinstance(backends, list)
        # At minimum, we should be able to detect what's available
        for backend in backends:
            assert isinstance(backend, EncryptionBackend)

    @pytest.mark.skipif(
        not FernetEncryptor().is_available(),
        reason="cryptography not installed",
    )
    def test_create_credential_manager_fernet(self):
        """Create manager with Fernet backend."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = create_credential_manager(
                state_dir=Path(tmpdir),
                backend=EncryptionBackend.FERNET,
            )
            assert manager is not None
            assert isinstance(manager, CredentialManager)

            # Test basic operations
            manager.set("test", "secret")
            value = manager.get("test")
            assert value == "secret"

    def test_create_credential_manager_invalid_backend(self):
        """Create manager with invalid backend raises error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with pytest.raises(ValueError):
                create_credential_manager(
                    state_dir=Path(tmpdir),
                    backend="invalid",  # type: ignore
                )
