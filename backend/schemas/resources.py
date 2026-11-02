from pydantic import BaseModel, ConfigDict, Field, model_validator


class ResourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    content: str = ""


class ResourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = None

    @model_validator(mode="after")
    def reject_null_values(self):
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"Поле {field} не может быть null")
        return self


class PermissionGrant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    login: str = Field(min_length=3, max_length=32)
    can_read: bool = False
    can_update: bool = False
    can_delete: bool = False
