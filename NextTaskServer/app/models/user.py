from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    position = Column(String, nullable=True)
    avatar = Column(Text, nullable=True)  # URL или base64
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Связи
    owned_workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    assigned_tasks = relationship("Task", secondary="task_assignees", back_populates="assignees")
    created_tasks = relationship("Task", back_populates="creator")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")
    comments = relationship("Comment", back_populates="author")
    sent_invites = relationship("Invite", foreign_keys="Invite.inviter_id", back_populates="inviter")
    received_invites = relationship("Invite", foreign_keys="Invite.invitee_id", back_populates="invitee")
    time_tracks = relationship("TaskTimeTrack", back_populates="user", cascade="all, delete-orphan")
