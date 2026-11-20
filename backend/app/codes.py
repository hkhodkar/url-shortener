import re
import secrets

BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
CODE_LENGTH = 7

ALIAS_MIN_LENGTH = 3
ALIAS_MAX_LENGTH = 32
# letters, digits, "-" and "_", starting and ending with a letter or digit
ALIAS_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$")

# paths the app itself needs, so they can never become short links
RESERVED_WORDS = frozenset(
    {
        "about",
        "admin",
        "api",
        "app",
        "assets",
        "dashboard",
        "docs",
        "health",
        "help",
        "links",
        "login",
        "logout",
        "new",
        "openapi",
        "r",
        "redoc",
        "settings",
        "static",
        "stats",
    }
)


def encode_base62(number: int) -> str:
    if number < 0:
        raise ValueError("number must not be negative")
    if number == 0:
        return BASE62[0]
    digits = []
    while number:
        number, rest = divmod(number, 62)
        digits.append(BASE62[rest])
    return "".join(reversed(digits))


def decode_base62(text: str) -> int:
    number = 0
    for char in text:
        index = BASE62.find(char)
        if index < 0:
            raise ValueError(f"'{char}' is not a base62 character")
        number = number * 62 + index
    return number


def random_code(length: int = CODE_LENGTH) -> str:
    """A random base62 code, left padded so every code has the same length."""
    return encode_base62(secrets.randbelow(62**length)).rjust(length, BASE62[0])


def alias_problem(alias: str) -> str | None:
    """Why an alias can't be used, or None when it is fine."""
    if len(alias) < ALIAS_MIN_LENGTH:
        return f"Use at least {ALIAS_MIN_LENGTH} characters"
    if len(alias) > ALIAS_MAX_LENGTH:
        return f"Use at most {ALIAS_MAX_LENGTH} characters"
    if not ALIAS_PATTERN.match(alias):
        return "Use letters, numbers, - and _ only, starting and ending with a letter or number"
    if alias.lower() in RESERVED_WORDS:
        return "This word is reserved"
    return None
