-- Добавление поля workspace_id в таблицу chats
ALTER TABLE chats ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id);
