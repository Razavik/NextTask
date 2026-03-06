from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os
import base64
import mimetypes
import time
import asyncio

from app.database.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.task import Task, task_assignees
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TasksResponse, TaskAssigneesRequest,
    TaskAssigneeOut, AuthorOut
)
from app.core.security import get_current_active_user
from app.api.v1.chat import manager, _avatar_to_base64 as _chat_avatar_to_base64

router = APIRouter()
workspace_router = APIRouter()

UPLOAD_DIR = "uploads"

def _avatar_to_base64(avatar_value: Optional[str]) -> Optional[str]:
    if not avatar_value:
        return None
    if isinstance(avatar_value, str) and avatar_value.startswith("data:"):
        return avatar_value
    if isinstance(avatar_value, str) and avatar_value.startswith("/uploads/"):
        filename = avatar_value[len("/uploads/"):]
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            mime, _ = mimetypes.guess_type(file_path)
            mime = mime or "image/jpeg"
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                b64 = base64.b64encode(data).decode("ascii")
                return f"data:{mime};base64,{b64}"
            except Exception:
                return avatar_value
    return avatar_value

def _map_status_out(status: str) -> str:
    if not status:
        return "todo"
    mapping = {"in_progress": "progress"}
    return mapping.get(status, status)

def to_task_response(task: Task) -> TaskResponse:
    assignees = [
        TaskAssigneeOut(
            id=u.id,
            name=u.name,
            email=u.email,
            position=u.position,
            avatar=_avatar_to_base64(u.avatar)
        ) for u in (task.assignees or [])
    ]
    author = AuthorOut(
        id=task.creator.id,
        name=task.creator.name,
        email=getattr(task.creator, 'email', None),
        position=getattr(task.creator, 'position', None),
        avatar=_avatar_to_base64(getattr(task.creator, 'avatar', None))
    ) if task.creator else None
    return TaskResponse(
        id=task.id,
        title=task.title,
        content=task.description,
        status=_map_status_out(task.status),
        priority=task.priority,
        due_date=task.due_date,
        time_spent=task.time_spent or 0,
        created_at=task.created_at,
        assignees_ids=[u.id for u in (task.assignees or [])] or None,
        assignees=assignees,
        owner_id=task.creator_id,
        workspace_id=task.workspace_id,
        author=author,
    )

def notify_new_assignees(task: Task, current_user: User, new_assignees: List[User]):
    for assignee in new_assignees:
        if assignee.id == current_user.id:
            continue
        payload = {
            "type": "task_assigned",
            "task": {
                "id": task.id,
                "title": task.title,
                "workspace_id": task.workspace_id,
            },
            "assigned_by": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "avatar": _chat_avatar_to_base64(current_user.avatar),
            },
        }
        try:
            asyncio.run(manager.send_personal_message(payload, assignee.id))
        except Exception:
            pass

def check_workspace_access(workspace_id: int, user: User, db: Session) -> Workspace:
    """Проверяет доступ пользователя к рабочему пространству"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Проверяем, является ли пользователь владельцем или участником
    if workspace.owner_id != user.id:
        membership = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied to workspace")
    
    return workspace

@workspace_router.get("/{workspace_id}/tasks", response_model=TasksResponse)
def get_tasks(
    workspace_id: int,
    db: Session = Depends(get_db)
):
    """Получить список задач рабочего пространства"""
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    return TasksResponse(tasks=[to_task_response(t) for t in tasks])

from sqlalchemy import or_

@router.get("/my", response_model=TasksResponse)
def get_my_tasks(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить все задачи, назначенные на текущего пользователя или созданные им"""
    tasks = db.query(Task).filter(
        or_(
            Task.creator_id == current_user.id,
            Task.assignees.any(User.id == current_user.id)
        )
    ).order_by(Task.due_date.asc().nulls_last()).all()
    
    return TasksResponse(tasks=[to_task_response(t) for t in tasks])

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить конкретную задачу"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Проверяем доступ к рабочему пространству задачи
    check_workspace_access(task.workspace_id, current_user, db)
    
    return to_task_response(task)

@router.post("/", response_model=TaskResponse)
def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать новую задачу"""
    
    task = Task(
        title=task_data.title,
        description=task_data.content,
        status=task_data.status,
        priority=task_data.priority,
        due_date=task_data.due_date,
        workspace_id=task_data.workspace_id,
        creator_id=current_user.id
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Проставляем исполнителей, если переданы
    new_assignees: List[User] = []
    if task_data.assignees_ids:
        task.assignees.clear()
        users = db.query(User).filter(User.id.in_(task_data.assignees_ids)).all()
        for u in users:
            task.assignees.append(u)
        new_assignees = users
        db.commit()
        db.refresh(task)

    if new_assignees:
        notify_new_assignees(task, current_user, new_assignees)

    return to_task_response(task)

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить задачу"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    check_workspace_access(task.workspace_id, current_user, db)
    
    update_data = task_data.model_dump(exclude_unset=True)
    # Переносим входной content в ORM-поле description
    if 'content' in update_data:
        task.description = update_data.pop('content')
    for field, value in update_data.items():
        setattr(task, field, value)
    
    # Если статус меняется на "done", устанавливаем время завершения
    if task_data.status == "done" and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    elif task_data.status != "done":
        task.completed_at = None
    
    # Обновим исполнителей, если поле передано явно
    new_assignees: List[User] = []
    if task_data.assignees_ids is not None:
        previous_assignee_ids = {u.id for u in (task.assignees or [])}
        task.assignees.clear()
        if task_data.assignees_ids:
            users = db.query(User).filter(User.id.in_(task_data.assignees_ids)).all()
            for u in users:
                task.assignees.append(u)
            new_assignees = [u for u in users if u.id not in previous_assignee_ids]
    db.commit()
    db.refresh(task)
    if new_assignees:
        notify_new_assignees(task, current_user, new_assignees)
    return to_task_response(task)

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить задачу"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Проверяем доступ к рабочему пространству
    workspace = check_workspace_access(task.workspace_id, current_user, db)
    
    # Только владелец рабочего пространства или создатель задачи может удалить её
    if workspace.owner_id != current_user.id and task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only workspace owner or task creator can delete task")
    
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}

@workspace_router.patch("/{workspace_id}/tasks/{task_id}/toggle", response_model=TaskResponse)
def toggle_task(
    workspace_id: int,
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Переключить статус задачи (включить/выключить)"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    check_workspace_access(task.workspace_id, current_user, db)
    
    if task.status != "done":
        task.status = "done"
        task.completed_at = datetime.utcnow()
    else:
        task.status = "todo"
        task.completed_at = None
    
    db.commit()
    db.refresh(task)
    return to_task_response(task)

@router.post("/{task_id}/assignees", response_model=TaskResponse)
def set_task_assignees(
    task_id: int,
    assignees_data: TaskAssigneesRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Установить исполнителей задачи"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    check_workspace_access(task.workspace_id, current_user, db)
    previous_assignee_ids = {u.id for u in (task.assignees or [])}
    
    # Очищаем текущих исполнителей
    task.assignees.clear()
    
    # Добавляем новых
    new_assignees: List[User] = []
    if assignees_data.assignees_ids:
        users = db.query(User).filter(User.id.in_(assignees_data.assignees_ids)).all()
        for user in users:
            task.assignees.append(user)
        new_assignees = [user for user in users if user.id not in previous_assignee_ids]
    
    db.commit()
    db.refresh(task)
    if new_assignees:
        notify_new_assignees(task, current_user, new_assignees)
    return to_task_response(task)
