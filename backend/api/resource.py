from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.auth import get_current_user
from backend.core.application import app
from backend.db import resources as storage
from backend.db.connection import User, get_db
from backend.schemas.resources import PermissionGrant, ResourceCreate, ResourceUpdate


def permissions_for(resource, user, db):
    if resource.owner_id == user.id:
        return {"can_read": True, "can_update": True, "can_delete": True}
    permission = storage.get_permission(db, resource.id, user.id)
    return {
        field: bool(permission and getattr(permission, field))
        for field in ("can_read", "can_update", "can_delete")
    }


def require_resource(resource_id, user, db, action):
    resource = storage.get_resource(db, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Ресурс не найден")
    if resource.owner_id != user.id:
        if action == "owner" or not permissions_for(resource, user, db)[action]:
            raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    return resource


def resource_data(resource, user, db, include_content=False):
    result = {
        "id": resource.id,
        "title": resource.title,
        "owner_login": resource.owner.login,
        "is_owner": resource.owner_id == user.id,
        "my_permissions": permissions_for(resource, user, db),
    }
    if include_content:
        result.update(
            content=resource.content,
            created_at=resource.created_at,
            updated_at=resource.updated_at,
        )
    return result


@app.get("/api/resources")
def list_resources(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [resource_data(resource, user, db) for resource in storage.list_resources(db, user.id)]


@app.post("/api/resources", status_code=status.HTTP_201_CREATED)
def create_resource(
    data: ResourceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = storage.create_resource(db, user.id, data.title, data.content)
    return resource_data(resource, user, db, include_content=True)


@app.get("/api/resources/{resource_id}")
def read_resource(
    resource_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = require_resource(resource_id, user, db, "can_read")
    return resource_data(resource, user, db, include_content=True)


@app.put("/api/resources/{resource_id}")
def update_resource(
    resource_id: int,
    data: ResourceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = require_resource(resource_id, user, db, "can_update")
    storage.update_resource(db, resource, data.model_dump(exclude_unset=True))
    return {"message": "Ресурс обновлён"}


@app.delete("/api/resources/{resource_id}")
def delete_resource(
    resource_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = require_resource(resource_id, user, db, "can_delete")
    storage.delete_resource(db, resource)
    return {"message": "Ресурс удалён"}


@app.get("/api/resources/{resource_id}/permissions")
def list_permissions(
    resource_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_resource(resource_id, user, db, "owner")
    return [
        {
            "login": permission.user.login,
            "can_read": permission.can_read,
            "can_update": permission.can_update,
            "can_delete": permission.can_delete,
        }
        for permission in storage.list_permissions(db, resource_id)
    ]


@app.put("/api/resources/{resource_id}/permissions")
def grant_permission(
    resource_id: int,
    data: PermissionGrant,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resource = require_resource(resource_id, user, db, "owner")
    recipient = db.scalar(select(User).where(User.login == data.login))
    if recipient is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if recipient.id == resource.owner_id:
        raise HTTPException(status_code=400, detail="Владелец уже имеет все права")
    flags = data.model_dump(exclude={"login"})
    storage.set_permission(db, resource.id, recipient.id, flags)
    return {"message": "Права обновлены" if any(flags.values()) else "Права отозваны"}
