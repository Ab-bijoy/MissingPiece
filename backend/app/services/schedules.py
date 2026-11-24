"""Shared schedule requirements for needs that reserve time or resources."""

from datetime import UTC, datetime

from app.models.enums import NeedType

CONTRIBUTOR_TYPES = {NeedType.skill, NeedType.time, NeedType.equipment, NeedType.space}


def schedule_error(need_type, start, end):
    if need_type not in CONTRIBUTOR_TYPES:
        return None
    if start is None or end is None:
        return "Set both a start and end time for this contributor need."
    if start.utcoffset() is None or end.utcoffset() is None:
        return "Contribution times must include a timezone."
    if end <= start:
        return "The contribution end time must be after the start time."
    if end <= datetime.now(UTC):
        return "The contribution end time must be in the future."
    return None
