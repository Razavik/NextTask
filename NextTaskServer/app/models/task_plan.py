from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.database import Base

class TaskPlan(Base):
    __tablename__ = "task_plans"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Дата на которую запланировано время
    date = Column(Date, nullable=False, index=True)
    
    # Запланированное время в часах (может быть дробным, напр. 1.5 часа)
    hours = Column(Float, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Связи
    task = relationship("Task", backref="plans")
    user = relationship("User", backref="plans", foreign_keys=[user_id])
    workspace = relationship("Workspace", backref="task_plans")
    created_by = relationship("User", backref="created_plans", foreign_keys=[created_by_id])
