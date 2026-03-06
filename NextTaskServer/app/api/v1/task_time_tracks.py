from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.task_time_track import TaskTimeTrack
from app.schemas.task_time_track import TaskTimeTrackCreate, TaskTimeTrackResponse
from pydantic import BaseModel
from app.core.security import get_current_active_user
from app.api.v1.tasks import check_workspace_access, _avatar_to_base64

router = APIRouter()

class TaskTimeTrackUpdate(BaseModel):
    comment: str
    time_spent: int | None = None

def to_time_track_response(track: TaskTimeTrack) -> TaskTimeTrackResponse:
    user_dict = None
    if track.user:
        user_dict = {
            "id": track.user.id,
            "email": track.user.email,
            "name": track.user.name,
            "position": track.user.position,
            "avatar": _avatar_to_base64(track.user.avatar),
            "is_active": track.user.is_active,
            "created_at": track.user.created_at,
            "updated_at": track.user.updated_at
        }
    
    return TaskTimeTrackResponse(
        id=track.id,
        task_id=track.task_id,
        user_id=track.user_id,
        time_spent=track.time_spent,
        comment=track.comment,
        created_at=track.created_at,
        user=user_dict
    )

@router.get("/{task_id}/time-tracks", response_model=List[TaskTimeTrackResponse])
def get_task_time_tracks(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить историю затраченного времени по задаче"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    check_workspace_access(task.workspace_id, current_user, db)
    
    tracks = db.query(TaskTimeTrack).filter(TaskTimeTrack.task_id == task_id).order_by(TaskTimeTrack.created_at.desc()).all()
    return [to_time_track_response(t) for t in tracks]

@router.post("/{task_id}/time-tracks", response_model=TaskTimeTrackResponse)
def add_task_time_track(
    task_id: int,
    track_data: TaskTimeTrackCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Добавить запись о затраченном времени"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    check_workspace_access(task.workspace_id, current_user, db)
    
    # Создаем запись
    new_track = TaskTimeTrack(
        task_id=task_id,
        user_id=current_user.id,
        time_spent=track_data.time_spent,
        comment=track_data.comment
    )
    
    db.add(new_track)
    
    # Обновляем общее время в задаче
    task.time_spent = (task.time_spent or 0) + track_data.time_spent
    
    db.commit()
    db.refresh(new_track)
    
    return to_time_track_response(new_track)

@router.put("/{task_id}/time-tracks/{track_id}", response_model=TaskTimeTrackResponse)
def update_task_time_track(
    task_id: int,
    track_id: int,
    track_data: TaskTimeTrackUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить комментарий в записи о затраченном времени"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    check_workspace_access(task.workspace_id, current_user, db)
    
    track = db.query(TaskTimeTrack).filter(
        TaskTimeTrack.id == track_id,
        TaskTimeTrack.task_id == task_id
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Time track not found")
    
    # Проверяем, что пользователь может редактировать только свои треки
    if track.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only edit your own time tracks")
    
    # Обновляем комментарий
    track.comment = track_data.comment
    
    # Если передано новое время, обновляем его и общее время задачи
    if track_data.time_spent is not None:
        old_time_spent = track.time_spent
        track.time_spent = track_data.time_spent
        
        # Обновляем общее время в задаче
        task.time_spent = (task.time_spent or 0) - old_time_spent + track_data.time_spent
    
    db.commit()
    db.refresh(track)
    
    return to_time_track_response(track)

@router.delete("/{task_id}/time-tracks/{track_id}")
def delete_task_time_track(
    task_id: int,
    track_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить запись о затраченном времени"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    check_workspace_access(task.workspace_id, current_user, db)
    
    track = db.query(TaskTimeTrack).filter(
        TaskTimeTrack.id == track_id,
        TaskTimeTrack.task_id == task_id
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Time track not found")
    
    # Проверяем, что пользователь может удалять только свои треки
    if track.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own time tracks")
    
    # Обновляем общее время в задаче
    task.time_spent = (task.time_spent or 0) - track.time_spent
    
    # Удаляем трек
    db.delete(track)
    db.commit()
    
    return {"message": "Time track deleted successfully"}
