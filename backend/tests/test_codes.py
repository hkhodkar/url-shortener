import pytest

from app.codes import BASE62, alias_problem, decode_base62, encode_base62, random_code


@pytest.mark.parametrize("number", [0, 1, 61, 62, 3843, 3844, 10**12])
def test_base62_round_trip(number):
    assert decode_base62(encode_base62(number)) == number


def test_base62_known_values():
    assert encode_base62(61) == "Z"
    assert encode_base62(62) == "10"


def test_random_code_has_fixed_length_and_alphabet():
    codes = {random_code() for _ in range(200)}
    assert len(codes) == 200
    assert all(len(code) == 7 and set(code) <= set(BASE62) for code in codes)


@pytest.mark.parametrize("alias", ["abc", "my-link", "Launch_2026", "a1b"])
def test_valid_aliases(alias):
    assert alias_problem(alias) is None


@pytest.mark.parametrize(
    ("alias", "message"),
    [
        ("ab", "at least 3"),
        ("x" * 33, "at most 32"),
        ("has space", "letters, numbers"),
        ("-start", "letters, numbers"),
        ("end_", "letters, numbers"),
        ("ümlaut", "letters, numbers"),
        ("API", "reserved"),
        ("docs", "reserved"),
    ],
)
def test_invalid_aliases(alias, message):
    assert message in alias_problem(alias)
