import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from app.models.task_time_track import TaskTimeTrack
from app.models.task import Task
from app.models.user import User
from app.models.task_plan import TaskPlan

TaskTimeTrack.__table__.create(engine, checkfirst=True)
TaskPlan.__table__.create(engine, checkfirst=True)
print("Table created successfully")
