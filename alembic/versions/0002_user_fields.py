"""Align users created before Alembic and allow salted password hashes."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    with op.batch_alter_table("users") as batch:
        batch.alter_column("login", existing_type=sa.String(), type_=sa.String(32), nullable=False)
        batch.alter_column("password_hash", existing_type=sa.String(), type_=sa.String(255), nullable=False)
        batch.alter_column(
            "created_at", existing_type=sa.DateTime(), type_=sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        )


def downgrade():
    # Хеши нельзя безопасно сократить обратно до 64 символов.
    raise RuntimeError("Откат 0002 удалит возможность входа с новыми хешами паролей")
