"""Admin-only hidden messages and sponsor score provenance."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "f92a_ai_messages_matching"
down_revision = "e7a1_payment_refunds"
branch_labels = None
depends_on = None


def upgrade():
    status = postgresql.ENUM("visible", "hidden", name="comment_status", create_type=False)
    op.add_column("message", sa.Column("status", status, nullable=False, server_default="visible"))
    op.create_index("ix_message_thread_status_created", "message", ["thread_id", "status", "created_at"])
    op.add_column("sponsor_match", sa.Column("source", sa.String(16), nullable=False, server_default="rules"))


def downgrade():
    op.drop_column("sponsor_match", "source")
    op.drop_index("ix_message_thread_status_created", table_name="message")
    op.drop_column("message", "status")
