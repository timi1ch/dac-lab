from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.connection import get_db
from db.models import User, Resource, ResourcePermission
from core.security import get_current_user
from schemas.resource import ResourceCreate, PermissionGrant

router = APIRouter(prefix="/api/resources", tags=["Resources"])

@router.post("")
def create_resource(res: ResourceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_res = Resource(name=res.name, content=res.content, owner_id=current_user.id)
    db.add(new_res)
    db.commit()
    return {"message": "Ресурс создан", "id": new_res.id}

@router.get("")
def list_resources(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Возвращаем все ресурсы (в реальной жизни только доступные, но для демо покажем все)
    resources = db.query(Resource).all()
    result = []
    for r in resources:
        # Проверяем права для UI
        is_owner = r.owner_id == current_user.id
        perm = db.query(ResourcePermission).filter_by(user_id=current_user.id, resource_id=r.id).first()
        result.append({
            "id": r.id, "name": r.name, "content": r.content, "owner_id": r.owner_id,
            "is_owner": is_owner,
            "can_read": is_owner or (perm.can_read if perm else False),
            "can_update": is_owner or (perm.can_update if perm else False),
            "can_delete": is_owner or (perm.can_delete if perm else False)
        })
    return result

@router.post("/{resource_id}/grant")
def grant_permission(resource_id: int, req: PermissionGrant, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(404, "Ресурс не найден")
    if resource.owner_id != current_user.id:
        raise HTTPException(403, "Только владелец может выдавать права")

    target_user = db.query(User).filter(User.login == req.target_user_login).first()
    if not target_user:
        raise HTTPException(404, "Целевой пользователь не найден")

    perm = db.query(ResourcePermission).filter_by(user_id=target_user.id, resource_id=resource_id).first()
    if not perm:
        perm = ResourcePermission(user_id=target_user.id, resource_id=resource_id)
        db.add(perm)
    
    perm.can_read = req.can_read
    perm.can_update = req.can_update
    perm.can_delete = req.can_delete
    db.commit()
    return {"message": f"Права для {target_user.login} обновлены"}

# Эндпоинты проверки доступа (Read, Update, Delete)
def check_access(resource_id: int, action: str, current_user: User, db: Session):
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(404, "Ресурс не найден")
    
    if resource.owner_id == current_user.id:
        return resource # Владелец может всё
    
    perm = db.query(ResourcePermission).filter_by(user_id=current_user.id, resource_id=resource_id).first()
    if not perm or not getattr(perm, f"can_{action}"):
        raise HTTPException(403, f"Доступ запрещен: нет права на {action}")
    return resource

@router.get("/{resource_id}")
def read_resource(resource_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = check_access(resource_id, "read", current_user, db)
    return {"content": res.content}

@router.put("/{resource_id}")
def update_resource(resource_id: int, res_data: ResourceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = check_access(resource_id, "update", current_user, db)
    res.name = res_data.name
    res.content = res_data.content
    db.commit()
    return {"message": "Ресурс обновлен"}

@router.delete("/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = check_access(resource_id, "delete", current_user, db)
    db.delete(res)
    db.commit()
    return {"message": "Ресурс удален"}