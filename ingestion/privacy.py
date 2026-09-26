import re

# Handbooks list student officers with matric numbers, student and personal
# email addresses and mobile numbers. None of that belongs in answers, the
# source panel or /retrieve, so it is removed before chunks are stored.
# Office contacts (security lines, a college hotline, office@...ui.edu.ng) stay.

PERSONAL_EMAIL = re.compile(
    r"[\w.+-]+@(?:stu\.ui\.edu\.ng|gmail\.com|yahoo\.com|yahoo\.co\.uk|ymail\.com|"
    r"hotmail\.com|outlook\.com|live\.com)\b",
    re.IGNORECASE,
)
MATRIC_NUMBER = re.compile(
    r"(Matric(?:ulation)?\.?\s*(?:Number|No\.?)?\s*[:\-]?\s*)\d{5,7}", re.IGNORECASE
)
PHONE_NUMBER = re.compile(r"(?:\+?234[\s-]?|\b0)[789][01]\d(?:[\s-]?\d){7}\b")

REMOVED = "[removed]"


def is_personal_record(text):
    return bool(MATRIC_NUMBER.search(text) or PERSONAL_EMAIL.search(text))


def redact_personal(text, personal_record=None):
    """
    Remove personal contact details. A phone number is only removed from a
    personal record, text that also carries a matric number or a personal email,
    so office and emergency lines are kept. Pass personal_record when the record
    spans more than this text, such as a directory page split into blocks.
    """
    if personal_record is None:
        personal_record = is_personal_record(text)

    text = PERSONAL_EMAIL.sub(REMOVED, text)
    text = MATRIC_NUMBER.sub(lambda match: match.group(1) + REMOVED, text)
    if personal_record:
        text = PHONE_NUMBER.sub(REMOVED, text)
    return text
