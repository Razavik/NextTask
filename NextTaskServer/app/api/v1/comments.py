from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import os
import base64
import mimetypes

from app.database.database import get_db
from app.models.user import User
from app.models.task import Task
from app.models.workspace import Workspace, WorkspaceMember
from app.models.comment import Comment
from app.schemas.comment import (
    CommentCreate, CommentUpdate, CommentResponse,
    CommentAuthor
)
from app.core.security import get_current_active_user

router = APIRouter()

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

def check_task_access(task_id: int, user: User, db: Session) -> Task:
    """Проверяет доступ пользователя к задаче"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Владелец рабочего пространства?
    is_owner = db.query(Workspace.id).filter(
        Workspace.id == task.workspace_id,
        Workspace.owner_id == user.id
    ).first() is not None
    if is_owner:
        return task
    
    # Участник рабочего пространства?
    is_member = db.query(WorkspaceMember.id).filter(
        WorkspaceMember.workspace_id == task.workspace_id,
        WorkspaceMember.user_id == user.id
    ).first() is not None
    if not is_member:
        raise HTTPException(status_code=403, detail="Access denied to task")
    
    return task

@router.get("/{task_id}/comments", response_model=List[CommentResponse])
def get_task_comments(
    task_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    order: str = Query("desc", regex="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить комментарии задачи"""
    task = check_task_access(task_id, current_user, db)
    
    query = db.query(Comment).filter(Comment.task_id == task_id)
    
    # Сортировка
    if order == "asc":
        query = query.order_by(Comment.created_at.asc())
    else:
        query = query.order_by(Comment.created_at.desc())
    
    comments = query.offset(offset).limit(limit).all()
    
    def to_comment_response(comment: Comment) -> CommentResponse:
        return CommentResponse(
            id=comment.id,
            content=comment.content,
            task_id=comment.task_id,
            author_id=comment.author_id,
            author=CommentAuthor(
                id=comment.author.id,
                name=comment.author.name,
                email=comment.author.email,
                avatar=_avatar_to_base64(comment.author.avatar)
            ),
            created_at=comment.created_at,
            updated_at=comment.updated_at
        )
    
    return [to_comment_response(comment) for comment in comments]

@router.get("/{task_id}/comments/count")
def get_task_comments_count(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить количество комментариев задачи"""
    task = check_task_access(task_id, current_user, db)
    
    count = db.query(func.count(Comment.id)).filter(Comment.task_id == task_id).scalar()
    return count

@router.post("/{task_id}/comments", response_model=CommentResponse)
def create_comment(
    task_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать комментарий к задаче"""
    task = check_task_access(task_id, current_user, db)
    
    comment = Comment(
        content=comment_data.content,
        task_id=task_id,
        author_id=current_user.id
    )
    
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author=CommentAuthor(
            id=comment.author.id,
            name=comment.author.name,
            email=comment.author.email,
            avatar=_avatar_to_base64(comment.author.avatar)
        ),
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )

@router.patch("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: int,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Обновить комментарий"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Только автор может редактировать комментарий
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only author can edit comment")
    
    comment.content = comment_data.content
    db.commit()
    db.refresh(comment)
    
    return CommentResponse(
        id=comment.id,
        content=comment.content,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author=CommentAuthor(
            id=comment.author.id,
            name=comment.author.name,
            email=comment.author.email,
            avatar=_avatar_to_base64(comment.author.avatar)
        ),
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )

@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить комментарий"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Проверяем права: автор или владелец рабочего пространства может удалить
    task = db.query(Task).filter(Task.id == comment.task_id).first()
    workspace = db.query(Workspace).filter(Workspace.id == task.workspace_id).first()
    
    if comment.author_id != current_user.id and workspace.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="Only author or workspace owner can delete comment"
        )
    
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted successfully"}
