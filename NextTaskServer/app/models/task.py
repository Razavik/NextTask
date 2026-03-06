from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.database import Base

# Таблица для связи многие-ко-многим между задачами и исполнителями
task_assignees = Table(
    'task_assignees',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="todo")  # "todo", "in_progress", "done"
    priority = Column(String, default="medium")  # "low", "medium", "high"
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    time_spent = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Связи
    workspace = relationship("Workspace", back_populates="tasks")
    creator = relationship("User", back_populates="created_tasks")
    assignees = relationship("User", secondary=task_assignees, back_populates="assigned_tasks")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    time_tracks = relationship("TaskTimeTrack", back_populates="task", cascade="all, delete-orphan")
