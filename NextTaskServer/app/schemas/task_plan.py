from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    position: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TaskPlanBase(BaseModel):
    task_id: int
    user_id: int
    date: date
    hours: float

class TaskPlanCreate(TaskPlanBase):
    pass

class TaskPlanUpdate(BaseModel):
    hours: Optional[float] = None

class TaskPlanResponse(TaskPlanBase):
    id: int
    workspace_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class PlanningTaskOptionResponse(BaseModel):
    id: int
    title: str
    workspace_id: int
