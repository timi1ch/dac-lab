"""initial schema: users, sessions, resources, permissions

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00
"""
from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = set() if context.is_offline_mode() else set(sa.inspect(op.get_bind()).get_table_names())
    expected = {
        "users": {"id", "login", "password_hash", "created_at"},
        "user_sessions": {"token_hash", "user_id", "expires_at"},
        "resources": {"id", "title", "content", "owner_id", "created_at", "updated_at"},
        "resource_permissions": {"user_id", "resource_id", "can_read", "can_update", "can_delete"},
    }
    for table, columns in expected.items():
        if table in existing:
            actual = {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}
            if not columns.issubset(actual):
                raise RuntimeError(f"Таблица {table} имеет другую структуру; нужна отдельная миграция")

    if "users" not in existing:
        # --- users ---
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("login", sa.String(length=32), nullable=False),
            sa.Column("password_hash", sa.String(length=64), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(timezone=True),
                server_default=sa.func.now(), nullable=False,
            ),
        )
        op.create_index("ix_users_id", "users", ["id"])
        op.create_index("ix_users_login", "users", ["login"], unique=True)

    if "user_sessions" not in existing:
        # --- user_sessions ---
        op.create_table(
            "user_sessions",
            sa.Column("token_hash", sa.String(length=64), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE",
            ),
        )
        op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    if "resources" not in existing:
        # --- resources ---
        op.create_table(
            "resources",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column("owner_id", sa.Integer(), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(timezone=True),
                server_default=sa.func.now(), nullable=False,
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True),
                server_default=sa.func.now(), nullable=False,
            ),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        )
        op.create_index("ix_resources_owner_id", "resources", ["owner_id"])

    if "resource_permissions" not in existing:
        # --- resource_permissions (дискреционная модель, вариант 2) ---
        op.create_table(
            "resource_permissions",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("resource_id", sa.Integer(), nullable=False),
            sa.Column(
                "can_read", sa.Boolean(), nullable=False, server_default=sa.false(),
            ),
            sa.Column(
                "can_update", sa.Boolean(), nullable=False, server_default=sa.false(),
            ),
            sa.Column(
                "can_delete", sa.Boolean(), nullable=False, server_default=sa.false(),
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["resource_id"], ["resources.id"], ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("user_id", "resource_id"),
        )


def downgrade() -> None:
    op.drop_table("resource_permissions")
    op.drop_index("ix_resources_owner_id", table_name="resources")
    op.drop_table("resources")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("ix_users_login", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")