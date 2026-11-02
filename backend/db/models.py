from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Boolean, text
from sqlalchemy.orm import relationship
from db.connection import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    
    # Связи для Варианта 2
    resources = relationship("Resource", back_populates="owner")
    permissions = relationship("ResourcePermission", back_populates="user")

class Resource(Base):
    __tablename__ = "resources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    content = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    owner = relationship("User", back_populates="resources")
    permissions = relationship("ResourcePermission", back_populates="resource", cascade="all, delete-orphan")

class ResourcePermission(Base):
    __tablename__ = "resource_permissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    
    can_read = Column(Boolean, default=False)
    can_update = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)

    user = relationship("User", back_populates="permissions")
    resource = relationship("Resource", back_populates="permissions")