"""video technical metadata columns

Revision ID: 20240818_0002
Revises: 20240818_0001
Create Date: 2024-08-18
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = '20240818_0002'
down_revision = '20240818_0001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table('videos') as batch:
        batch.add_column(sa.Column('resolution_width', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('resolution_height', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('video_bitrate_kbps', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('audio_bitrate_kbps', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('codec_video', sa.String(), nullable=True))
        batch.add_column(sa.Column('codec_audio', sa.String(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('videos') as batch:
        batch.drop_column('codec_audio')
        batch.drop_column('codec_video')
        batch.drop_column('audio_bitrate_kbps')
        batch.drop_column('video_bitrate_kbps')
        batch.drop_column('resolution_height')
        batch.drop_column('resolution_width')
