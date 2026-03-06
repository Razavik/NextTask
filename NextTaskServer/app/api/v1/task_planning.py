from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List
from datetime import date

from app.database.database import get_db
from app.models.user import User
from app.models.task import Task, task_assignees
from app.models.task_plan import TaskPlan
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.task_plan import (
    TaskPlanCreate,
    TaskPlanUpdate,
    TaskPlanResponse,
    PlanningTaskOptionResponse,
)
from app.schemas.user import UserResponse
from app.core.security import get_current_active_user
from app.api.v1.tasks import check_workspace_access

router = APIRouter()


def get_accessible_workspace_ids(current_user: User, db: Session) -> List[int]:
    owner_workspace_ids = [
        workspace_id
        for (workspace_id,) in db.query(Workspace.id)
        .filter(Workspace.owner_id == current_user.id)
        .all()
    ]
    member_workspace_ids = [
        workspace_id
        for (workspace_id,) in db.query(WorkspaceMember.workspace_id)
        .filter(WorkspaceMember.user_id == current_user.id)
        .all()
    ]
    return list(set(owner_workspace_ids + member_workspace_ids))


@router.get("/planning", response_model=List[TaskPlanResponse])
def get_global_planning(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user_id: int = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Получить план времени по всем доступным рабочим пространствам"""
    workspace_ids = get_accessible_workspace_ids(current_user, db)
    if not workspace_ids:
        return []

    query = db.query(TaskPlan).filter(
        TaskPlan.workspace_id.in_(workspace_ids),
        TaskPlan.date >= start_date,
        TaskPlan.date <= end_date,
    )

    if user_id:
        query = query.filter(TaskPlan.user_id == user_id)

    return query.all()


@router.get("/planning/users", response_model=List[UserResponse])
def get_planning_users(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Получить пользователей, доступных для планирования"""
    workspace_ids = get_accessible_workspace_ids(current_user, db)
    if not workspace_ids:
        return []

    # Получаем ID всех пользователей, которые являются исполнителями в задачах,
    # где текущий пользователь является создателем (постановщиком)
    assignee_ids = [
        user_id
        for (user_id,) in db.query(task_assignees.c.user_id)
        .join(Task, Task.id == task_assignees.c.task_id)
        .filter(Task.creator_id == current_user.id)
        .distinct()
        .all()
    ]

    # Добавляем самого пользователя, чтобы он мог планировать время и себе
    allowed_user_ids = set(assignee_ids)
    allowed_user_ids.add(current_user.id)

    users = (
        db.query(User)
        .filter(User.id.in_(allowed_user_ids))
        .order_by(User.name.asc().nulls_last(), User.email.asc())
        .all()
    )
    return users


@router.get("/planning/tasks", response_model=List[PlanningTaskOptionResponse])
def get_planning_tasks(
    user_id: int = Query(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Получить задачи исполнителя в доступных пространствах"""
    workspace_ids = get_accessible_workspace_ids(current_user, db)
    if not workspace_ids:
        return []

    tasks = (
        db.query(Task)
        .filter(
            Task.workspace_id.in_(workspace_ids),
            Task.assignees.any(User.id == user_id),
        )
        .order_by(Task.created_at.desc())
        .all()
    )

    return [
        {
            "id": task.id,
            "title": task.title,
            "workspace_id": task.workspace_id,
        }
        for task in tasks
    ]

@router.get("/workspaces/{workspace_id}/planning", response_model=List[TaskPlanResponse])
def get_workspace_planning(
    workspace_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    user_id: int = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить план времени для рабочего пространства в заданном диапазоне дат"""
    check_workspace_access(workspace_id, current_user, db)

    query = db.query(TaskPlan).filter(
        TaskPlan.workspace_id == workspace_id,
        TaskPlan.date >= start_date,
        TaskPlan.date <= end_date
    )

    if user_id:
        query = query.filter(TaskPlan.user_id == user_id)

    plans = query.all()
    return plans

@router.post("/tasks/{task_id}/planning", response_model=TaskPlanResponse)
def create_task_plan(
    task_id: int,
    plan_data: TaskPlanCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Запланировать время на задачу для пользователя"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    check_workspace_access(task.workspace_id, current_user, db)

    # Проверка лимита в 8 часов на день для пользователя
    total_hours_day = db.query(func.sum(TaskPlan.hours)).filter(
        TaskPlan.user_id == plan_data.user_id,
        TaskPlan.date == plan_data.date
    ).scalar() or 0

    if total_hours_day + plan_data.hours > 8:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot schedule more than 8 hours per day. Current scheduled: {total_hours_day}h"
        )

    new_plan = TaskPlan(
        task_id=task_id,
        user_id=plan_data.user_id,
        workspace_id=task.workspace_id,
        created_by_id=current_user.id,
        date=plan_data.date,
        hours=plan_data.hours
    )

    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)

    return new_plan

@router.put("/planning/{plan_id}", response_model=TaskPlanResponse)
def update_task_plan(
    plan_id: int,
    plan_data: TaskPlanUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить запланированное время"""
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    check_workspace_access(plan.workspace_id, current_user, db)

    if plan_data.hours is not None:
        # Проверка лимита
        total_hours_day = db.query(func.sum(TaskPlan.hours)).filter(
            TaskPlan.user_id == plan.user_id,
            TaskPlan.date == plan.date,
            TaskPlan.id != plan_id
        ).scalar() or 0

        if total_hours_day + plan_data.hours > 8:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot schedule more than 8 hours per day. Current scheduled other tasks: {total_hours_day}h"
            )
            
        plan.hours = plan_data.hours

    db.commit()
    db.refresh(plan)
    return plan

@router.delete("/planning/{plan_id}")
def delete_task_plan(
    plan_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить запланированное время"""
    plan = db.query(TaskPlan).filter(TaskPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    check_workspace_access(plan.workspace_id, current_user, db)

    db.delete(plan)
    db.commit()
    
    return {"status": "success", "message": "Plan deleted successfully"}
