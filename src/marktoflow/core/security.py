"""
Security module for marktoflow.

Provides RBAC (Role-Based Access Control), approval workflows, and audit logging.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable


# =============================================================================
# RBAC - Role-Based Access Control
# =============================================================================


class Permission(Enum):
    """Available permissions in the system."""

    # Workflow permissions
    WORKFLOW_READ = "workflow:read"
    WORKFLOW_EXECUTE = "workflow:execute"
    WORKFLOW_CREATE = "workflow:create"
    WORKFLOW_EDIT = "workflow:edit"
    WORKFLOW_DELETE = "workflow:delete"

    # Tool permissions
    TOOL_USE = "tool:use"
    TOOL_CONFIGURE = "tool:configure"

    # Admin permissions
    USER_MANAGE = "user:manage"
    ROLE_MANAGE = "role:manage"
    CONFIG_MANAGE = "config:manage"
    AUDIT_READ = "audit:read"

    # Approval permissions
    APPROVAL_REQUEST = "approval:request"
    APPROVAL_APPROVE = "approval:approve"
    APPROVAL_REJECT = "approval:reject"


@dataclass
class Role:
    """A role with a set of permissions."""

    name: str
    permissions: set[Permission]
    description: str = ""
    inherits_from: list[str] = field(default_factory=list)

    def has_permission(self, permission: Permission) -> bool:
        """Check if this role has a specific permission."""
        return permission in self.permissions

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "permissions": [p.value for p in self.permissions],
            "description": self.description,
            "inherits_from": self.inherits_from,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Role":
        """Create from dictionary."""
        return cls(
            name=data["name"],
            permissions={Permission(p) for p in data.get("permissions", [])},
            description=data.get("description", ""),
            inherits_from=data.get("inherits_from", []),
        )


@dataclass
class User:
    """A user in the system."""

    id: str
    username: str
    email: str | None = None
    roles: list[str] = field(default_factory=list)
    is_active: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "roles": self.roles,
            "is_active": self.is_active,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            username=data["username"],
            email=data.get("email"),
            roles=data.get("roles", []),
            is_active=data.get("is_active", True),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"])
            if "created_at" in data
            else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"])
            if "updated_at" in data
            else datetime.now(),
        )


# Predefined roles
PREDEFINED_ROLES = {
    "viewer": Role(
        name="viewer",
        permissions={
            Permission.WORKFLOW_READ,
            Permission.AUDIT_READ,
        },
        description="Can view workflows and audit logs",
    ),
    "executor": Role(
        name="executor",
        permissions={
            Permission.WORKFLOW_READ,
            Permission.WORKFLOW_EXECUTE,
            Permission.TOOL_USE,
            Permission.APPROVAL_REQUEST,
        },
        description="Can execute workflows and use tools",
        inherits_from=["viewer"],
    ),
    "developer": Role(
        name="developer",
        permissions={
            Permission.WORKFLOW_READ,
            Permission.WORKFLOW_EXECUTE,
            Permission.WORKFLOW_CREATE,
            Permission.WORKFLOW_EDIT,
            Permission.TOOL_USE,
            Permission.TOOL_CONFIGURE,
            Permission.APPROVAL_REQUEST,
        },
        description="Can create and edit workflows",
        inherits_from=["executor"],
    ),
    "approver": Role(
        name="approver",
        permissions={
            Permission.WORKFLOW_READ,
            Permission.APPROVAL_APPROVE,
            Permission.APPROVAL_REJECT,
            Permission.AUDIT_READ,
        },
        description="Can approve or reject workflow executions",
        inherits_from=["viewer"],
    ),
    "admin": Role(
        name="admin",
        permissions=set(Permission),  # All permissions
        description="Full system access",
    ),
}


class RBACManager:
    """Manages roles and permissions."""

    def __init__(self, roles: dict[str, Role] | None = None):
        """Initialize with optional custom roles."""
        self._roles: dict[str, Role] = dict(PREDEFINED_ROLES)
        if roles:
            self._roles.update(roles)
        self._users: dict[str, User] = {}

    def add_role(self, role: Role) -> None:
        """Add a custom role."""
        self._roles[role.name] = role

    def remove_role(self, name: str) -> bool:
        """Remove a custom role."""
        if name in PREDEFINED_ROLES:
            return False  # Cannot remove predefined roles
        return self._roles.pop(name, None) is not None

    def get_role(self, name: str) -> Role | None:
        """Get a role by name."""
        return self._roles.get(name)

    def list_roles(self) -> list[str]:
        """List all role names."""
        return list(self._roles.keys())

    def add_user(self, user: User) -> None:
        """Add a user."""
        self._users[user.id] = user

    def get_user(self, user_id: str) -> User | None:
        """Get a user by ID."""
        return self._users.get(user_id)

    def get_user_by_username(self, username: str) -> User | None:
        """Get a user by username."""
        for user in self._users.values():
            if user.username == username:
                return user
        return None

    def remove_user(self, user_id: str) -> bool:
        """Remove a user."""
        return self._users.pop(user_id, None) is not None

    def list_users(self) -> list[User]:
        """List all users."""
        return list(self._users.values())

    def assign_role(self, user_id: str, role_name: str) -> bool:
        """Assign a role to a user."""
        user = self.get_user(user_id)
        if not user or role_name not in self._roles:
            return False
        if role_name not in user.roles:
            user.roles.append(role_name)
            user.updated_at = datetime.now()
        return True

    def revoke_role(self, user_id: str, role_name: str) -> bool:
        """Revoke a role from a user."""
        user = self.get_user(user_id)
        if not user or role_name not in user.roles:
            return False
        user.roles.remove(role_name)
        user.updated_at = datetime.now()
        return True

    def get_user_permissions(self, user_id: str) -> set[Permission]:
        """Get all permissions for a user (including inherited)."""
        user = self.get_user(user_id)
        if not user or not user.is_active:
            return set()

        permissions: set[Permission] = set()
        visited_roles: set[str] = set()

        def collect_permissions(role_name: str) -> None:
            if role_name in visited_roles:
                return
            visited_roles.add(role_name)

            role = self.get_role(role_name)
            if role:
                permissions.update(role.permissions)
                for inherited in role.inherits_from:
                    collect_permissions(inherited)

        for role_name in user.roles:
            collect_permissions(role_name)

        return permissions

    def check_permission(self, user_id: str, permission: Permission) -> bool:
        """Check if a user has a specific permission."""
        return permission in self.get_user_permissions(user_id)

    def check_permissions(
        self, user_id: str, permissions: list[Permission]
    ) -> dict[Permission, bool]:
        """Check multiple permissions at once."""
        user_perms = self.get_user_permissions(user_id)
        return {perm: perm in user_perms for perm in permissions}


class PermissionDeniedError(Exception):
    """Raised when a user doesn't have required permission."""

    def __init__(self, user_id: str, permission: Permission, message: str | None = None):
        self.user_id = user_id
        self.permission = permission
        super().__init__(message or f"User {user_id} does not have permission {permission.value}")


def require_permission(rbac: RBACManager, permission: Permission):
    """Decorator to require a permission for a function."""

    def decorator(func: Callable) -> Callable:
        def wrapper(user_id: str, *args, **kwargs):
            if not rbac.check_permission(user_id, permission):
                raise PermissionDeniedError(user_id, permission)
            return func(user_id, *args, **kwargs)

        return wrapper

    return decorator


# =============================================================================
# Approval Workflows
# =============================================================================


class ApprovalStatus(Enum):
    """Status of an approval request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


@dataclass
class ApprovalRequest:
    """A request for approval."""

    id: str
    workflow_id: str
    requester_id: str
    title: str
    description: str = ""
    status: ApprovalStatus = ApprovalStatus.PENDING
    required_approvers: list[str] = field(default_factory=list)
    min_approvals: int = 1
    approvals: list[dict] = field(default_factory=list)
    rejections: list[dict] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: datetime | None = None
    resolved_at: datetime | None = None

    def is_approved(self) -> bool:
        """Check if request has enough approvals."""
        return len(self.approvals) >= self.min_approvals

    def is_rejected(self) -> bool:
        """Check if request has been rejected."""
        return len(self.rejections) > 0

    def is_expired(self) -> bool:
        """Check if request has expired."""
        if self.expires_at and datetime.now() > self.expires_at:
            return True
        return False

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "requester_id": self.requester_id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "required_approvers": self.required_approvers,
            "min_approvals": self.min_approvals,
            "approvals": self.approvals,
            "rejections": self.rejections,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ApprovalRequest":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            workflow_id=data["workflow_id"],
            requester_id=data["requester_id"],
            title=data["title"],
            description=data.get("description", ""),
            status=ApprovalStatus(data.get("status", "pending")),
            required_approvers=data.get("required_approvers", []),
            min_approvals=data.get("min_approvals", 1),
            approvals=data.get("approvals", []),
            rejections=data.get("rejections", []),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"])
            if "created_at" in data
            else datetime.now(),
            expires_at=datetime.fromisoformat(data["expires_at"])
            if data.get("expires_at")
            else None,
            resolved_at=datetime.fromisoformat(data["resolved_at"])
            if data.get("resolved_at")
            else None,
        )


class ApprovalHandler(ABC):
    """Abstract handler for approval notifications."""

    @abstractmethod
    def on_approval_requested(self, request: ApprovalRequest) -> None:
        """Called when approval is requested."""
        pass

    @abstractmethod
    def on_approval_approved(self, request: ApprovalRequest, approver_id: str) -> None:
        """Called when request is approved."""
        pass

    @abstractmethod
    def on_approval_rejected(self, request: ApprovalRequest, rejector_id: str) -> None:
        """Called when request is rejected."""
        pass


class LoggingApprovalHandler(ApprovalHandler):
    """Handler that logs approval events."""

    def on_approval_requested(self, request: ApprovalRequest) -> None:
        print(f"Approval requested: {request.title} by {request.requester_id}")

    def on_approval_approved(self, request: ApprovalRequest, approver_id: str) -> None:
        print(f"Approval granted: {request.title} by {approver_id}")

    def on_approval_rejected(self, request: ApprovalRequest, rejector_id: str) -> None:
        print(f"Approval rejected: {request.title} by {rejector_id}")


class ApprovalManager:
    """Manages approval workflows."""

    def __init__(
        self,
        rbac: RBACManager | None = None,
        handlers: list[ApprovalHandler] | None = None,
    ):
        """Initialize approval manager."""
        self._rbac = rbac
        self._requests: dict[str, ApprovalRequest] = {}
        self._handlers = handlers or []

    def add_handler(self, handler: ApprovalHandler) -> None:
        """Add an approval handler."""
        self._handlers.append(handler)

    def create_request(
        self,
        requester_id: str,
        workflow_id: str,
        title: str,
        description: str = "",
        required_approvers: list[str] | None = None,
        min_approvals: int = 1,
        expires_in_hours: int | None = None,
        metadata: dict | None = None,
    ) -> ApprovalRequest:
        """Create a new approval request."""
        # Check permission if RBAC is enabled
        if self._rbac:
            if not self._rbac.check_permission(requester_id, Permission.APPROVAL_REQUEST):
                raise PermissionDeniedError(requester_id, Permission.APPROVAL_REQUEST)

        request_id = secrets.token_hex(16)
        expires_at = None
        if expires_in_hours:
            from datetime import timedelta

            expires_at = datetime.now() + timedelta(hours=expires_in_hours)

        request = ApprovalRequest(
            id=request_id,
            workflow_id=workflow_id,
            requester_id=requester_id,
            title=title,
            description=description,
            required_approvers=required_approvers or [],
            min_approvals=min_approvals,
            expires_at=expires_at,
            metadata=metadata or {},
        )

        self._requests[request_id] = request

        # Notify handlers
        for handler in self._handlers:
            handler.on_approval_requested(request)

        return request

    def get_request(self, request_id: str) -> ApprovalRequest | None:
        """Get an approval request by ID."""
        request = self._requests.get(request_id)
        if request and request.is_expired() and request.status == ApprovalStatus.PENDING:
            request.status = ApprovalStatus.EXPIRED
        return request

    def list_pending_requests(self, approver_id: str | None = None) -> list[ApprovalRequest]:
        """List pending approval requests."""
        pending = []
        for request in self._requests.values():
            if request.status != ApprovalStatus.PENDING:
                continue
            if request.is_expired():
                request.status = ApprovalStatus.EXPIRED
                continue
            if approver_id:
                # Check if user can approve
                if request.required_approvers and approver_id not in request.required_approvers:
                    continue
            pending.append(request)
        return pending

    def approve(self, request_id: str, approver_id: str, comment: str = "") -> ApprovalRequest:
        """Approve a request."""
        request = self.get_request(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")

        if request.status != ApprovalStatus.PENDING:
            raise ValueError(f"Request is not pending: {request.status.value}")

        # Check permission if RBAC is enabled
        if self._rbac:
            if not self._rbac.check_permission(approver_id, Permission.APPROVAL_APPROVE):
                raise PermissionDeniedError(approver_id, Permission.APPROVAL_APPROVE)

        # Check if approver is in required approvers
        if request.required_approvers and approver_id not in request.required_approvers:
            raise ValueError(f"User {approver_id} is not an authorized approver")

        # Check if already approved by this user
        for approval in request.approvals:
            if approval["approver_id"] == approver_id:
                raise ValueError(f"User {approver_id} has already approved")

        # Add approval
        request.approvals.append(
            {
                "approver_id": approver_id,
                "comment": comment,
                "timestamp": datetime.now().isoformat(),
            }
        )

        # Check if fully approved
        if request.is_approved():
            request.status = ApprovalStatus.APPROVED
            request.resolved_at = datetime.now()

        # Notify handlers
        for handler in self._handlers:
            handler.on_approval_approved(request, approver_id)

        return request

    def reject(self, request_id: str, rejector_id: str, reason: str = "") -> ApprovalRequest:
        """Reject a request."""
        request = self.get_request(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")

        if request.status != ApprovalStatus.PENDING:
            raise ValueError(f"Request is not pending: {request.status.value}")

        # Check permission if RBAC is enabled
        if self._rbac:
            if not self._rbac.check_permission(rejector_id, Permission.APPROVAL_REJECT):
                raise PermissionDeniedError(rejector_id, Permission.APPROVAL_REJECT)

        # Check if rejector is in required approvers (if specified)
        if request.required_approvers and rejector_id not in request.required_approvers:
            raise ValueError(f"User {rejector_id} is not an authorized approver")

        # Add rejection
        request.rejections.append(
            {
                "rejector_id": rejector_id,
                "reason": reason,
                "timestamp": datetime.now().isoformat(),
            }
        )

        request.status = ApprovalStatus.REJECTED
        request.resolved_at = datetime.now()

        # Notify handlers
        for handler in self._handlers:
            handler.on_approval_rejected(request, rejector_id)

        return request

    def cancel(self, request_id: str, user_id: str) -> ApprovalRequest:
        """Cancel an approval request."""
        request = self.get_request(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")

        if request.status != ApprovalStatus.PENDING:
            raise ValueError(f"Request is not pending: {request.status.value}")

        # Only requester or admin can cancel
        if request.requester_id != user_id:
            if self._rbac and not self._rbac.check_permission(user_id, Permission.USER_MANAGE):
                raise ValueError(f"User {user_id} cannot cancel this request")

        request.status = ApprovalStatus.CANCELLED
        request.resolved_at = datetime.now()

        return request


# =============================================================================
# Audit Logging
# =============================================================================


class AuditEventType(Enum):
    """Types of audit events."""

    # Authentication
    LOGIN = "auth.login"
    LOGOUT = "auth.logout"
    LOGIN_FAILED = "auth.login_failed"

    # User management
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    ROLE_ASSIGNED = "user.role_assigned"
    ROLE_REVOKED = "user.role_revoked"

    # Workflow operations
    WORKFLOW_CREATED = "workflow.created"
    WORKFLOW_UPDATED = "workflow.updated"
    WORKFLOW_DELETED = "workflow.deleted"
    WORKFLOW_EXECUTED = "workflow.executed"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_FAILED = "workflow.failed"

    # Tool operations
    TOOL_USED = "tool.used"
    TOOL_CONFIGURED = "tool.configured"

    # Approval operations
    APPROVAL_REQUESTED = "approval.requested"
    APPROVAL_APPROVED = "approval.approved"
    APPROVAL_REJECTED = "approval.rejected"
    APPROVAL_CANCELLED = "approval.cancelled"

    # Configuration
    CONFIG_CHANGED = "config.changed"

    # Security
    PERMISSION_DENIED = "security.permission_denied"
    SUSPICIOUS_ACTIVITY = "security.suspicious_activity"


@dataclass
class AuditEvent:
    """An audit log event."""

    id: str
    event_type: AuditEventType
    user_id: str | None
    resource_type: str | None = None
    resource_id: str | None = None
    action: str = ""
    details: dict[str, Any] = field(default_factory=dict)
    ip_address: str | None = None
    user_agent: str | None = None
    timestamp: datetime = field(default_factory=datetime.now)
    success: bool = True
    error_message: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "event_type": self.event_type.value,
            "user_id": self.user_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "action": self.action,
            "details": self.details,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "timestamp": self.timestamp.isoformat(),
            "success": self.success,
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AuditEvent":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            event_type=AuditEventType(data["event_type"]),
            user_id=data.get("user_id"),
            resource_type=data.get("resource_type"),
            resource_id=data.get("resource_id"),
            action=data.get("action", ""),
            details=data.get("details", {}),
            ip_address=data.get("ip_address"),
            user_agent=data.get("user_agent"),
            timestamp=datetime.fromisoformat(data["timestamp"])
            if "timestamp" in data
            else datetime.now(),
            success=data.get("success", True),
            error_message=data.get("error_message"),
        )


class AuditStore(ABC):
    """Abstract base class for audit log storage."""

    @abstractmethod
    def save(self, event: AuditEvent) -> None:
        """Save an audit event."""
        pass

    @abstractmethod
    def query(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Query audit events."""
        pass

    @abstractmethod
    def count(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        """Count audit events matching criteria."""
        pass


class InMemoryAuditStore(AuditStore):
    """In-memory audit store for testing."""

    def __init__(self):
        self._events: list[AuditEvent] = []

    def save(self, event: AuditEvent) -> None:
        """Save an audit event."""
        self._events.append(event)

    def query(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Query audit events."""
        results = []
        for event in self._events:
            if event_type and event.event_type != event_type:
                continue
            if user_id and event.user_id != user_id:
                continue
            if resource_type and event.resource_type != resource_type:
                continue
            if resource_id and event.resource_id != resource_id:
                continue
            if start_time and event.timestamp < start_time:
                continue
            if end_time and event.timestamp > end_time:
                continue
            results.append(event)

        # Sort by timestamp descending
        results.sort(key=lambda e: e.timestamp, reverse=True)

        return results[offset : offset + limit]

    def count(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        """Count audit events matching criteria."""
        count = 0
        for event in self._events:
            if event_type and event.event_type != event_type:
                continue
            if user_id and event.user_id != user_id:
                continue
            if start_time and event.timestamp < start_time:
                continue
            if end_time and event.timestamp > end_time:
                continue
            count += 1
        return count


class SQLiteAuditStore(AuditStore):
    """SQLite-based audit store for persistent storage."""

    def __init__(self, db_path: Path | str = ".marktoflow/state/audit.db"):
        """Initialize with database path."""
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        """Initialize database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    user_id TEXT,
                    resource_type TEXT,
                    resource_id TEXT,
                    action TEXT,
                    details TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    timestamp TEXT NOT NULL,
                    success INTEGER DEFAULT 1,
                    error_message TEXT
                )
            """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_event_type ON audit_events(event_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON audit_events(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_events(timestamp)")
            conn.commit()

    def save(self, event: AuditEvent) -> None:
        """Save an audit event."""
        import json

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO audit_events 
                (id, event_type, user_id, resource_type, resource_id, action, 
                 details, ip_address, user_agent, timestamp, success, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    event.id,
                    event.event_type.value,
                    event.user_id,
                    event.resource_type,
                    event.resource_id,
                    event.action,
                    json.dumps(event.details),
                    event.ip_address,
                    event.user_agent,
                    event.timestamp.isoformat(),
                    1 if event.success else 0,
                    event.error_message,
                ),
            )
            conn.commit()

    def query(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Query audit events."""
        import json

        conditions = []
        params = []

        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type.value)
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        if resource_type:
            conditions.append("resource_type = ?")
            params.append(resource_type)
        if resource_id:
            conditions.append("resource_id = ?")
            params.append(resource_id)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time.isoformat())

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        params.extend([limit, offset])

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                f"""
                SELECT * FROM audit_events
                WHERE {where_clause}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """,
                params,
            )

            events = []
            for row in cursor.fetchall():
                events.append(
                    AuditEvent(
                        id=row["id"],
                        event_type=AuditEventType(row["event_type"]),
                        user_id=row["user_id"],
                        resource_type=row["resource_type"],
                        resource_id=row["resource_id"],
                        action=row["action"],
                        details=json.loads(row["details"]) if row["details"] else {},
                        ip_address=row["ip_address"],
                        user_agent=row["user_agent"],
                        timestamp=datetime.fromisoformat(row["timestamp"]),
                        success=bool(row["success"]),
                        error_message=row["error_message"],
                    )
                )
            return events

    def count(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        """Count audit events matching criteria."""
        conditions = []
        params = []

        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type.value)
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time.isoformat())

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                f"SELECT COUNT(*) FROM audit_events WHERE {where_clause}",
                params,
            )
            return cursor.fetchone()[0]


class AuditLogger:
    """High-level interface for audit logging."""

    def __init__(self, store: AuditStore | None = None):
        """Initialize with optional store."""
        self._store = store or InMemoryAuditStore()

    def log(
        self,
        event_type: AuditEventType,
        user_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        action: str = "",
        details: dict | None = None,
        success: bool = True,
        error_message: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditEvent:
        """Log an audit event."""
        event = AuditEvent(
            id=secrets.token_hex(16),
            event_type=event_type,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            details=details or {},
            success=success,
            error_message=error_message,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self._store.save(event)
        return event

    def log_workflow_execution(
        self,
        user_id: str,
        workflow_id: str,
        run_id: str,
        inputs: dict | None = None,
    ) -> AuditEvent:
        """Log workflow execution start."""
        return self.log(
            event_type=AuditEventType.WORKFLOW_EXECUTED,
            user_id=user_id,
            resource_type="workflow",
            resource_id=workflow_id,
            action="execute",
            details={"run_id": run_id, "inputs": inputs or {}},
        )

    def log_workflow_completed(
        self,
        user_id: str,
        workflow_id: str,
        run_id: str,
        duration_seconds: float,
        steps_succeeded: int,
        steps_total: int,
    ) -> AuditEvent:
        """Log workflow completion."""
        return self.log(
            event_type=AuditEventType.WORKFLOW_COMPLETED,
            user_id=user_id,
            resource_type="workflow",
            resource_id=workflow_id,
            action="complete",
            details={
                "run_id": run_id,
                "duration_seconds": duration_seconds,
                "steps_succeeded": steps_succeeded,
                "steps_total": steps_total,
            },
        )

    def log_workflow_failed(
        self,
        user_id: str,
        workflow_id: str,
        run_id: str,
        error: str,
    ) -> AuditEvent:
        """Log workflow failure."""
        return self.log(
            event_type=AuditEventType.WORKFLOW_FAILED,
            user_id=user_id,
            resource_type="workflow",
            resource_id=workflow_id,
            action="fail",
            success=False,
            error_message=error,
            details={"run_id": run_id},
        )

    def log_permission_denied(
        self,
        user_id: str,
        permission: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> AuditEvent:
        """Log permission denied event."""
        return self.log(
            event_type=AuditEventType.PERMISSION_DENIED,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            action="access_denied",
            success=False,
            error_message=f"Permission denied: {permission}",
            details={"permission": permission},
        )

    def query(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Query audit events."""
        return self._store.query(
            event_type=event_type,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            offset=offset,
        )

    def count(
        self,
        event_type: AuditEventType | None = None,
        user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        """Count audit events."""
        return self._store.count(
            event_type=event_type,
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
        )
