from pydantic import BaseModel, field_validator, Field
from typing import Optional, List
from datetime import datetime
from .user import UserResponse

class TaskBase(BaseModel):
    title: str
    content: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None

    @field_validator('due_date', mode='before')
    @classmethod
    def validate_due_date(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                if len(v) == 10 and v.count('-') == 2:  # YYYY-MM-DD
                    year, month, day = v.split('-')
                    year_int = int(year)
                    if year_int < 1900 or year_int > 2100:
                        raise ValueError(f"Year {year_int} is out of valid range (1900-2100)")
                return datetime.fromisoformat(v)
            except ValueError as e:
                raise ValueError(f"Invalid date format: {v}. Expected format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS")
        return v

    @field_validator('status', mode='before')
    @classmethod
    def normalize_status(cls, v):
        if v is None:
            return "todo"
        mapping = {
            'progress': 'in_progress',
            'in progress': 'in_progress',
            'in-progress': 'in_progress'
        }
        s = str(v).strip().lower()
        return mapping.get(s, s)

class TaskCreate(TaskBase):
    workspace_id: int
    assignees_ids: Optional[List[int]] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    time_spent: Optional[int] = None
    assignees_ids: Optional[List[int]] = None

# Response schemas
class TaskAssigneeOut(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    position: Optional[str] = None
    avatar: Optional[str] = None

class AuthorOut(BaseModel):
    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    avatar: Optional[str] = None

class TaskResponse(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    time_spent: Optional[int] = 0
    created_at: Optional[datetime] = None
    assignees_ids: Optional[List[int]] = None
    assignees: Optional[List[TaskAssigneeOut]] = Field(default_factory=list)
    owner_id: int
    workspace_id: int
    author: Optional[AuthorOut] = None

class TasksResponse(BaseModel):
    tasks: List[TaskResponse]

class TaskAssigneesRequest(BaseModel):
    assignees_ids: List[int]
