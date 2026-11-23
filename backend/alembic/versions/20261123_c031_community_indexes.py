"""Index community feeds, membership counts and comment threads.

Revision ID: c031_community
Revises: f87d2731af3f
"""

from alembic import op

revision = "c031_community"
down_revision = "f87d2731af3f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_project_status_created", "project", ["status", "created_at"])
    op.create_index("ix_membership_project_status_role", "event_membership", ["project_id", "status", "role"])
    op.create_index("ix_comment_project_status_created", "comment", ["project_id", "status", "created_at"])


def downgrade():
    op.drop_index("ix_comment_project_status_created", table_name="comment")
    op.drop_index("ix_membership_project_status_role", table_name="event_membership")
    op.drop_index("ix_project_status_created", table_name="project")
