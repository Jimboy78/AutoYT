"""initial schema snapshot

Revision ID: 20240818_0001
Revises: 
Create Date: 2024-08-18
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20240818_0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'videos',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='uploaded'),
        sa.Column('duration', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('video_id', sa.String(), sa.ForeignKey('videos.id'), index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('progress', sa.Float(), server_default='0'),
        sa.Column('error', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_table(
        'clips',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('video_id', sa.String(), sa.ForeignKey('videos.id'), index=True),
        sa.Column('start', sa.Float(), nullable=False),
        sa.Column('end', sa.Float(), nullable=False),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('thumbnail_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_table(
        'transcriptions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('video_id', sa.String(), sa.ForeignKey('videos.id'), index=True),
        sa.Column('language', sa.String(), server_default='es'),
        sa.Column('status', sa.String(), server_default='pending'),
        sa.Column('error', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_table(
        'segments',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('transcription_id', sa.String(), sa.ForeignKey('transcriptions.id'), index=True),
        sa.Column('start', sa.Float(), nullable=False),
        sa.Column('end', sa.Float(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('speaker', sa.String(), nullable=True),
        sa.Column('confidence', sa.Float(), server_default='0.9'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )


def downgrade() -> None:
    op.drop_table('segments')
    op.drop_table('transcriptions')
    op.drop_table('clips')
    op.drop_table('jobs')
    op.drop_table('videos')
