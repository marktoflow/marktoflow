"""
User Service API

Manages user profiles and preferences.
"""

from fastapi import FastAPI

app = FastAPI()

@app.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile"""
    pass

@app.put("/users/{user_id}")
async def update_user(user_id: str, data: dict):
    """Update user profile"""
    pass

@app.get("/users/{user_id}/preferences")
async def get_preferences(user_id: str):
    """Get user preferences"""
    pass
