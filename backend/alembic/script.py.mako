"""Generic Alembic revision script."""
from alembic import op  # noqa
import sqlalchemy as sa  # noqa
${imports if imports else ''}

def upgrade() -> None:
    ${upgrades if upgrades else 'pass'}

def downgrade() -> None:
    ${downgrades if downgrades else 'pass'}
