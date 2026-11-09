"""Pydantic schemas for Module 8: Audit log (F8.6)."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AuditLogItem(BaseModel):
    id: str
    timestamp: datetime
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    ip_address: str
    action_type: str
    target_object: Optional[str] = None
    target_table: Optional[str] = None
    target_id: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    justification: Optional[str] = None


class AuditLogListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[AuditLogItem]