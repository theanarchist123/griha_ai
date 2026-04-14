from fastapi import APIRouter
from . import locations, search, auth, properties, ws, negotiation, documents, legal, neighbourhood, preferences, activity

router = APIRouter()
router.include_router(locations.router)
router.include_router(search.router)
router.include_router(auth.router)
router.include_router(properties.router)
router.include_router(ws.router)
router.include_router(negotiation.router)
router.include_router(documents.router)
router.include_router(legal.router)
router.include_router(neighbourhood.router)
router.include_router(preferences.router)
router.include_router(activity.router)

# We will export the combined router to main.py
