from typing import Optional
import os
import mimetypes
import base64
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

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Set
import json
import asyncio
import shutil
import uuid
from datetime import datetime

from app.database.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.models.message import Message as ORMMessage, Chat as ORMChat, ChatMember as ORMChatMember
from app.schemas.message import (ChatCreateRequest, ChatUpdateRequest, ChatAddMembersRequest,
    Message as MessageSchema, MessageCreate, MessageUpdate,
    ChatSchema, ChatMemberSchema,
    UnreadCountResponse, RecentChatItem,
    MessageAuthor
)
from app.core.security import get_current_active_user, verify_token

router = APIRouter()
workspace_chat_router = APIRouter()

# Хранилище активных WebSocket соединений
class ConnectionManager:
    def __init__(self):
        self.personal_connections: Dict[int, Set[WebSocket]] = {}  # user_id -> active websockets
        self.group_connections: Dict[int, Dict[int, WebSocket]] = {}  # chat_id -> {user_id -> websocket}
    
    async def connect_personal(self, user_id: int, websocket: WebSocket):
        """Подключить личный чат"""
        was_offline = user_id not in self.personal_connections or not self.personal_connections[user_id]
        if user_id not in self.personal_connections:
            self.personal_connections[user_id] = set()
        self.personal_connections[user_id].add(websocket)
        await self.send_personal_message(
            {
                "type": "presence_snapshot",
                "user_ids": [uid for uid, sockets in self.personal_connections.items() if sockets],
            },
            user_id,
        )
        if was_offline:
            await self.broadcast_personal_presence(user_id, True, exclude_user_id=user_id)
    
    async def disconnect_personal(self, user_id: int, websocket: Optional[WebSocket] = None):
        """Отключить личный чат"""
        if user_id in self.personal_connections:
            if websocket is None:
                self.personal_connections[user_id].clear()
            else:
                self.personal_connections[user_id].discard(websocket)

            if not self.personal_connections[user_id]:
                del self.personal_connections[user_id]
                await self.broadcast_personal_presence(user_id, False)
    
    async def connect_group(self, chat_id: int, user_id: int, websocket: WebSocket):
        """Подключить к групповому чату"""
        if chat_id not in self.group_connections:
            self.group_connections[chat_id] = {}
        self.group_connections[chat_id][user_id] = websocket
    
    async def disconnect_group(self, chat_id: int, user_id: int):
        """Отключить от группового чата"""
        if chat_id in self.group_connections:
            if user_id in self.group_connections[chat_id]:
                del self.group_connections[chat_id][user_id]
            if not self.group_connections[chat_id]:
                del self.group_connections[chat_id]
    
    async def send_personal_message(self, message: dict, receiver_id: int):
        """Отправить личное сообщение"""
        if receiver_id in self.personal_connections:
            sockets = list(self.personal_connections[receiver_id])
            stale_sockets: List[WebSocket] = []
            for websocket in sockets:
                try:
                    await websocket.send_text(json.dumps(message))
                except:
                    stale_sockets.append(websocket)

            for websocket in stale_sockets:
                await self.disconnect_personal(receiver_id, websocket)

    async def broadcast_personal_presence(
        self,
        user_id: int,
        is_online: bool,
        exclude_user_id: int | None = None,
    ):
        payload = {
            "type": "presence",
            "user_id": user_id,
            "is_online": is_online,
        }
        receiver_ids = list(self.personal_connections.keys())
        for receiver_id in receiver_ids:
            if exclude_user_id is not None and receiver_id == exclude_user_id:
                continue
            await self.send_personal_message(payload, receiver_id)
    
    async def broadcast_to_group(self, message: dict, chat_id: int, sender_id: int = None):
        """Отправить сообщение всем в рабочем пространстве"""
        if chat_id in self.group_connections:
            # Создаем копию ключей, чтобы избежать ошибки изменения словаря во время итерации
            user_ids = list(self.group_connections[chat_id].keys())
            for user_id in user_ids:
                if sender_id is None or user_id != sender_id:  # Не отправляем отправителю если указан sender_id
                    websocket = self.group_connections[chat_id].get(user_id)
                    if websocket:
                        try:
                            await websocket.send_text(json.dumps(message))
                        except:
                            # Соединение закрыто, удаляем
                            await self.disconnect_group(chat_id, user_id)

manager = ConnectionManager()

def check_chat_access(chat_id: int, user: User, db: Session):
    """Проверяет доступ пользователя к чату"""
    chat = db.query(ORMChat).filter(ORMChat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    membership = db.query(ORMChatMember).filter(
        ORMChatMember.chat_id == chat_id,
        ORMChatMember.user_id == user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied to chat")
    
    return chat

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Загрузка файла (изображения)"""
    file_ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_ext}"
    upload_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)
        
    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/uploads/{filename}"}

@router.websocket("/ws")
async def websocket_personal_chat(websocket: WebSocket, token: str = Query(...)):
    """WebSocket для личного чата"""
    await websocket.accept()
    
    try:
        # Проверяем токен
        email = verify_token(token)
        if not email:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Получаем пользователя
        from app.database.database import SessionLocal
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                await websocket.close(code=1008, reason="User not found")
                return
            
            # Подключаем пользователя
            await manager.connect_personal(user.id, websocket)
            
            try:
                while True:
                    data = await websocket.receive_text()
                    message_data = json.loads(data)
                    
                    # Проверяем тип события, если есть
                    event_type = message_data.get("type", "message")
                    
                    if event_type == "message":
                        # Сохраняем сообщение в базу данных
                        message = ORMMessage(
                            content=message_data["content"],
                            sender_id=user.id,
                            receiver_id=message_data["receiver_id"],
                            attachments=json.dumps(message_data.get("attachments", [])) if message_data.get("attachments") else None,
                            reply_to_id=message_data.get("reply_to_id")
                        )
                        db.add(message)
                        db.commit()
                        db.refresh(message)

                        # Загружаем данные получателя
                        receiver = db.query(User).filter(User.id == message.receiver_id).first()
                        
                        # Загружаем ответ на сообщение, если есть
                        replied_message_data = None
                        if message.reply_to_id:
                            replied_msg = db.query(ORMMessage).filter(ORMMessage.id == message.reply_to_id).first()
                            if replied_msg:
                                replied_sender = db.query(User).filter(User.id == replied_msg.sender_id).first()
                                replied_message_data = {
                                    "id": replied_msg.id,
                                    "content": replied_msg.content,
                                    "is_edited": replied_msg.is_edited,
                                    "created_at": replied_msg.created_at.isoformat(),
                                    "sender": {
                                        "id": replied_sender.id,
                                        "name": replied_sender.name,
                                        "email": replied_sender.email,
                                        "avatar": _avatar_to_base64(replied_sender.avatar)
                                    } if replied_sender else None
                                }

                        attachments_list = json.loads(message.attachments) if message.attachments else []

                        # Формируем ответ
                        response = {
                            "type": "new_message",
                            "message": {
                                "id": message.id,
                                "temp_client_id": message_data.get("temp_client_id"),
                                "content": message.content,
                                "sender_id": message.sender_id,
                                "receiver_id": message.receiver_id,
                                "is_read": message.is_read,
                                "is_edited": message.is_edited,
                                "is_pinned": message.is_pinned,
                                "reply_to_id": message.reply_to_id,
                                "replied_message": replied_message_data,
                                "created_at": message.created_at.isoformat(),
                                "updated_at": message.updated_at.isoformat() if message.updated_at else None,
                                "attachments": attachments_list,
                                "sender": {
                                    "id": user.id,
                                    "name": user.name,
                                    "email": user.email,
                                    "avatar": _avatar_to_base64(user.avatar)
                                },
                                "receiver": {
                                    "id": receiver.id,
                                    "name": receiver.name,
                                    "email": receiver.email,
                                    "avatar": _avatar_to_base64(receiver.avatar)
                                } if receiver else None
                            }
                        }
                        
                        # Отправляем получателю
                        await manager.send_personal_message(response, message.receiver_id)
                        # Эхо отправителю
                        await manager.send_personal_message(response, message.sender_id)
                    
                    elif event_type == "typing":
                         # Пробрасываем событие набора текста
                        receiver_id = message_data.get("receiver_id")
                        if receiver_id:
                            await manager.send_personal_message({
                                "type": "typing",
                                "sender_id": user.id,
                                "is_typing": bool(message_data.get("is_typing", True)),
                            }, receiver_id)
                    
                    elif event_type == "presence_snapshot_request":
                        await manager.send_personal_message(
                            {
                                "type": "presence_snapshot",
                                "user_ids": [uid for uid, sockets in manager.personal_connections.items() if sockets],
                            },
                            user.id,
                        )

            except WebSocketDisconnect:
                pass
            finally:
                await manager.disconnect_personal(user.id, websocket)
                
        finally:
            db.close()
            
    except Exception as e:
        await websocket.close(code=1011, reason="Internal server error")

@router.websocket("/ws/{chat_id}")
async def websocket_workspace_chat(websocket: WebSocket, chat_id: int, token: str = Query(...)):
    """WebSocket для группового чата рабочего пространства"""
    await websocket.accept()
    
    try:
        # Проверяем токен
        email = verify_token(token)
        if not email:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Получаем пользователя и проверяем доступ
        from app.database.database import SessionLocal
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                await websocket.close(code=1008, reason="User not found")
                return
            
            # Проверяем доступ к рабочему пространству
            workspace = check_chat_access(chat_id, user, db)
            
            # Подключаем пользователя к чату
            await manager.connect_group(chat_id, user.id, websocket)
            
            try:
                while True:
                    data = await websocket.receive_text()
                    message_data = json.loads(data)
                    
                    event_type = message_data.get("type", "message")
                    
                    if event_type == "message":
                        # Сохраняем сообщение в базу данных
                        message = ORMMessage(
                            content=message_data["content"],
                            chat_id=chat_id,
                            sender_id=user.id,
                            attachments=json.dumps(message_data.get("attachments", [])) if message_data.get("attachments") else None,
                            reply_to_id=message_data.get("reply_to_id")
                        )
                        db.add(message)
                        db.commit()
                        db.refresh(message)
                        
                        # Загружаем ответ на сообщение, если есть
                        replied_message_data = None
                        if message.reply_to_id:
                            replied_msg = db.query(ORMMessage).filter(ORMMessage.id == message.reply_to_id).first()
                            if replied_msg:
                                replied_sender = db.query(User).filter(User.id == replied_msg.sender_id).first()
                                replied_message_data = {
                                    "id": replied_msg.id,
                                    "content": replied_msg.content,
                                    "is_edited": replied_msg.is_edited,
                                    "created_at": replied_msg.created_at.isoformat(),
                                    "sender": {
                                        "id": replied_sender.id,
                                        "name": replied_sender.name,
                                        "email": replied_sender.email,
                                        "avatar": _avatar_to_base64(replied_sender.avatar)
                                    } if replied_sender else None
                                }
                        
                        attachments_list = json.loads(message.attachments) if message.attachments else []
                        
                        # Формируем ответ
                        response = {
                            "type": "new_message",
                            "message": {
                                "id": message.id,
                                "temp_client_id": message_data.get("temp_client_id"),
                                "content": message.content,
                                "chat_id": message.chat_id,
                                "sender_id": message.sender_id,
                                "is_edited": message.is_edited,
                                "is_pinned": message.is_pinned,
                                "reply_to_id": message.reply_to_id,
                                "replied_message": replied_message_data,
                                "created_at": message.created_at.isoformat(),
                                "updated_at": message.updated_at.isoformat() if message.updated_at else None,
                                "attachments": attachments_list,
                                "sender": {
                                    "id": user.id,
                                    "name": user.name,
                                    "email": user.email,
                                    "avatar": _avatar_to_base64(user.avatar)
                                }
                            }
                        }
                        
                        # Отправляем всем участникам рабочего пространства
                        await manager.broadcast_to_group(response, chat_id, None) # None - отправляем всем, включая отправителя для единообразия
                    
                    elif event_type == "typing":
                        await manager.broadcast_to_group({
                            "type": "typing",
                            "sender_id": user.id,
                            "chat_id": chat_id,
                            "is_typing": bool(message_data.get("is_typing", True)),
                        }, chat_id, user.id)
                    
            except WebSocketDisconnect:
                pass
            finally:
                await manager.disconnect_group(chat_id, user.id)
                
        finally:
            db.close()
            
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))

@router.put("/messages/{message_id}", response_model=MessageSchema)
async def update_message(
    message_id: int,
    message_update: MessageUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Редактировать личное сообщение"""
    message = db.query(ORMMessage).filter(ORMMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if message.sender_id != current_user.id and not message_update.is_pinned is not None:
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")
        
    # Разрешаем изменять только is_pinned, если мы не автор
    if message.sender_id != current_user.id and message_update.is_pinned is not None:
        # Проверяем, что пытаются изменить только is_pinned
        if message_update.content is not None or message_update.attachments is not None:
            raise HTTPException(status_code=403, detail="Not authorized to edit this message's content")
        
    if message_update.content is not None:
        message.content = message_update.content
    
    if message_update.attachments is not None:
        message.attachments = json.dumps(message_update.attachments)

    previously_pinned_message = None
        
    if message_update.is_pinned is not None:
        if message_update.is_pinned:
            previously_pinned_message = (
                db.query(ORMMessage)
                .filter(
                    ORMMessage.id != message.id,
                    ORMMessage.chat_id.is_(None),
                    ORMMessage.sender_id.in_([message.sender_id, message.receiver_id]),
                    ORMMessage.receiver_id.in_([message.sender_id, message.receiver_id]),
                    ORMMessage.is_pinned == True,
                )
                .first()
            )
            if previously_pinned_message:
                previously_pinned_message.is_pinned = False
        message.is_pinned = message_update.is_pinned
        
    if message_update.content is not None or message_update.attachments is not None:
        message.is_edited = True
        
    db.commit()
    db.refresh(message)
    
    attachments_list = json.loads(message.attachments) if message.attachments else []
    previous_attachments_list = (
        json.loads(previously_pinned_message.attachments)
        if previously_pinned_message and previously_pinned_message.attachments
        else []
    )
    
    # Загружаем ответ на сообщение, если есть
    replied_message_data = None
    if message.reply_to_id:
        replied_msg = db.query(ORMMessage).filter(ORMMessage.id == message.reply_to_id).first()
        if replied_msg:
            replied_sender = db.query(User).filter(User.id == replied_msg.sender_id).first()
            replied_message_data = {
                "id": replied_msg.id,
                "content": replied_msg.content,
                "is_edited": replied_msg.is_edited,
                "created_at": replied_msg.created_at.isoformat(),
                "sender": {
                    "id": replied_sender.id,
                    "name": replied_sender.name,
                    "email": replied_sender.email,
                    "avatar": _avatar_to_base64(replied_sender.avatar)
                } if replied_sender else None
            }

    # Notify via WebSocket
    response = {
        "type": "message_update",
        "message": {
            "id": message.id,
            "content": message.content,
            "sender_id": message.sender_id,
            "receiver_id": message.receiver_id,
            "is_read": message.is_read,
            "is_edited": message.is_edited,
            "is_pinned": message.is_pinned,
            "reply_to_id": message.reply_to_id,
            "replied_message": replied_message_data,
            "created_at": message.created_at.isoformat(),
            "updated_at": message.updated_at.isoformat() if message.updated_at else None,
            "attachments": attachments_list
        }
    }

    previous_response = None
    if previously_pinned_message:
        previous_response = {
            "type": "message_update",
            "message": {
                "id": previously_pinned_message.id,
                "content": previously_pinned_message.content,
                "sender_id": previously_pinned_message.sender_id,
                "receiver_id": previously_pinned_message.receiver_id,
                "is_read": previously_pinned_message.is_read,
                "is_edited": previously_pinned_message.is_edited,
                "is_pinned": previously_pinned_message.is_pinned,
                "reply_to_id": previously_pinned_message.reply_to_id,
                "replied_message": None,
                "created_at": previously_pinned_message.created_at.isoformat(),
                "updated_at": previously_pinned_message.updated_at.isoformat() if previously_pinned_message.updated_at else None,
                "attachments": previous_attachments_list
            }
        }
    
    await manager.send_personal_message(response, message.receiver_id)
    await manager.send_personal_message(response, message.sender_id)
    if previous_response:
        await manager.send_personal_message(previous_response, message.receiver_id)
        await manager.send_personal_message(previous_response, message.sender_id)
    
    return MessageSchema(
        id=message.id,
        sender_id=message.sender_id,
        receiver_id=message.receiver_id,
        content=message.content,
        is_read=1 if message.is_read else 0,
        is_edited=message.is_edited,
        is_pinned=message.is_pinned,
        reply_to_id=message.reply_to_id,
        replied_message=replied_message_data,
        created_at=message.created_at.isoformat(),
        updated_at=message.updated_at.isoformat() if message.updated_at else None,
        attachments=attachments_list
    )

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить личное сообщение"""
    message = db.query(ORMMessage).filter(ORMMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    
    receiver_id = message.receiver_id
    sender_id = message.sender_id
    
    db.delete(message)
    db.commit()
    
    # Notify via WebSocket
    response = {
        "type": "message_delete",
        "message_id": message_id
    }
    
    await manager.send_personal_message(response, receiver_id)
    await manager.send_personal_message(response, sender_id)
    
    return {"status": "success"}

@router.put("/workspace-chat/messages/{message_id}", response_model=MessageSchema)
async def update_workspace_message(
    message_id: int,
    message_update: MessageUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Редактировать групповое сообщение"""
    message = db.query(ORMMessage).filter(ORMMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if message.sender_id != current_user.id and not message_update.is_pinned is not None:
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")
        
    # Разрешаем изменять только is_pinned, если мы не автор
    if message.sender_id != current_user.id and message_update.is_pinned is not None:
        # Проверяем, что пытаются изменить только is_pinned
        if message_update.content is not None or message_update.attachments is not None:
            raise HTTPException(status_code=403, detail="Not authorized to edit this message's content")
        
    if message_update.content is not None:
        message.content = message_update.content
    
    if message_update.attachments is not None:
        message.attachments = json.dumps(message_update.attachments)

    previously_pinned_message = None
        
    if message_update.is_pinned is not None:
        if message_update.is_pinned:
            previously_pinned_message = (
                db.query(ORMMessage)
                .filter(
                    ORMMessage.id != message.id,
                    ORMMessage.chat_id == message.chat_id,
                    ORMMessage.is_pinned == True,
                )
                .first()
            )
            if previously_pinned_message:
                previously_pinned_message.is_pinned = False
        message.is_pinned = message_update.is_pinned
        
    if message_update.content is not None or message_update.attachments is not None:
        message.is_edited = True
        
    db.commit()
    db.refresh(message)
    
    attachments_list = json.loads(message.attachments) if message.attachments else []
    previous_attachments_list = (
        json.loads(previously_pinned_message.attachments)
        if previously_pinned_message and previously_pinned_message.attachments
        else []
    )
    
    # Загружаем ответ на сообщение, если есть
    replied_message_data = None
    if message.reply_to_id:
        replied_msg = db.query(ORMMessage).filter(ORMMessage.id == message.reply_to_id).first()
        if replied_msg:
            replied_sender = db.query(User).filter(User.id == replied_msg.sender_id).first()
            replied_message_data = {
                "id": replied_msg.id,
                "content": replied_msg.content,
                "is_edited": replied_msg.is_edited,
                "created_at": replied_msg.created_at.isoformat(),
                "sender": {
                    "id": replied_sender.id,
                    "name": replied_sender.name,
                    "email": replied_sender.email,
                    "avatar": _avatar_to_base64(replied_sender.avatar)
                } if replied_sender else None
            }

    # Notify via WebSocket
    response = {
        "type": "message_update",
        "message": {
            "id": message.id,
            "content": message.content,
            "chat_id": message.chat_id,
            "sender_id": message.sender_id,
            "is_edited": message.is_edited,
            "is_pinned": message.is_pinned,
            "reply_to_id": message.reply_to_id,
            "replied_message": replied_message_data,
            "created_at": message.created_at.isoformat(),
            "updated_at": message.updated_at.isoformat() if message.updated_at else None,
            "attachments": attachments_list
        }
    }

    previous_response = None
    if previously_pinned_message:
        previous_response = {
            "type": "message_update",
            "message": {
                "id": previously_pinned_message.id,
                "content": previously_pinned_message.content,
                "chat_id": previously_pinned_message.chat_id,
                "sender_id": previously_pinned_message.sender_id,
                "is_edited": previously_pinned_message.is_edited,
                "is_pinned": previously_pinned_message.is_pinned,
                "reply_to_id": previously_pinned_message.reply_to_id,
                "replied_message": None,
                "created_at": previously_pinned_message.created_at.isoformat(),
                "updated_at": previously_pinned_message.updated_at.isoformat() if previously_pinned_message.updated_at else None,
                "attachments": previous_attachments_list
            }
        }
    
    await manager.broadcast_to_group(response, message.chat_id, None)
    if previous_response:
        await manager.broadcast_to_group(previous_response, message.chat_id, None)
    
    return MessageSchema(
        id=message.id,
        chat_id=message.chat_id,
        sender_id=message.sender_id,
        content=message.content,
        is_edited=message.is_edited,
        is_pinned=message.is_pinned,
        reply_to_id=message.reply_to_id,
        replied_message=replied_message_data,
        created_at=message.created_at.isoformat(),
        updated_at=message.updated_at.isoformat() if message.updated_at else None,
        attachments=attachments_list,
        sender=MessageAuthor(
            id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            avatar=_avatar_to_base64(current_user.avatar)
        )
    )

@router.delete("/workspace-chat/messages/{message_id}")
async def delete_workspace_message(
    message_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить групповое сообщение"""
    message = db.query(ORMMessage).filter(ORMMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    
    chat_id = message.chat_id
    
    db.delete(message)
    db.commit()
    
    # Notify via WebSocket
    response = {
        "type": "message_delete",
        "message_id": message_id,
        "chat_id": chat_id
    }
    
    await manager.broadcast_to_group(response, chat_id, None)
    
    return {"status": "success"}

from typing import List

@router.get("/messages/{user_id}", response_model=List[MessageSchema])
def get_chat_history(
    user_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    around: int = Query(None, description="ID сообщения, вокруг которого нужно загрузить историю"),
    before: int = Query(None, description="ID сообщения, до которого нужно загрузить более старые сообщения"),
    after: int = Query(None, description="ID сообщения, после которого нужно загрузить более новые сообщения"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить историю личных сообщений с пользователем"""
    query = db.query(ORMMessage).filter(
        ((ORMMessage.sender_id == current_user.id) & (ORMMessage.receiver_id == user_id)) |
        ((ORMMessage.sender_id == user_id) & (ORMMessage.receiver_id == current_user.id))
    )

    def newer_filter(target: ORMMessage):
        return (
            (ORMMessage.created_at > target.created_at) |
            ((ORMMessage.created_at == target.created_at) & (ORMMessage.id > target.id))
        )

    def older_filter(target: ORMMessage):
        return (
            (ORMMessage.created_at < target.created_at) |
            ((ORMMessage.created_at == target.created_at) & (ORMMessage.id < target.id))
        )
    
    if before is not None:
        target_message = query.filter(ORMMessage.id == before).first()
        if target_message:
            messages = query.filter(
                older_filter(target_message)
            ).order_by(ORMMessage.created_at.desc(), ORMMessage.id.desc()).limit(limit).all()
        else:
            messages = []
    elif after is not None:
        target_message = query.filter(ORMMessage.id == after).first()
        if target_message:
            messages = query.filter(
                newer_filter(target_message)
            ).order_by(ORMMessage.created_at.asc(), ORMMessage.id.asc()).limit(limit).all()
            messages.sort(key=lambda x: (x.created_at, x.id), reverse=True)
        else:
            messages = []
    elif around is not None:
        target_message = query.filter(ORMMessage.id == around).first()
        if target_message:
            older_target = limit // 2
            newer_target = limit - older_target - 1

            older = query.filter(
                older_filter(target_message)
            ).order_by(ORMMessage.created_at.desc(), ORMMessage.id.desc()).limit(older_target).all()
            newer = query.filter(
                newer_filter(target_message)
            ).order_by(ORMMessage.created_at.asc(), ORMMessage.id.asc()).limit(newer_target).all()

            if len(older) < older_target:
                newer = query.filter(
                    newer_filter(target_message)
                ).order_by(ORMMessage.created_at.asc(), ORMMessage.id.asc()).limit(
                    newer_target + (older_target - len(older))
                ).all()

            if len(newer) < newer_target:
                older = query.filter(
                    older_filter(target_message)
                ).order_by(ORMMessage.created_at.desc(), ORMMessage.id.desc()).limit(
                    older_target + (newer_target - len(newer))
                ).all()

            messages = older + [target_message] + newer
            messages.sort(key=lambda x: (x.created_at, x.id), reverse=True)
        else:
            messages = query.order_by(ORMMessage.created_at.desc()).offset(offset).limit(limit).all()
    else:
        messages = query.order_by(ORMMessage.created_at.desc()).offset(offset).limit(limit).all()
    
    def to_message_schema(message: ORMMessage) -> MessageSchema:
        replied_message_data = None
        if message.reply_to_id and getattr(message, 'replied_message', None):
            replied_sender = message.replied_message.sender
            replied_message_data = {
                "id": message.replied_message.id,
                "content": message.replied_message.content,
                "is_edited": message.replied_message.is_edited,
                "created_at": message.replied_message.created_at.isoformat() if hasattr(message.replied_message.created_at, 'isoformat') else str(message.replied_message.created_at),
                "sender": {
                    "id": replied_sender.id,
                    "name": replied_sender.name,
                    "email": replied_sender.email,
                    "avatar": _avatar_to_base64(replied_sender.avatar)
                } if replied_sender else None
            }

        return MessageSchema(
            id=message.id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            content=message.content,
            is_read=1 if message.is_read else 0,
            is_edited=message.is_edited,
            is_pinned=message.is_pinned,
            reply_to_id=message.reply_to_id,
            replied_message=replied_message_data,
            created_at=message.created_at.isoformat() if hasattr(message.created_at, 'isoformat') else str(message.created_at),
            updated_at=message.updated_at.isoformat() if message.updated_at and hasattr(message.updated_at, 'isoformat') else str(message.updated_at) if message.updated_at else None,
            attachments=json.loads(message.attachments) if message.attachments else []
        )
    
    return [to_message_schema(msg) for msg in messages]

@router.post("/messages", response_model=MessageSchema)
async def send_personal_message(
    payload: MessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отправить личное сообщение (REST)"""
    def to_message_schema(message: ORMMessage) -> MessageSchema:
        replied_message_data = None
        if message.reply_to_id and getattr(message, 'replied_message', None):
            replied_sender = message.replied_message.sender
            replied_message_data = {
                "id": message.replied_message.id,
                "content": message.replied_message.content,
                "is_edited": message.replied_message.is_edited,
                "created_at": message.replied_message.created_at.isoformat() if hasattr(message.replied_message.created_at, 'isoformat') else str(message.replied_message.created_at),
                "sender": {
                    "id": replied_sender.id,
                    "name": replied_sender.name,
                    "email": replied_sender.email,
                    "avatar": _avatar_to_base64(replied_sender.avatar)
                } if replied_sender else None
            }

        sender = message.sender if hasattr(message, "sender") else None
        receiver = message.receiver if hasattr(message, "receiver") else None

        return MessageSchema(
            id=message.id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            chat_id=message.chat_id,
            content=message.content,
            is_read=1 if message.is_read else 0,
            is_edited=message.is_edited,
            is_pinned=message.is_pinned,
            reply_to_id=message.reply_to_id,
            replied_message=replied_message_data,
            sender=MessageAuthor(
                id=sender.id,
                name=sender.name,
                email=sender.email,
                avatar=_avatar_to_base64(sender.avatar),
            ) if sender else None,
            receiver=MessageAuthor(
                id=receiver.id,
                name=receiver.name,
                email=receiver.email,
                avatar=_avatar_to_base64(receiver.avatar),
            ) if receiver else None,
            created_at=message.created_at.isoformat() if hasattr(message.created_at, 'isoformat') else str(message.created_at),
            updated_at=message.updated_at.isoformat() if message.updated_at and hasattr(message.updated_at, 'isoformat') else str(message.updated_at) if message.updated_at else None,
            attachments=json.loads(message.attachments) if message.attachments else []
        )

    # Создаём сообщение
    message = ORMMessage(
        content=payload.content,
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        attachments=json.dumps(payload.attachments) if payload.attachments else None
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    response_message = to_message_schema(message)

    await manager.send_personal_message(
        {
            "type": "new_message",
            "message": response_message.model_dump(),
        },
        message.receiver_id,
    )

    return response_message

@router.patch("/messages/{message_id}/read", response_model=MessageSchema)
def mark_message_as_read(
    message_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отметить сообщение как прочитанное"""
    message = db.query(ORMMessage).filter(ORMMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Только получатель может отметить сообщение как прочитанное
    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only receiver can mark message as read")
    
    message.is_read = True
    message.read_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    response = {
        "type": "message_read",
        "message": {
            "id": message.id,
            "sender_id": message.sender_id,
            "receiver_id": message.receiver_id,
            "is_read": 1 if message.is_read else 0,
            "updated_at": message.updated_at.isoformat() if message.updated_at and hasattr(message.updated_at, 'isoformat') else str(message.updated_at) if message.updated_at else None,
        }
    }

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.send_personal_message(response, message.sender_id))
        loop.create_task(manager.send_personal_message(response, message.receiver_id))
    except RuntimeError:
        asyncio.run(manager.send_personal_message(response, message.sender_id))
        asyncio.run(manager.send_personal_message(response, message.receiver_id))
    
    return MessageSchema(
        id=message.id,
        sender_id=message.sender_id,
        receiver_id=message.receiver_id,
        content=message.content,
        is_read=1 if message.is_read else 0,
        is_edited=message.is_edited,
        created_at=message.created_at.isoformat() if hasattr(message.created_at, 'isoformat') else str(message.created_at),
        updated_at=message.updated_at.isoformat() if message.updated_at and hasattr(message.updated_at, 'isoformat') else str(message.updated_at) if message.updated_at else None,
        attachments=json.loads(message.attachments) if message.attachments else []
    )

@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить количество непрочитанных сообщений"""
    count = db.query(ORMMessage).filter(
        ORMMessage.receiver_id == current_user.id,
        ORMMessage.is_read == False
    ).count()
    
    return count

@router.get("/messages/{user_id}/pinned", response_model=MessageSchema)
def get_pinned_personal_message(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить закрепленное сообщение в личном чате"""
    message = (
        db.query(ORMMessage)
        .filter(
            ORMMessage.chat_id.is_(None),
            ORMMessage.sender_id.in_([current_user.id, user_id]),
            ORMMessage.receiver_id.in_([current_user.id, user_id]),
            ORMMessage.is_pinned == True
        )
        .first()
    )
    def to_message_schema_local(msg: ORMMessage, db_session: Session) -> MessageSchema:
        replied_message_data = None
        if msg.reply_to_id and getattr(msg, 'replied_message', None):
            replied_sender = msg.replied_message.sender
            replied_message_data = {
                "id": msg.replied_message.id,
                "content": msg.replied_message.content,
                "is_edited": msg.replied_message.is_edited,
                "created_at": msg.replied_message.created_at.isoformat() if hasattr(msg.replied_message.created_at, 'isoformat') else str(msg.replied_message.created_at),
                "sender": {
                    "id": replied_sender.id if replied_sender else msg.replied_message.sender_id,
                    "name": replied_sender.name if replied_sender else None,
                    "email": replied_sender.email if replied_sender else "",
                    "avatar": _avatar_to_base64(replied_sender.avatar) if replied_sender else None
                } if replied_sender else None
            }

        sender = getattr(msg, "sender", None)
        receiver = getattr(msg, "receiver", None)

        return MessageSchema(
            id=msg.id,
            sender_id=msg.sender_id,
            receiver_id=msg.receiver_id,
            chat_id=msg.chat_id,
            content=msg.content,
            is_read=1 if msg.is_read else 0,
            is_edited=msg.is_edited,
            is_pinned=msg.is_pinned,
            reply_to_id=msg.reply_to_id,
            replied_message=replied_message_data,
            sender=MessageAuthor(
                id=sender.id,
                name=sender.name,
                email=sender.email,
                avatar=_avatar_to_base64(sender.avatar),
            ) if sender else None,
            receiver=MessageAuthor(
                id=receiver.id,
                name=receiver.name,
                email=receiver.email,
                avatar=_avatar_to_base64(receiver.avatar),
            ) if receiver else None,
            created_at=msg.created_at.isoformat() if hasattr(msg.created_at, 'isoformat') else str(msg.created_at),
            updated_at=msg.updated_at.isoformat() if msg.updated_at and hasattr(msg.updated_at, 'isoformat') else str(msg.updated_at) if msg.updated_at else None,
            attachments=json.loads(msg.attachments) if msg.attachments else []
        )

    if not message:
        raise HTTPException(status_code=404, detail="Pinned message not found")
    return to_message_schema_local(message, db)

@router.get("/messages/workspace/{chat_id}/pinned", response_model=MessageSchema)
def get_pinned_workspace_message(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить закрепленное сообщение в групповом чате"""
    check_chat_access(chat_id, current_user, db)
    message = (
        db.query(ORMMessage)
        .filter(
            ORMMessage.chat_id == chat_id,
            ORMMessage.is_pinned == True
        )
        .first()
    )
    
    def to_message_schema_local(msg: ORMMessage, db_session: Session) -> MessageSchema:
        replied_message_data = None
        if msg.reply_to_id and getattr(msg, 'replied_message', None):
            replied_sender = msg.replied_message.sender
            replied_message_data = {
                "id": msg.replied_message.id,
                "content": msg.replied_message.content,
                "is_edited": msg.replied_message.is_edited,
                "created_at": msg.replied_message.created_at.isoformat() if hasattr(msg.replied_message.created_at, 'isoformat') else str(msg.replied_message.created_at),
                "sender": {
                    "id": replied_sender.id if replied_sender else msg.replied_message.sender_id,
                    "name": replied_sender.name if replied_sender else None,
                    "email": replied_sender.email if replied_sender else "",
                    "avatar": _avatar_to_base64(replied_sender.avatar) if replied_sender else None
                } if replied_sender else None
            }

        sender = getattr(msg, "sender", None)
        receiver = getattr(msg, "receiver", None)

        return MessageSchema(
            id=msg.id,
            sender_id=msg.sender_id,
            receiver_id=msg.receiver_id,
            chat_id=msg.chat_id,
            content=msg.content,
            is_read=1 if msg.is_read else 0,
            is_edited=msg.is_edited,
            is_pinned=msg.is_pinned,
            reply_to_id=msg.reply_to_id,
            replied_message=replied_message_data,
            sender=MessageAuthor(
                id=sender.id,
                name=sender.name,
                email=sender.email,
                avatar=_avatar_to_base64(sender.avatar),
            ) if sender else None,
            receiver=MessageAuthor(
                id=receiver.id,
                name=receiver.name,
                email=receiver.email,
                avatar=_avatar_to_base64(receiver.avatar),
            ) if receiver else None,
            created_at=msg.created_at.isoformat() if hasattr(msg.created_at, 'isoformat') else str(msg.created_at),
            updated_at=msg.updated_at.isoformat() if msg.updated_at and hasattr(msg.updated_at, 'isoformat') else str(msg.updated_at) if msg.updated_at else None,
            attachments=json.loads(msg.attachments) if msg.attachments else []
        )
        
    if not message:
        raise HTTPException(status_code=404, detail="Pinned message not found")
    return to_message_schema_local(message, db)

@router.get("/messages/workspace/{chat_id}", response_model=List[MessageSchema])
def get_workspace_chat_history(
    chat_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    around: int = Query(None, description="ID сообщения, вокруг которого нужно загрузить историю"),
    before: int = Query(None, description="ID сообщения, до которого нужно загрузить более старые сообщения"),
    after: int = Query(None, description="ID сообщения, после которого нужно загрузить более новые сообщения"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить историю группового чата"""
    # Проверяем доступ
    workspace = check_chat_access(chat_id, current_user, db)
    
    query = db.query(ORMMessage).filter(
        ORMMessage.chat_id == chat_id
    )

    def newer_filter(target: ORMMessage):
        return (
            (ORMMessage.created_at > target.created_at) |
            ((ORMMessage.created_at == target.created_at) & (ORMMessage.id > target.id))
        )

    def older_filter(target: ORMMessage):
        return (
            (ORMMessage.created_at < target.created_at) |
            ((ORMMessage.created_at == target.created_at) & (ORMMessage.id < target.id))
        )
    
    if before is not None:
        target_message = query.filter(ORMMessage.id == before).first()
        if target_message:
            messages = query.filter(
                older_filter(target_message)
            ).order_by(ORMMessage.created_at.desc(), ORMMessage.id.desc()).limit(limit).all()
        else:
            messages = []
    elif after is not None:
        target_message = query.filter(ORMMessage.id == after).first()
        if target_message:
            messages = query.filter(
                newer_filter(target_message)
            ).order_by(ORMMessage.created_at.asc(), ORMMessage.id.asc()).limit(limit).all()
            messages.sort(key=lambda x: (x.created_at, x.id), reverse=True)
        else:
            messages = []
    elif around is not None:
        target_message = query.filter(ORMMessage.id == around).first()
        if target_message:
            older_target = limit // 2
            newer_target = limit - older_target - 1

            older = query.filter(
                older_filter(target_message)
            ).order_by(ORMMessage.created_at.desc(), ORMMessage.id.desc()).limit(older_target).all()
            newer = query.filter(
                newer_filter(target_message)
            ).order_by(ORMMessage.created_at.asc(), ORMMessage.id.asc()).limit(newer_target).all()

            if len(older) < older_target:
                newer = query.filter(
                    newer_filter(target_message)
                ).order_by(ORMMessage.created_at.asc(), ORMMessage.id.asc()).limit(
                    newer_target + (older_target - len(older))
                ).all()

            if len(newer) < newer_target:
                older = query.filter(
                    older_filter(target_message)
                ).order_by(ORMMessage.created_at.desc(), ORMMessage.id.desc()).limit(
                    older_target + (newer_target - len(newer))
                ).all()

            messages = older + [target_message] + newer
            messages.sort(key=lambda x: (x.created_at, x.id), reverse=True)
        else:
            messages = query.order_by(ORMMessage.created_at.desc()).offset(offset).limit(limit).all()
    else:
        messages = query.order_by(ORMMessage.created_at.desc()).offset(offset).limit(limit).all()
    
    def to_workspace_message_schema(wm: ORMMessage) -> MessageSchema:
        replied_message_data = None
        if wm.reply_to_id and getattr(wm, 'replied_message', None):
            replied_sender = wm.replied_message.sender
            replied_message_data = {
                "id": wm.replied_message.id,
                "content": wm.replied_message.content,
                "is_edited": wm.replied_message.is_edited,
                "created_at": wm.replied_message.created_at.isoformat() if hasattr(wm.replied_message.created_at, 'isoformat') else str(wm.replied_message.created_at),
                "sender": {
                    "id": replied_sender.id if replied_sender else wm.replied_message.sender_id,
                    "name": replied_sender.name if replied_sender else None,
                    "email": replied_sender.email if replied_sender else "",
                    "avatar": _avatar_to_base64(replied_sender.avatar) if replied_sender else None
                } if replied_sender else None
            }

        return MessageSchema(
            id=wm.id,
            chat_id=wm.chat_id,
            sender_id=wm.sender_id,
            content=wm.content,
            is_read=wm.is_read,
            is_edited=wm.is_edited,
            is_pinned=wm.is_pinned,
            reply_to_id=wm.reply_to_id,
            replied_message=replied_message_data,
            created_at=wm.created_at.isoformat() if hasattr(wm.created_at, 'isoformat') else str(wm.created_at),
            updated_at=wm.updated_at.isoformat() if wm.updated_at and hasattr(wm.updated_at, 'isoformat') else str(wm.updated_at) if wm.updated_at else None,
            attachments=json.loads(wm.attachments) if wm.attachments else [],
            sender=MessageAuthor(
                id=wm.sender.id if getattr(wm, 'sender', None) else wm.sender_id,
                name=getattr(wm.sender, 'name', None) if getattr(wm, 'sender', None) else None,
                email=getattr(wm.sender, 'email', None) if getattr(wm, 'sender', None) else "",
                avatar=_avatar_to_base64(getattr(wm.sender, 'avatar', None)) if getattr(wm, 'sender', None) else None
            )
        )
    
    return [to_workspace_message_schema(wm) for wm in messages]

# Aliases under workspace_chat_router to match frontend paths: /workspace-chat/messages/{chat_id}
@workspace_chat_router.get("/messages/{chat_id}", response_model=List[MessageSchema])
def get_workspace_chat_history_alias(
    chat_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    around: int = Query(None, description="ID сообщения, вокруг которого нужно загрузить историю"),
    after: int = Query(None, description="ID сообщения, после которого нужно загрузить более новые сообщения"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_workspace_chat_history(chat_id, limit, offset, around, after, current_user, db)

# WS alias: /workspace-chat/ws/{chat_id}
@workspace_chat_router.websocket("/ws/{chat_id}")
async def websocket_workspace_chat_alias(websocket: WebSocket, chat_id: int, token: str = Query(...)):
    return await websocket_workspace_chat(websocket, chat_id, token)

@router.post("/group", response_model=ChatSchema)
def create_group_chat(
    payload: ChatCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Определяем текущий workspace пользователя (для простоты берем первый)
    from app.models.workspace import Workspace, WorkspaceMember
    user_workspace = db.query(Workspace).join(WorkspaceMember).filter(
        WorkspaceMember.user_id == current_user.id
    ).first()
    
    chat = ORMChat(
        name=payload.name, 
        is_group=True,
        workspace_id=user_workspace.id if user_workspace else None
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)

    creator_member = ORMChatMember(chat_id=chat.id, user_id=current_user.id)
    db.add(creator_member)

    for user_id in payload.user_ids:
        if user_id != current_user.id:
            member = ORMChatMember(chat_id=chat.id, user_id=user_id)
            db.add(member)
            
    db.commit()
    db.refresh(chat)
    return chat

@router.get("/group/{chat_id}", response_model=ChatSchema)
def get_group_chat(chat_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return check_chat_access(chat_id, current_user, db)

@router.put("/group/{chat_id}", response_model=ChatSchema)
def update_group_chat(chat_id: int, payload: ChatUpdateRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    chat = check_chat_access(chat_id, current_user, db)
    chat.name = payload.name
    db.commit()
    db.refresh(chat)
    return chat

@router.post("/group/{chat_id}/members", response_model=ChatSchema)
def add_chat_members(chat_id: int, payload: ChatAddMembersRequest, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    chat = check_chat_access(chat_id, current_user, db)
    existing_members = {m.user_id for m in chat.members}
    
    for user_id in payload.user_ids:
        if user_id not in existing_members:
            member = ORMChatMember(chat_id=chat.id, user_id=user_id)
            db.add(member)
            existing_members.add(user_id)
            
    db.commit()
    db.refresh(chat)
    return chat

@router.delete("/group/{chat_id}/members/{user_id}")
def remove_chat_member(chat_id: int, user_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    chat = check_chat_access(chat_id, current_user, db)
    member = db.query(ORMChatMember).filter(ORMChatMember.chat_id == chat_id, ORMChatMember.user_id == user_id).first()
    if member:
        db.delete(member)
        db.commit()
    return {"status": "success"}

@router.get("/recent", response_model=List[RecentChatItem])
def get_recent_chats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список недавних чатов"""
    recent_map: dict[str, RecentChatItem] = {}
    
    # Получаем недавние личные сообщения
    personal_messages = db.query(ORMMessage).filter(
        ((ORMMessage.sender_id == current_user.id) | (ORMMessage.receiver_id == current_user.id)),
        ORMMessage.chat_id.is_(None)
    ).order_by(ORMMessage.created_at.desc()).limit(10).all()
    
    for msg in personal_messages:
        other_user_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        other_user = db.query(User).filter(User.id == other_user_id).first()
        
        if other_user:
            key = f"user-{other_user_id}"
            existing = recent_map.get(key)
            if not existing or (existing.last_activity_at or datetime.min) < msg.created_at:
                # Определяем workspace пользователя (для простоты берем основной workspace)
                # В будущем можно будет хранить workspace_id в сообщениях
                from app.models.workspace import Workspace
                user_workspace = db.query(Workspace).join(WorkspaceMember).filter(
                    WorkspaceMember.user_id == other_user_id
                ).first()
                
                recent_map[key] = RecentChatItem(
                    id=key,
                    type="personal",
                    user_id=other_user_id,
                    name=other_user.name or other_user.email,
                    avatar=_avatar_to_base64(other_user.avatar),
                    last_activity_at=msg.created_at,
                    workspace_id=user_workspace.id if user_workspace else None
                )
    
    # Получаем групповые чаты пользователя
    member_chats = db.query(ORMChat).join(ORMChatMember).filter(
        ORMChatMember.user_id == current_user.id
    ).all()
    
    # Для групповых чатов получаем время последнего сообщения
    chat_last_msg = {}
    if member_chats:
        chat_ids = [c.id for c in member_chats]
        if chat_ids:
            last_chat_messages = db.query(ORMMessage.chat_id, func.max(ORMMessage.created_at).label('last_at')).filter(
                ORMMessage.chat_id.in_(chat_ids)
            ).group_by(ORMMessage.chat_id).all()
            chat_last_msg = {row.chat_id: row.last_at for row in last_chat_messages}
    
    for chat in member_chats:
        key = f"chat-{chat.id}"
        if key not in recent_map:
            recent_map[key] = RecentChatItem(
                id=key,
                type="group",
                chat_id=chat.id,
                name=chat.name or "Групповой чат",
                last_activity_at=chat_last_msg.get(chat.id),
                workspace_id=chat.workspace_id
            )
    
    # Сортируем по времени активности
    recent_list = list(recent_map.values())
    recent_list.sort(key=lambda x: x.last_activity_at or datetime.min, reverse=True)
    return recent_list[:20]

@router.get("/all", response_model=List[RecentChatItem])
def get_all_chats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить список всех чатов пользователя (включая всех пользователей)"""
    all_chats: dict[str, RecentChatItem] = {}
    
    # Получаем всех пользователей системы, кроме текущего
    all_users = db.query(User).filter(User.id != current_user.id).all()
    
    for user in all_users:
        # Определяем workspace пользователя
        from app.models.workspace import Workspace
        user_workspace = db.query(Workspace).join(WorkspaceMember).filter(
            WorkspaceMember.user_id == user.id
        ).first()
        
        # Получаем последнее сообщение с этим пользователем (если есть)
        last_msg = db.query(ORMMessage).filter(
            ((ORMMessage.sender_id == current_user.id) & (ORMMessage.receiver_id == user.id)) |
            ((ORMMessage.sender_id == user.id) & (ORMMessage.receiver_id == current_user.id)),
            ORMMessage.chat_id.is_(None)
        ).order_by(ORMMessage.created_at.desc()).first()
        
        all_chats[f"user-{user.id}"] = RecentChatItem(
            id=f"user-{user.id}",
            type="personal",
            user_id=user.id,
            name=user.name or user.email,
            avatar=_avatar_to_base64(user.avatar),
            last_activity_at=last_msg.created_at if last_msg else None,
            workspace_id=user_workspace.id if user_workspace else None
        )
    
    # Получаем групповые чаты пользователя (если есть логика "all", тоже проверим)
    member_chats = db.query(ORMChat).join(ORMChatMember).filter(
        ORMChatMember.user_id == current_user.id
    ).all()
    
    chat_last_msg = {}
    if member_chats:
        chat_ids = [c.id for c in member_chats]
        if chat_ids:
            last_chat_messages = db.query(ORMMessage.chat_id, func.max(ORMMessage.created_at).label('last_at')).filter(
                ORMMessage.chat_id.in_(chat_ids)
            ).group_by(ORMMessage.chat_id).all()
            chat_last_msg = {row.chat_id: row.last_at for row in last_chat_messages}
            
    for chat in member_chats:
        all_chats[f"chat-{chat.id}"] = RecentChatItem(
            id=f"chat-{chat.id}",
            type="group",
            chat_id=chat.id,
            name=chat.name or "Групповой чат",
            last_activity_at=chat_last_msg.get(chat.id),
            workspace_id=chat.workspace_id
        )
    
    # Сортируем: сначала по активности, затем пользователей без активности в конец
    all_list = list(all_chats.values())
    all_list.sort(key=lambda x: (x.last_activity_at is None, x.last_activity_at or datetime.min), reverse=True)
    return all_list
