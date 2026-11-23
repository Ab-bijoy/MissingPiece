"""Payment refunds: statuses refund_due and refunded, and a refund notification.

A payment that arrives for an offer that is already paid, or was withdrawn while the
payment was in progress, is marked refund_due instead of counting as paid. An admin
sends the money back by hand and marks it refunded.

Revision ID: e7a1_payment_refunds
Revises: c031_community
"""

from alembic import op

revision = "e7a1_payment_refunds"
down_revision = "c031_community"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_due'")
    op.execute("ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_refund_due'")


def downgrade():
    # PostgreSQL cannot drop a value from an enum type; the extra values are harmless.
    pass
