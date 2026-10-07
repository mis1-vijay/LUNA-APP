import unittest
import json
from datetime import datetime, timedelta, timezone
import secrets
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError

import main
from main import (
    app,
    create_resource,
    ensure_seed_data,
    hash_reset_code,
    has_access,
    can_view_resource,
    get_notifications,
    delete_resource,
    get_audit_logs,
    notification_role_allows,
    normalize_resource_payload,
    fetch_visible_resources,
    visible_resource_levels,
    register_push_token,
    request_password_reset,
    require_admin,
    reset_password,
    send_resource_push_notification,
    update_user,
    update_resource,
)
from models import PasswordResetConfirm, PasswordResetRequest, PushTokenRegistration, ResourceCreate, UserUpdate


class BackendContractTests(unittest.TestCase):
    def test_seed_data_populates_default_resources(self):
        result = ensure_seed_data()
        self.assertIn("departments", result)
        self.assertIn("resources", result)
        self.assertGreaterEqual(result["departments"], 1)
        self.assertGreaterEqual(result["resources"], 1)

    def test_global_seed_resources_have_no_department_assignment(self):
        supabase = MagicMock()
        departments_table = MagicMock()
        resources_table = MagicMock()
        supabase.table.side_effect = lambda table: {
            "departments": departments_table,
            "resources": resources_table,
        }[table]
        departments_table.select.return_value.execute.return_value.data = [
            {"id": "6b59904d-9918-4f7e-8d1c-609936912d14", "name": "Automation", "sort_order": 1},
        ]
        resources_table.select.return_value.execute.return_value.data = []

        with patch("main.get_supabase", return_value=supabase):
            ensure_seed_data()

        seed_rows = resources_table.insert.call_args.args[0]
        global_titles = {"Task Manager", "Daily Production Summary", "System Audit", "User Access Matrix"}
        for resource in seed_rows:
            if resource["title"] in global_titles:
                self.assertIsNone(resource["department_id"])

    def test_role_visibility_is_strictly_hierarchical(self):
        self.assertTrue(has_access("User", "User"))
        self.assertFalse(has_access("User", "Supervisor"))
        self.assertTrue(has_access("Supervisor", "User"))
        self.assertTrue(has_access("Supervisor", "Supervisor"))
        self.assertFalse(has_access("Supervisor", "Manager"))
        self.assertFalse(has_access("Manager", "Admin"))
        self.assertFalse(has_access("Admin", "unknown"))

    def test_non_admin_roles_are_forbidden_from_mutation_dependencies(self):
        for role in ("User", "Supervisor", "Manager"):
            with self.subTest(role=role), self.assertRaises(HTTPException) as raised:
                require_admin({"role": role})
            self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(require_admin({"role": "Admin"})["role"], "Admin")
        self.assertEqual(require_admin({"role": "admin"})["role"], "admin")

    def test_resource_response_uses_canonical_role_contract_and_user_fallback(self):
        resource = main.ResourceResponse(
            id="a658e481-c235-4cc5-b42a-3773bd68d2ce",
            title="User resource",
            viewing_level="User",
        )
        self.assertEqual(resource.viewing_level, "User")

        with self.assertRaises(ValidationError):
            main.ResourceResponse(
                id="a658e481-c235-4cc5-b42a-3773bd68d2ce",
                title="Invalid resource",
                viewing_level="Executive",
            )

    def test_user_mutation_models_accept_only_canonical_roles(self):
        with self.assertRaises(ValidationError):
            main.UserCreate(
                employee_id="EMP123",
                name="Example User",
                password="StrongPassword123",
                role="Executive",
            )

        with self.assertRaises(ValidationError):
            UserUpdate(role="executive")

    def test_schema_migration_matches_database_tables_and_department_contract(self):
        migration_path = main.Path(__file__).resolve().parent / "supabase_schema_fix.sql"
        migration = migration_path.read_text(encoding="utf-8").lower()

        for table in (
            "users",
            "departments",
            "resources",
            "password_reset_tokens",
            "notifications",
            "user_push_tokens",
            "audit_logs",
        ):
            self.assertIn(f"public.{table}", migration)

        self.assertIn("department_id uuid", migration)
        self.assertIn("references public.departments(id)", migration)
        self.assertIn("password_reset_tokens_employee_id_uidx", migration)
        self.assertIn("user_push_tokens_employee_id_fkey", migration)
        self.assertIn("'user access matrix'", migration)

    def test_all_resource_mutations_require_admin(self):
        mutation_routes = [
            route
            for route in app.routes
            if route.path.startswith(("/api/admin/resources", "/api/admin/items", "/api/modules"))
            and route.methods.intersection({"POST", "PUT", "DELETE"})
        ]
        self.assertTrue(mutation_routes)
        for route in mutation_routes:
            with self.subTest(path=route.path):
                dependencies = [dependency.call for dependency in route.dependant.dependencies]
                self.assertIn(require_admin, dependencies)

    def test_resource_visibility_levels_are_strictly_hierarchical(self):
        self.assertEqual(visible_resource_levels("User"), ["User"])
        self.assertEqual(visible_resource_levels("Supervisor"), ["User", "Supervisor"])
        self.assertEqual(visible_resource_levels("Manager"), ["User", "Supervisor", "Manager", "Admin"])
        self.assertIsNone(visible_resource_levels("Admin"))

    def test_managers_can_view_admin_resources_but_not_manage_them(self):
        self.assertTrue(can_view_resource("Manager", "Admin"))
        self.assertFalse(has_access("Manager", "Admin"))
        self.assertFalse(can_view_resource("Supervisor", "Admin"))

    def test_resource_query_filters_database_by_viewing_level(self):
        supabase = MagicMock()
        query = supabase.table.return_value.select.return_value
        query.execute.return_value.data = [
            {"title": "User item", "viewing_level": "User"},
            {"title": "Supervisor item", "viewing_level": "Supervisor"},
            {"title": "Manager item", "viewing_level": "Manager"},
            {"title": "Admin item", "viewing_level": "Admin"},
            {"title": "Unassigned item", "viewing_level": None},
        ]

        visible = fetch_visible_resources(supabase, "Supervisor")

        self.assertEqual([resource["title"] for resource in visible], ["User item", "Supervisor item", "Unassigned item"])
        query.in_.assert_not_called()

        admin_supabase = MagicMock()
        admin_query = admin_supabase.table.return_value.select.return_value
        admin_query.execute.return_value.data = query.execute.return_value.data

        admin_visible = fetch_visible_resources(admin_supabase, "Admin")

        self.assertEqual(len(admin_visible), 5)
        admin_query.in_.assert_not_called()

    def test_user_level_resources_are_visible_to_all_roles_case_insensitively(self):
        department_id = "6b59904d-9918-4f7e-8d1c-609936912d14"
        resources = [
            {"title": "Lowercase viewing level", "viewing_level": "user", "department_id": department_id},
            {"title": "Uppercase access level", "access_level": "USER", "department_id": department_id},
            {"title": "Mixed-case required role", "required_role": "UsEr", "department_id": department_id},
            {"title": "Supervisor resource", "viewing_level": "SUPERVISOR"},
            {"title": "Manager resource", "viewing_level": "Manager"},
            {"title": "Admin resource", "viewing_level": "admin"},
        ]

        expected_titles = {
            "User": {
                "Lowercase viewing level",
                "Uppercase access level",
                "Mixed-case required role",
            },
            "Supervisor": {
                "Lowercase viewing level",
                "Uppercase access level",
                "Mixed-case required role",
                "Supervisor resource",
            },
            "Manager": {
                "Lowercase viewing level",
                "Uppercase access level",
                "Mixed-case required role",
                "Supervisor resource",
                "Manager resource",
                "Admin resource",
            },
            "Admin": {resource["title"] for resource in resources},
        }

        for role, expected in expected_titles.items():
            supabase = MagicMock()
            supabase.table.return_value.select.return_value.execute.return_value.data = resources

            with self.subTest(role=role):
                visible = fetch_visible_resources(supabase, role)
                self.assertEqual({resource["title"] for resource in visible}, expected)
                for resource in visible:
                    if resource["title"] in {
                        "Lowercase viewing level",
                        "Uppercase access level",
                        "Mixed-case required role",
                    }:
                        self.assertEqual(resource["department_id"], department_id)

    def test_only_admin_can_update_or_delete_resources(self):
        resource_id = "a658e481-c235-4cc5-b42a-3773bd68d2ce"
        resource_table = MagicMock()
        supabase = MagicMock()
        supabase.table.side_effect = lambda name: resource_table if name == "resources" else MagicMock()
        resource_table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            {"id": resource_id, "title": "User resource", "viewing_level": "User"}
        ]
        updated_resource = {"id": resource_id, "title": "User resource", "viewing_level": "Manager"}
        resource_table.update.return_value.eq.return_value.execute.return_value.data = [updated_resource]

        with self.assertRaises(HTTPException) as manager_update:
            update_resource(
                resource_id,
                main.ResourceUpdate(viewing_level="Manager"),
                {"role": "Manager", "employee_id": "MGR1"},
            )
        self.assertEqual(manager_update.exception.status_code, 403)

        with self.assertRaises(HTTPException) as manager_delete:
            delete_resource(resource_id, {"role": "Manager", "employee_id": "MGR1"})
        self.assertEqual(manager_delete.exception.status_code, 403)
        resource_table.select.assert_not_called()
        resource_table.delete.assert_not_called()

        with patch("main.get_supabase", return_value=supabase):
            result = update_resource(
                resource_id,
                main.ResourceUpdate(viewing_level="Manager"),
                {"role": "Admin", "employee_id": "ADMIN1"},
            )
        self.assertEqual(result, updated_resource)

    def test_notification_role_filter_is_strictly_hierarchical(self):
        self.assertTrue(notification_role_allows("Manager", "Manager"))
        self.assertTrue(notification_role_allows("Admin", "Manager"))
        self.assertFalse(notification_role_allows("Manager", "Admin"))
        self.assertFalse(notification_role_allows("User", "Supervisor"))

    def test_notifications_endpoint_filters_for_authenticated_role(self):
        supabase = MagicMock()
        supabase.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
            {
                "id": "a658e481-c235-4cc5-b42a-3773bd68d2ce",
                "message": "Manager notice",
                "target_role_level": "Manager",
                "created_at": datetime.now(timezone.utc),
                "is_read": False,
            },
            {
                "id": "b768e481-c235-4cc5-b42a-3773bd68d2cf",
                "message": "Admin notice",
                "target_role_level": "Admin",
                "created_at": datetime.now(timezone.utc),
                "is_read": False,
            },
        ]

        with patch("main.get_supabase", return_value=supabase):
            results = get_notifications({"role": "Manager"})

        self.assertEqual([item.message for item in results], ["Manager notice"])

    def test_resource_normalizer_maps_legacy_link_without_emitting_unsupported_fields(self):
        normalized = normalize_resource_payload(
            {
                "title": "Example",
                "type": "webapp",
                "category": "webapp",
                "link": "https://example.com",
                "role": "User",
            },
            apply_defaults=True,
        )

        self.assertEqual(normalized["url"], "https://example.com")
        self.assertNotIn("link", normalized)
        self.assertNotIn("category", normalized)
        self.assertNotIn("role", normalized)

    def test_resource_create_inserts_only_supported_columns(self):
        supabase = MagicMock()
        resources_table = MagicMock()
        notifications_table = MagicMock()
        audit_table = MagicMock()
        push_tokens_table = MagicMock()
        supabase.table.side_effect = lambda table_name: {
            "resources": resources_table,
            "notifications": notifications_table,
            "audit_logs": audit_table,
            "user_push_tokens": push_tokens_table,
        }[table_name]
        resources_table.select.return_value.execute.return_value.data = []
        inserted_resource = {"id": "a658e481-c235-4cc5-b42a-3773bd68d2ce", "title": "Example"}
        resources_table.insert.return_value.execute.return_value.data = [inserted_resource]
        push_tokens_table.select.return_value.execute.return_value.data = []

        payload = ResourceCreate(
            title="Example",
            type="webapp",
            url="https://example.com",
            category="webapp",
            link="https://example.com",
        )

        with patch("main.get_supabase", return_value=supabase):
            result = create_resource(payload, {"role": "Admin"})

        self.assertEqual(result, inserted_resource)
        resources_table.insert.assert_called_once_with(
            {
                "title": "Example",
                "type": "webapp",
                "url": "https://example.com",
                "viewing_level": "User",
            }
        )
        notifications_table.insert.assert_called_once_with(
            {
                "message": "New resource: Example",
                "target_role_level": "User",
                "is_read": False,
            }
        )
        audit_table.insert.assert_called_once_with(
            {
                "actor_employee_id": "",
                "actor_name": "Admin",
                "action": "resource_created",
                "target_type": "resource",
                "target_id": inserted_resource["id"],
                "details": {"title": "Example"},
            }
        )

    def test_push_token_registration_is_scoped_to_authenticated_user(self):
        supabase = MagicMock()
        with patch("main.get_supabase", return_value=supabase):
            result = register_push_token(
                PushTokenRegistration(expo_push_token="ExpoPushToken[0123456789abcdef012345]"),
                {"employee_id": "EMP123"},
            )

        self.assertEqual(result, {"status": "registered"})
        supabase.table.assert_called_once_with("user_push_tokens")
        supabase.table.return_value.upsert.assert_called_once()
        registration = supabase.table.return_value.upsert.call_args.args[0]
        self.assertEqual(registration["employee_id"], "EMP123")
        self.assertEqual(registration["expo_push_token"], "ExpoPushToken[0123456789abcdef012345]")

    def test_resource_push_is_sent_to_every_registered_token(self):
        tokens = [
            "ExpoPushToken[0123456789abcdef012345]",
            "ExponentPushToken[abcdef0123456789abcdef]",
        ]
        supabase = MagicMock()
        supabase.table.return_value.select.return_value.execute.return_value.data = [
            {"expo_push_token": token} for token in tokens
        ]
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"data":[{"status":"ok"},{"status":"ok"}]}'

        with patch("main.urlopen", return_value=response) as send_request:
            send_resource_push_notification(supabase, {"id": "resource-1", "title": "New module"})

        request = send_request.call_args.args[0]
        messages = json.loads(request.data.decode("utf-8"))
        self.assertEqual([message["to"] for message in messages], sorted(tokens))
        self.assertTrue(all(message["body"] == "New module" for message in messages))
        send_request.assert_called_once_with(request, timeout=10)

    def test_audit_log_endpoint_allows_admin_and_manager_and_returns_recent_rows(self):
        route = next(route for route in app.routes if route.path == "/api/audit-logs")
        dependencies = [dependency.call for dependency in route.dependant.dependencies]
        self.assertIn(main.require_admin_or_manager, dependencies)

        expected_logs = [{"id": "log-1", "action": "resource_created"}]
        supabase = MagicMock()
        supabase.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = expected_logs
        with patch("main.get_supabase", return_value=supabase):
            result = get_audit_logs({"role": "Admin"})

        self.assertEqual(result, expected_logs)
        supabase.table.assert_called_once_with("audit_logs")

    def test_admin_user_updates_are_audited_without_recording_password_values(self):
        supabase = MagicMock()
        with (
            patch("main.get_supabase", return_value=supabase),
            patch("main.update_user_record", return_value=SimpleNamespace(data=[{"employee_id": "EMP123"}])),
        ):
            result = update_user(
                "EMP123",
                UserUpdate(name="Updated name", password="NewSecurePassword123"),
                {"employee_id": "ADMIN1", "name": "Portal Admin"},
            )

        self.assertEqual(result, {"employee_id": "EMP123"})
        audit_details = supabase.table.return_value.insert.call_args.args[0]["details"]
        self.assertEqual(audit_details["changed_fields"], ["name", "password"])
        self.assertNotIn("NewSecurePassword123", str(audit_details))

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
