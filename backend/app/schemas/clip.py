from pydantic import BaseModel, ConfigDict

class ClipRead(BaseModel):
    id: int
    start: float
    end: float
    score: float | None
    model_config = ConfigDict(from_attributes=True)
