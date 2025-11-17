from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import math

app = FastAPI(
    title="Porta-Spotty Backend",
    description="API for recording bathroom locations around cities",
)

# frontend API access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allow some more vague origins for now as we set up databases; don't steal my backend for now pls
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# data models

class ToiletCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    is_free: bool = True
    wheelchair: Optional[bool] = None
    running_water: Optional[bool] = None
    indoor: Optional[bool] = None
    open_in_winter: Optional[bool] = None
    gender_neutral: Optional[bool] = None
    baby_change: Optional[bool] = None
    menstrual_products: Optional[bool] = None


class Toilet(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    is_free: bool
    wheelchair: Optional[bool] = None
    running_water: Optional[bool] = None
    indoor: Optional[bool] = None
    open_in_winter: Optional[bool] = None
    gender_neutral: Optional[bool] = None
    baby_change: Optional[bool] = None
    menstrual_products: Optional[bool] = None
    avg_cleanliness: Optional[float] = None
    rating_count: int = 0


class RatingCreate(BaseModel):
    cleanliness: int  # range 1–5
    comment: Optional[str] = None


# the stand-in database until an SQLite one is put in

toilets_db: List[Toilet] = []
ratings_db: List[dict] = []  # each rating has toilet_id, cleanliness, comment
next_toilet_id = 1

# some utility functions

def haversine_km(lat1, lon1, lat2, lon2):
    ''' calculate inter-coord distances, km units for now '''
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def recompute_rating_stats(toilet_id: int):
    global toilets_db, ratings_db
    scores = [r["cleanliness"] for r in ratings_db if r["toilet_id"] == toilet_id]

    for t in toilets_db:
        if t.id == toilet_id:
            if scores:
                t.avg_cleanliness = sum(scores) / len(scores)
                t.rating_count = len(scores)
            else:
                t.avg_cleanliness = None
                t.rating_count = 0
            break


# API endpoints

@app.get("/")
def root():
    return {"message": "Succesfully running Porta-Spotty backend!"}


@app.post("/toilets", response_model=Toilet)
def create_toilet(toilet: ToiletCreate):
    ''' add a new restroom to the map '''
    global next_toilet_id, toilets_db

    new = Toilet(
        id=next_toilet_id,
        name=toilet.name,
        latitude=toilet.latitude,
        longitude=toilet.longitude,
        is_free=toilet.is_free,
        wheelchair=toilet.wheelchair,
        running_water=toilet.running_water,
        indoor=toilet.indoor,
        open_in_winter=toilet.open_in_winter,
        gender_neutral=toilet.gender_neutral,
        baby_change=toilet.baby_change,
        menstrual_products=toilet.menstrual_products,
        avg_cleanliness=None,
        rating_count=0,
    )

    toilets_db.append(new)
    next_toilet_id += 1
    return new


@app.get("/toilets", response_model=List[Toilet])
def list_toilets(
    lat: float = Query(..., description="Your current latitude"),
    lng: float = Query(..., description="Your current longitude"),
    radius_km: float = Query(2.0, description="Search radius in km"),
):
    ''' gives the restrooms within a search radius of current lon/lat coordinates '''
    results = []
    for t in toilets_db:
        d = haversine_km(lat, lng, t.latitude, t.longitude)
        if d <= radius_km:
            results.append(t)
    return results


@app.get("/toilets/{toilet_id}", response_model=Toilet)
def get_toilet(toilet_id: int):
    ''' gets the restroom details '''
    for t in toilets_db:
        if t.id == toilet_id:
            return t
    raise HTTPException(status_code=404, detail="Restroom not found")


@app.post("/toilets/{toilet_id}/ratings", response_model=Toilet)
def add_rating(toilet_id: int, rating: RatingCreate):
    ''' adds a cleanliness rating for a restroom. '''
    if not (1 <= rating.cleanliness <= 5):
        raise HTTPException(status_code=400, detail="cleanliness must be 1–5")

    for t in toilets_db:
        if t.id == toilet_id:
            ratings_db.append(
                {
                    "toilet_id": toilet_id,
                    "cleanliness": rating.cleanliness,
                    "comment": rating.comment,
                }
            )
            recompute_rating_stats(toilet_id)
            return t

    raise HTTPException(status_code=404, detail="Restroom not found")
