from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from config import settings

# Import Models
from database.models.user import User
from database.models.search_profile import SearchProfile
from database.models.property import Property
from database.models.match import Match
from database.models.negotiation import Negotiation
from database.models.legal_report import LegalReport
from database.models.document import DocumentModel
from database.models.neighbourhood_report import NeighbourhoodReport
from database.models.rag_models import LegalCorpus, NeighbourhoodReview
from database.models.activity_log import ActivityLog

async def init_db():
    # Create Motor client
    client = AsyncIOMotorClient(settings.mongodb_url)
    
    # Initialize Beanie ODM
    await init_beanie(
        database=client.griha_ai,
        document_models=[
            User,
            SearchProfile,
            Property,
            Match,
            Negotiation,
            LegalReport,
            DocumentModel,
            NeighbourhoodReport,
            LegalCorpus,
            NeighbourhoodReview,
            ActivityLog,
        ]
    )
    
    print("MongoDB connection initialized")
