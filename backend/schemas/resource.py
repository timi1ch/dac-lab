from pydantic import BaseModel

class ResourceCreate(BaseModel):
    name: str
    content: str

class ResourceResponse(BaseModel):
    id: int
    name: str
    content: str
    owner_id: int

class PermissionGrant(BaseModel):
    target_user_login: str
    can_read: bool = False
    can_update: bool = False
    can_delete: bool = False