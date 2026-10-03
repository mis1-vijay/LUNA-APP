import unittest
from datetime import datetime, timedelta, timezone
import secrets
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

import main
from main import (
    app,
    ensure_seed_data,
    hash_reset_code,
    has_access,
    request_password_reset,
    require_admin,
    reset_password,
)
from models import PasswordResetConfirm, PasswordResetRequest


class BackendContractTests(unittest.TestCase):
    def test_seed_data_populates_default_resources(self):
        result = ensure_seed_data()
        self.assertIn("departments", result)
        self.assertIn("resources", result)
        self.assertGreaterEqual(result["departments"], 1)
        self.assertGreaterEqual(result["resources"], 1)

    def test_role_visibility_is_hierarchical_with_manager_bypass(self):
        self.assertTrue(has_access("User", "User"))
        self.assertFalse(has_access("User", "Supervisor"))
        self.assertTrue(has_access("Supervisor", "User"))
        self.assertTrue(has_access("Supervisor", "Supervisor"))
        self.assertFalse(has_access("Supervisor", "Manager"))
        self.assertTrue(has_access("Manager", "Admin"))
        self.assertTrue(has_access("Admin", "unknown"))

    def test_non_admin_roles_are_forbidden_from_mutation_dependencies(self):
        for role in ("User", "Supervisor", "Manager"):
            with self.subTest(role=role), self.assertRaises(HTTPException) as raised:
                require_admin({"role": role})
            self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(require_admin({"role": "Admin"})["role"], "Admin")

    def test_resource_mutation_routes_require_admin(self):
        mutation_routes = [
            route
            for route in app.routes
            if route.path.startswith(("/api/admin/", "/api/modules"))
            and route.methods.intersection({"POST", "PUT", "DELETE"})
        ]
        self.assertTrue(mutation_routes)
        for route in mutation_routes:
            with self.subTest(path=route.path):
                dependencies = [dependency.call for dependency in route.dependant.dependencies]
                self.assertIn(require_admin, dependencies)

    @patch.dict("os.environ", {"JWT_SECRET_KEY": secrets.token_urlsafe(32)})
    @patch("main.send_password_reset_email")
    @patch("main.get_user_by_employee_id", return_value={"active": True, "email": "employee@luna.co.in"})
    @patch("main.get_smtp_settings")
    @patch("main.get_supabase")
    def test_reset_request_sends_code_without_disclosing_code_in_response(
        self, get_supabase, get_smtp_settings, get_user, send_email
    ):
        supabase = MagicMock()
        supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        get_supabase.return_value = supabase

        result = request_password_reset(PasswordResetRequest(employee_id="EMP123"))

        self.assertIn("If the account exists", result["message"])
        send_email.assert_called_once()
        self.assertEqual(send_email.call_args.args[0], "employee@luna.co.in")
        self.assertRegex(send_email.call_args.args[1], r"^\d{6}$")
        upserted = supabase.table.return_value.upsert.call_args.args[0]
        self.assertNotIn(send_email.call_args.args[1], upserted["token_hash"])
        get_smtp_settings.assert_called_once()
        get_user.assert_called_once_with("EMP123")

    @patch.dict("os.environ", {"JWT_SECRET_KEY": secrets.token_urlsafe(32)})
    @patch("main.update_user_record", return_value=SimpleNamespace(data=[{"employee_id": "EMP123"}]))
    @patch("main.get_supabase")
    def test_reset_password_consumes_email_code_and_hashes_new_password(self, get_supabase, update_user):
        code = "012345"
        challenge = {
            "employee_id": "EMP123",
            "token_hash": hash_reset_code("EMP123", code),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
            "attempts": 0,
        }
        supabase = MagicMock()
        supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            challenge
        ]
        supabase.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            challenge
        ]
        get_supabase.return_value = supabase

        with patch.object(main.pwd_context, "hash", return_value="hashed-password"):
            result = reset_password(
                PasswordResetConfirm(employee_id="EMP123", code=code, password="new-password-123")
            )

        self.assertEqual(result["message"], "Password reset successfully.")
        update_user.assert_called_once_with(
            supabase,
            "EMP123",
            {"password_hash": "hashed-password"},
        )


if __name__ == "__main__":
    unittest.main()
