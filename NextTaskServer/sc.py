"""Remove position column from tasks table

Revision ID: remove_position_from_tasks
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_position_from_tasks'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # SQLite не поддерживает DROP COLUMN напрямую
    # Используем batch операции для SQLite
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.drop_column('position')


def downgrade():
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.add_column(sa.Column('position', sa.String(), nullable=True))
