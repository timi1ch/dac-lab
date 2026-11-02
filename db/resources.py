from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text,
    and_, delete, func, or_, select,
)
from sqlalchemy.orm import relationship

from db.connection import Base, User


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False,
        server_default=func.now(), onupdate=func.now(),
    )

    owner = relationship(User)


class ResourcePermission(Base):
    """Дискреционная модель доступа (вариант 2).

    Права назначаются на пару (пользователь, ресурс) владельцем ресурса.
    """
    __tablename__ = "resource_permissions"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
    )
    resource_id = Column(
        Integer, ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True,
    )
    can_read = Column(Boolean, nullable=False, default=False)
    can_update = Column(Boolean, nullable=False, default=False)
    can_delete = Column(Boolean, nullable=False, default=False)

    user = relationship(User)


# -------- storage API, который использует api/resource.py --------

def get_resource(db, resource_id):
    return db.get(Resource, resource_id)


def get_permission(db, resource_id, user_id):
    return db.get(ResourcePermission, (user_id, resource_id))


def list_resources(db, user_id):
    return db.scalars(
        select(Resource)
        .outerjoin(ResourcePermission, and_(
            ResourcePermission.resource_id == Resource.id,
            ResourcePermission.user_id == user_id,
        ))
        .where(or_(
            Resource.owner_id == user_id,
            ResourcePermission.can_read.is_(True),
        ))
        .order_by(Resource.id)
    ).all()


def create_resource(db, owner_id, title, content):
    resource = Resource(owner_id=owner_id, title=title, content=content)
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def update_resource(db, resource, changes):
    for field in ("title", "content"):
        if field in changes:
            setattr(resource, field, changes[field])
    db.commit()


def delete_resource(db, resource):
    db.execute(
        delete(ResourcePermission).where(
            ResourcePermission.resource_id == resource.id
        )
    )
    db.delete(resource)
    db.commit()


def list_permissions(db, resource_id):
    return db.scalars(
        select(ResourcePermission)
        .where(ResourcePermission.resource_id == resource_id)
        .order_by(ResourcePermission.user_id)
    ).all()


def set_permission(db, resource_id, user_id, flags):
    permission = get_permission(db, resource_id, user_id)
    if not any(flags.values()):
        if permission is not None:
            db.delete(permission)
    else:
        if permission is None:
            permission = ResourcePermission(
                resource_id=resource_id, user_id=user_id,
            )
            db.add(permission)
        for field in ("can_read", "can_update", "can_delete"):
            setattr(permission, field, flags[field])
    db.commit()