# NextTask React Frontend

> Карта сайта и структура переноса из Laravel во фронтенд React и бэкенд Python.  
> Все изменения структуры фиксируются здесь.

## Сайт-мап

- `/login` – страница входа
- `/register` – регистрация
- `/workspaces` – список рабочих пространств пользователя
    - `/workspaces/create` – создание пространства
    - `/workspaces/{workspace}` – детали пространства: список задач
        - `/tasks/{task}/edit` – редактирование задачи
    - `/workspaces/{workspace}/admin` – админ-панель пространства (роль owner)
        - изменение имени
        - управление пользователями
- `/invite/{token}` – публичная страница приглашения

## API (Laravel → Python)

| Метод  | URL                                 | Описание             |
| ------ | ----------------------------------- | -------------------- |
| POST   | /login                              | Вход                 |
| POST   | /register                           | Регистрация          |
| POST   | /logout                             | Выход                |
| GET    | /workspaces                         | Список пространств   |
| POST   | /workspaces                         | Создать пространство |
| GET    | /workspaces/{id}                    | Детали пространства  |
| POST   | /workspaces/{id}/tasks              | Создать задачу       |
| PUT    | /tasks/{id}                         | Обновить задачу      |
| DELETE | /tasks/{id}                         | Удалить задачу       |
| POST   | /tasks/{id}/status                  | Обновить статус      |
| POST   | /tasks/{id}/notes                   | Добавить заметку     |
| DELETE | /notes/{id}                         | Удалить заметку      |
| GET    | /workspaces/{id}/invitations        | Форма приглашения    |
| DELETE | /invitations/{id}                   | Отозвать приглашение |
| GET    | /workspaces/{id}/admin              | Админ-панель         |
| PUT    | /workspaces/{id}/admin/name         | Переименовать        |
| PUT    | /workspaces/{id}/admin/users/{user} | Изменить роль        |
| DELETE | /workspaces/{id}/admin/users/{user} | Удалить пользователя |
| GET    | /invite/{token}                     | Просмотр приглашения |
| POST   | /invite/{token}/accept              | Принять приглашение  |

---

## Архитектура фронтенда (NextTask, FSD)

Проект переведён на Feature-Sliced Design и Zustand + React Query.

- **`src/app`** — входные точки, провайдеры и роутинг.
    - `app/App.tsx` — корневой компонент, настраивает `BrowserRouter`, `QueryClientProvider`, глобальные `ToastContainer` и `ChatContainer`.
    - `app/routes` — публичные/защищённые маршруты через `ProtectedRoute`.
    - `app/providers` — инфраструктурные провайдеры (`queryClient`, `ThemeProvider`, `ProtectedRoute`).
- **`src/shared`** — общее:
    - `shared/ui` — UI‑кит (кнопки, модалки, инпуты, тосты и т.д.).
    - `shared/model` — общие Zustand‑сторы (toast).
    - `shared/lib/hooks` — общие хуки (`useTheme`, `useToast`, `useAuth`).
    - `shared/api` — axios‑инстанс с auth‑интерцепторами.
    - `shared/types`, `shared/styles`, `shared/constants`, `shared/assets`.
- **`src/entities`** — доменные сущности (user, workspace, task, comment, chat) с `model` и баррелями `index.ts`.
- **`src/features`** — бизнес‑фичи (auth, invites, task-comments, task-edit) с баррелями `index.ts`.
- **`src/widgets`** — составные блоки (Layout, Sidebar, Chat, ChatContainer, WorkspaceHeader и т.д.).
- **`src/pages`** — страницы приложения (Workspaces, WorkspaceDetails, Task, WorkspaceSettings, Invite, Profile).

## Журнал миграции/аудита

- Перевод архитектуры на FSD: `app/shared/entities/features/widgets/pages`.
- Стор на Zustand; Redux удалён.
- Общие компоненты перенесены в `shared/ui`.
- Баррели добавлены в `entities/*` и `features/*`.
- Алиасы обновлены в `tsconfig` и `vite.config`.
- Очищены старые слои: `components/`, `store/`, `services/`, `hooks/`.

### Рефакторинг компонентов (хуки, разделение ответственности)

- **Chat** (`widgets/Chat`):
    - `useChatPosition` — позиционирование/drag окна чата, сохранение в localStorage.
    - `useChatHistory` — загрузка истории сообщений с защитой от гонок.
    - `useChatContacts` — инициализация контактов (recent, workspace members, scope «все»).
    - `useChatRealtime` — обработка входящих WS-сообщений, маршрутизация в активный чат / уведомления.
- **ChatContainer** (`widgets/ChatContainer`):
    - `useChatNotifications` — глобальная подписка на WS, дедупликация тостов, счётчики непрочитанных.
- **TaskComments** (`features/task-comments`):
    - `useTaskComments` — CRUD комментариев, пагинация, редактирование, удаление, форматирование дат.
- **WorkspaceMembers** (`pages/WorkspaceSettings/components/WorkspaceMembers`):
    - `useWorkspaceMembers` — инвайты, смена ролей, исключение участников, dropdown-управление, подтверждения.
- **Chat** (дополнительно):
    - `useChatDedup` — дедупликация сообщений в коротком временном окне.
    - `useChatSend` — отправка сообщений (WS/personal), оптимистичное добавление, retry.
- **TaskSidebar** (`pages/Task/components/TaskSidebar`):
    - `useTaskSidebar` — вычисление assignees/автора, сохранение исполнителей, memberOptions.
- **EditTaskModal** (`features/task-edit`):
    - `useEditTask` — обновление/удаление задачи, управление формой, валидация assignees.
- **Sidebar** (`widgets/Sidebar`):
    - `useSidebar` — загрузка workspaces, создание workspace inline, dropdown, logout, invites count.

## Архитектура бэкенда (NextTaskServer)

- **`main.py`** — точка входа `FastAPI`, подключает CORS, создаёт таблицы и регистрирует роутеры (`auth`, `workspaces`, `tasks`, `invites`, `comments`, `profile`, `roles`, `workspace_settings`).
- **`config.py`** — pydantic-настройки приложения (CORS), значения читаются из `.env` с префиксом `NEXTTASK_`.
- **`database.py`** — создание `SQLAlchemy`-движка (SQLite), базового класса моделей и DI-функции `get_db`.
- **`models.py`** — модели `User`, `Workspace`, `Task`, `Comment` и вспомогательные таблицы (`workspace_user`, `workspace_invites`, `email_invites`). Определяет связи и каскады.
- **`api/routers/`** — слой маршрутов FastAPI:
    - `auth` (регистрация/логин, `OAuth2PasswordBearer`),
    - `workspaces` (CRUD пространств, управление участниками и назначение задач),
    - `tasks`, `comments`,
    - `invites` и `email_invites`,
    - `profile`, `workspace_settings`, `roles`.
- **`api/services/`** — бизнес-логика и проверки доступа. Например, `task_service` валидирует срок выполнения и права `manage_all_tasks`, `workspace_service` управляет ролями и возвращает агрегированную статистику.
- **`api/policy.py` и `api/roles.py`** — центральная матрица разрешений `WorkspaceRole` и проверка политик `check_workspace_permission`.
- **`api/schemas/`** — pydantic-схемы для валидации запросов/ответов (`Task`, `WorkspaceOut`, `Comment`, `User` и др.).
- **`alembic/`** — инфраструктура миграций базы данных.
- **`requirements.txt`** — зависимости (FastAPI, SQLAlchemy, Alembic, Passlib, python-jose и др.).
- **Аутентификация** — реализована через JWT (`auth_service.create_access_token`), используется `OAuth2PasswordBearer` с эндпоинтом `/auth/token`.
