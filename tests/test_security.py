"""
Tests for the security module (RBAC, Approvals, Audit).
"""

import pytest
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from marktoflow.core.security import (
    # RBAC
    Permission,
    Role,
    User,
    RBACManager,
    PermissionDeniedError,
    PREDEFINED_ROLES,
    require_permission,
    # Approval workflows
    ApprovalStatus,
    ApprovalRequest,
    ApprovalManager,
    ApprovalHandler,
    LoggingApprovalHandler,
    # Audit logging
    AuditEventType,
    AuditEvent,
    AuditStore,
    InMemoryAuditStore,
    SQLiteAuditStore,
    AuditLogger,
)


# =============================================================================
# RBAC Tests
# =============================================================================


class TestPermission:
    """Tests for Permission enum."""

    def test_permission_values(self):
        """Test permission enum values."""
        assert Permission.WORKFLOW_READ.value == "workflow:read"
        assert Permission.WORKFLOW_EXECUTE.value == "workflow:execute"
        assert Permission.USER_MANAGE.value == "user:manage"
        assert Permission.AUDIT_READ.value == "audit:read"

    def test_all_permissions_exist(self):
        """Test that expected permissions exist."""
        expected = [
            "WORKFLOW_READ",
            "WORKFLOW_EXECUTE",
            "WORKFLOW_CREATE",
            "WORKFLOW_EDIT",
            "WORKFLOW_DELETE",
            "TOOL_USE",
            "TOOL_CONFIGURE",
            "USER_MANAGE",
            "ROLE_MANAGE",
            "CONFIG_MANAGE",
            "AUDIT_READ",
            "APPROVAL_REQUEST",
            "APPROVAL_APPROVE",
            "APPROVAL_REJECT",
        ]
        for perm in expected:
            assert hasattr(Permission, perm)


class TestRole:
    """Tests for Role class."""

    def test_create_role(self):
        """Test creating a role."""
        role = Role(
            name="test-role",
            permissions={Permission.WORKFLOW_READ, Permission.WORKFLOW_EXECUTE},
            description="A test role",
        )
        assert role.name == "test-role"
        assert len(role.permissions) == 2
        assert role.has_permission(Permission.WORKFLOW_READ)
        assert not role.has_permission(Permission.USER_MANAGE)

    def test_role_to_dict(self):
        """Test role serialization."""
        role = Role(
            name="test",
            permissions={Permission.WORKFLOW_READ},
            description="Test",
            inherits_from=["viewer"],
        )
        data = role.to_dict()
        assert data["name"] == "test"
        assert "workflow:read" in data["permissions"]
        assert data["inherits_from"] == ["viewer"]

    def test_role_from_dict(self):
        """Test role deserialization."""
        data = {
            "name": "test",
            "permissions": ["workflow:read", "workflow:execute"],
            "description": "Test role",
        }
        role = Role.from_dict(data)
        assert role.name == "test"
        assert role.has_permission(Permission.WORKFLOW_READ)
        assert role.has_permission(Permission.WORKFLOW_EXECUTE)


class TestUser:
    """Tests for User class."""

    def test_create_user(self):
        """Test creating a user."""
        user = User(
            id="user-1",
            username="testuser",
            email="test@example.com",
            roles=["developer"],
        )
        assert user.id == "user-1"
        assert user.username == "testuser"
        assert user.is_active

    def test_user_to_dict(self):
        """Test user serialization."""
        user = User(id="1", username="test", roles=["admin"])
        data = user.to_dict()
        assert data["id"] == "1"
        assert data["roles"] == ["admin"]
        assert "created_at" in data

    def test_user_from_dict(self):
        """Test user deserialization."""
        data = {
            "id": "1",
            "username": "test",
            "email": "test@example.com",
            "roles": ["admin"],
            "is_active": True,
            "created_at": "2026-01-01T00:00:00",
        }
        user = User.from_dict(data)
        assert user.id == "1"
        assert user.username == "test"
        assert "admin" in user.roles


class TestPredefinedRoles:
    """Tests for predefined roles."""

    def test_viewer_role(self):
        """Test viewer role permissions."""
        role = PREDEFINED_ROLES["viewer"]
        assert role.has_permission(Permission.WORKFLOW_READ)
        assert role.has_permission(Permission.AUDIT_READ)
        assert not role.has_permission(Permission.WORKFLOW_EXECUTE)

    def test_executor_role(self):
        """Test executor role permissions."""
        role = PREDEFINED_ROLES["executor"]
        assert role.has_permission(Permission.WORKFLOW_EXECUTE)
        assert role.has_permission(Permission.TOOL_USE)

    def test_developer_role(self):
        """Test developer role permissions."""
        role = PREDEFINED_ROLES["developer"]
        assert role.has_permission(Permission.WORKFLOW_CREATE)
        assert role.has_permission(Permission.WORKFLOW_EDIT)
        assert role.has_permission(Permission.TOOL_CONFIGURE)

    def test_admin_role(self):
        """Test admin role has all permissions."""
        role = PREDEFINED_ROLES["admin"]
        for perm in Permission:
            assert role.has_permission(perm)


class TestRBACManager:
    """Tests for RBACManager."""

    def test_create_manager(self):
        """Test creating an RBAC manager."""
        rbac = RBACManager()
        assert "admin" in rbac.list_roles()
        assert "viewer" in rbac.list_roles()

    def test_add_user(self):
        """Test adding a user."""
        rbac = RBACManager()
        user = User(id="1", username="test")
        rbac.add_user(user)
        assert rbac.get_user("1") is not None

    def test_assign_role(self):
        """Test assigning a role to a user."""
        rbac = RBACManager()
        user = User(id="1", username="test")
        rbac.add_user(user)
        assert rbac.assign_role("1", "developer")
        assert "developer" in rbac.get_user("1").roles

    def test_revoke_role(self):
        """Test revoking a role from a user."""
        rbac = RBACManager()
        user = User(id="1", username="test", roles=["developer"])
        rbac.add_user(user)
        assert rbac.revoke_role("1", "developer")
        assert "developer" not in rbac.get_user("1").roles

    def test_get_user_permissions(self):
        """Test getting user permissions."""
        rbac = RBACManager()
        user = User(id="1", username="test", roles=["developer"])
        rbac.add_user(user)
        perms = rbac.get_user_permissions("1")
        assert Permission.WORKFLOW_CREATE in perms
        assert Permission.TOOL_USE in perms

    def test_check_permission(self):
        """Test checking permissions."""
        rbac = RBACManager()
        user = User(id="1", username="test", roles=["viewer"])
        rbac.add_user(user)
        assert rbac.check_permission("1", Permission.WORKFLOW_READ)
        assert not rbac.check_permission("1", Permission.WORKFLOW_EXECUTE)

    def test_inherited_permissions(self):
        """Test role inheritance."""
        rbac = RBACManager()
        user = User(id="1", username="test", roles=["executor"])
        rbac.add_user(user)
        perms = rbac.get_user_permissions("1")
        # Executor inherits from viewer
        assert Permission.WORKFLOW_READ in perms
        assert Permission.AUDIT_READ in perms

    def test_add_custom_role(self):
        """Test adding a custom role."""
        rbac = RBACManager()
        custom = Role(
            name="custom",
            permissions={Permission.WORKFLOW_READ},
        )
        rbac.add_role(custom)
        assert "custom" in rbac.list_roles()

    def test_inactive_user_no_permissions(self):
        """Test that inactive users have no permissions."""
        rbac = RBACManager()
        user = User(id="1", username="test", roles=["admin"], is_active=False)
        rbac.add_user(user)
        perms = rbac.get_user_permissions("1")
        assert len(perms) == 0


class TestPermissionDeniedError:
    """Tests for PermissionDeniedError."""

    def test_error_message(self):
        """Test error message."""
        error = PermissionDeniedError("user-1", Permission.WORKFLOW_EXECUTE)
        assert "user-1" in str(error)
        assert "workflow:execute" in str(error)


# =============================================================================
# Approval Workflow Tests
# =============================================================================


class TestApprovalStatus:
    """Tests for ApprovalStatus enum."""

    def test_status_values(self):
        """Test status enum values."""
        assert ApprovalStatus.PENDING.value == "pending"
        assert ApprovalStatus.APPROVED.value == "approved"
        assert ApprovalStatus.REJECTED.value == "rejected"


class TestApprovalRequest:
    """Tests for ApprovalRequest."""

    def test_create_request(self):
        """Test creating an approval request."""
        request = ApprovalRequest(
            id="req-1",
            workflow_id="wf-1",
            requester_id="user-1",
            title="Test Request",
            min_approvals=2,
        )
        assert request.status == ApprovalStatus.PENDING
        assert not request.is_approved()

    def test_request_approved_with_enough_approvals(self):
        """Test that request is approved when threshold is met."""
        request = ApprovalRequest(
            id="req-1",
            workflow_id="wf-1",
            requester_id="user-1",
            title="Test",
            min_approvals=2,
            approvals=[
                {"approver_id": "a1", "timestamp": datetime.now().isoformat()},
                {"approver_id": "a2", "timestamp": datetime.now().isoformat()},
            ],
        )
        assert request.is_approved()

    def test_request_expired(self):
        """Test request expiration."""
        request = ApprovalRequest(
            id="req-1",
            workflow_id="wf-1",
            requester_id="user-1",
            title="Test",
            expires_at=datetime.now() - timedelta(hours=1),
        )
        assert request.is_expired()

    def test_to_dict_from_dict(self):
        """Test serialization/deserialization."""
        request = ApprovalRequest(
            id="req-1",
            workflow_id="wf-1",
            requester_id="user-1",
            title="Test",
        )
        data = request.to_dict()
        restored = ApprovalRequest.from_dict(data)
        assert restored.id == request.id
        assert restored.title == request.title


class TestApprovalManager:
    """Tests for ApprovalManager."""

    def test_create_request(self):
        """Test creating an approval request."""
        manager = ApprovalManager()
        request = manager.create_request(
            requester_id="user-1",
            workflow_id="wf-1",
            title="Deploy to production",
            min_approvals=2,
        )
        assert request.status == ApprovalStatus.PENDING
        assert request.id is not None

    def test_approve_request(self):
        """Test approving a request."""
        manager = ApprovalManager()
        request = manager.create_request(
            requester_id="user-1",
            workflow_id="wf-1",
            title="Test",
            min_approvals=1,
        )
        approved = manager.approve(request.id, "approver-1", "Looks good")
        assert approved.status == ApprovalStatus.APPROVED
        assert len(approved.approvals) == 1

    def test_reject_request(self):
        """Test rejecting a request."""
        manager = ApprovalManager()
        request = manager.create_request(
            requester_id="user-1",
            workflow_id="wf-1",
            title="Test",
        )
        rejected = manager.reject(request.id, "approver-1", "Not ready")
        assert rejected.status == ApprovalStatus.REJECTED
        assert len(rejected.rejections) == 1

    def test_cancel_request(self):
        """Test cancelling a request."""
        manager = ApprovalManager()
        request = manager.create_request(
            requester_id="user-1",
            workflow_id="wf-1",
            title="Test",
        )
        cancelled = manager.cancel(request.id, "user-1")
        assert cancelled.status == ApprovalStatus.CANCELLED

    def test_list_pending_requests(self):
        """Test listing pending requests."""
        manager = ApprovalManager()
        manager.create_request("user-1", "wf-1", "Request 1")
        manager.create_request("user-1", "wf-2", "Request 2")

        pending = manager.list_pending_requests()
        assert len(pending) == 2

    def test_cannot_approve_twice(self):
        """Test that same user cannot approve twice."""
        manager = ApprovalManager()
        request = manager.create_request(
            requester_id="user-1",
            workflow_id="wf-1",
            title="Test",
            min_approvals=2,
        )
        manager.approve(request.id, "approver-1")

        with pytest.raises(ValueError, match="already approved"):
            manager.approve(request.id, "approver-1")

    def test_required_approvers(self):
        """Test required approvers list."""
        manager = ApprovalManager()
        request = manager.create_request(
            requester_id="user-1",
            workflow_id="wf-1",
            title="Test",
            required_approvers=["lead-1", "lead-2"],
        )

        # Non-authorized approver should fail
        with pytest.raises(ValueError, match="not an authorized approver"):
            manager.approve(request.id, "random-user")

    def test_handler_notifications(self):
        """Test that handlers are notified."""
        handler = LoggingApprovalHandler()
        manager = ApprovalManager(handlers=[handler])

        # This should trigger handler.on_approval_requested
        request = manager.create_request("user-1", "wf-1", "Test")
        assert request is not None


# =============================================================================
# Audit Logging Tests
# =============================================================================


class TestAuditEventType:
    """Tests for AuditEventType enum."""

    def test_event_type_values(self):
        """Test event type values."""
        assert AuditEventType.LOGIN.value == "auth.login"
        assert AuditEventType.WORKFLOW_EXECUTED.value == "workflow.executed"
        assert AuditEventType.PERMISSION_DENIED.value == "security.permission_denied"


class TestAuditEvent:
    """Tests for AuditEvent."""

    def test_create_event(self):
        """Test creating an audit event."""
        event = AuditEvent(
            id="evt-1",
            event_type=AuditEventType.WORKFLOW_EXECUTED,
            user_id="user-1",
            resource_type="workflow",
            resource_id="wf-1",
        )
        assert event.success
        assert event.timestamp is not None

    def test_to_dict_from_dict(self):
        """Test serialization/deserialization."""
        event = AuditEvent(
            id="evt-1",
            event_type=AuditEventType.LOGIN,
            user_id="user-1",
            details={"method": "password"},
        )
        data = event.to_dict()
        restored = AuditEvent.from_dict(data)
        assert restored.id == event.id
        assert restored.event_type == event.event_type


class TestInMemoryAuditStore:
    """Tests for InMemoryAuditStore."""

    def test_save_and_query(self):
        """Test saving and querying events."""
        store = InMemoryAuditStore()
        event = AuditEvent(
            id="evt-1",
            event_type=AuditEventType.LOGIN,
            user_id="user-1",
        )
        store.save(event)

        results = store.query(user_id="user-1")
        assert len(results) == 1
        assert results[0].id == "evt-1"

    def test_query_by_event_type(self):
        """Test querying by event type."""
        store = InMemoryAuditStore()
        store.save(AuditEvent("1", AuditEventType.LOGIN, "u1"))
        store.save(AuditEvent("2", AuditEventType.LOGOUT, "u1"))
        store.save(AuditEvent("3", AuditEventType.LOGIN, "u2"))

        results = store.query(event_type=AuditEventType.LOGIN)
        assert len(results) == 2

    def test_count(self):
        """Test counting events."""
        store = InMemoryAuditStore()
        store.save(AuditEvent("1", AuditEventType.LOGIN, "u1"))
        store.save(AuditEvent("2", AuditEventType.LOGIN, "u1"))

        assert store.count() == 2
        assert store.count(user_id="u1") == 2


class TestSQLiteAuditStore:
    """Tests for SQLiteAuditStore."""

    def test_save_and_query(self):
        """Test saving and querying events."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "audit.db"
            store = SQLiteAuditStore(db_path)

            event = AuditEvent(
                id="evt-1",
                event_type=AuditEventType.WORKFLOW_EXECUTED,
                user_id="user-1",
                resource_type="workflow",
                resource_id="wf-1",
                details={"run_id": "run-1"},
            )
            store.save(event)

            results = store.query(user_id="user-1")
            assert len(results) == 1
            assert results[0].details["run_id"] == "run-1"

    def test_count(self):
        """Test counting events."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "audit.db"
            store = SQLiteAuditStore(db_path)

            store.save(AuditEvent("1", AuditEventType.LOGIN, "u1"))
            store.save(AuditEvent("2", AuditEventType.LOGIN, "u2"))

            assert store.count() == 2
            assert store.count(event_type=AuditEventType.LOGIN) == 2


class TestAuditLogger:
    """Tests for AuditLogger."""

    def test_log_event(self):
        """Test logging an event."""
        logger = AuditLogger()
        event = logger.log(
            event_type=AuditEventType.LOGIN,
            user_id="user-1",
        )
        assert event.id is not None
        assert event.event_type == AuditEventType.LOGIN

    def test_log_workflow_execution(self):
        """Test logging workflow execution."""
        logger = AuditLogger()
        event = logger.log_workflow_execution(
            user_id="user-1",
            workflow_id="wf-1",
            run_id="run-1",
            inputs={"key": "value"},
        )
        assert event.event_type == AuditEventType.WORKFLOW_EXECUTED
        assert event.details["run_id"] == "run-1"

    def test_log_workflow_completed(self):
        """Test logging workflow completion."""
        logger = AuditLogger()
        event = logger.log_workflow_completed(
            user_id="user-1",
            workflow_id="wf-1",
            run_id="run-1",
            duration_seconds=10.5,
            steps_succeeded=5,
            steps_total=5,
        )
        assert event.event_type == AuditEventType.WORKFLOW_COMPLETED
        assert event.details["duration_seconds"] == 10.5

    def test_log_permission_denied(self):
        """Test logging permission denied."""
        logger = AuditLogger()
        event = logger.log_permission_denied(
            user_id="user-1",
            permission="workflow:execute",
            resource_type="workflow",
            resource_id="wf-1",
        )
        assert event.event_type == AuditEventType.PERMISSION_DENIED
        assert not event.success

    def test_query_events(self):
        """Test querying logged events."""
        logger = AuditLogger()
        logger.log(AuditEventType.LOGIN, "user-1")
        logger.log(AuditEventType.LOGOUT, "user-1")

        events = logger.query(user_id="user-1")
        assert len(events) == 2

    def test_count_events(self):
        """Test counting logged events."""
        logger = AuditLogger()
        logger.log(AuditEventType.LOGIN, "user-1")
        logger.log(AuditEventType.LOGIN, "user-2")

        assert logger.count() == 2
        assert logger.count(event_type=AuditEventType.LOGIN) == 2


# =============================================================================
# Integration Tests
# =============================================================================


class TestRBACWithApprovals:
    """Integration tests for RBAC with approval workflows."""

    def test_approval_requires_permission(self):
        """Test that approval actions require proper permissions."""
        rbac = RBACManager()

        # Create a user without approval permissions
        viewer = User(id="viewer-1", username="viewer", roles=["viewer"])
        rbac.add_user(viewer)

        # Create approval manager with RBAC
        manager = ApprovalManager(rbac=rbac)

        # Viewer should not be able to create approval requests
        with pytest.raises(PermissionDeniedError):
            manager.create_request(
                requester_id="viewer-1",
                workflow_id="wf-1",
                title="Test",
            )

    def test_approver_can_approve(self):
        """Test that approvers can approve requests."""
        rbac = RBACManager()

        # Create an approver user
        approver = User(id="approver-1", username="approver", roles=["approver"])
        executor = User(id="executor-1", username="executor", roles=["executor"])
        rbac.add_user(approver)
        rbac.add_user(executor)

        # Create approval manager with RBAC
        manager = ApprovalManager(rbac=rbac)

        # Executor creates request
        request = manager.create_request(
            requester_id="executor-1",
            workflow_id="wf-1",
            title="Deploy",
        )

        # Approver approves
        approved = manager.approve(request.id, "approver-1")
        assert approved.status == ApprovalStatus.APPROVED


class TestAuditWithRBAC:
    """Integration tests for audit logging with RBAC."""

    def test_permission_denied_is_logged(self):
        """Test that permission denied events are logged."""
        rbac = RBACManager()
        logger = AuditLogger()

        # Create a viewer
        viewer = User(id="viewer-1", username="viewer", roles=["viewer"])
        rbac.add_user(viewer)

        # Try to check a permission the viewer doesn't have
        if not rbac.check_permission("viewer-1", Permission.WORKFLOW_EXECUTE):
            logger.log_permission_denied(
                user_id="viewer-1",
                permission=Permission.WORKFLOW_EXECUTE.value,
                resource_type="workflow",
            )

        # Verify the event was logged
        events = logger.query(
            event_type=AuditEventType.PERMISSION_DENIED,
            user_id="viewer-1",
        )
        assert len(events) == 1
        assert "workflow:execute" in events[0].error_message
