import pytest

from app.core.api import sin_formula


@pytest.mark.parametrize("entrada,esperado", [
    ("=1+1", "'=1+1"), ("@SUM(A1)", "'@SUM(A1)"),
    ("+x", "'+x"), ("-x", "'-x"),
    ("-5", "-5"), ("-1,5", "-1,5"),
    ("texto normal", "texto normal"), ("", ""),
    (None, None), (5, 5), (-5, -5), (1.5, 1.5), (False, False),
])
def test_exportacion_neutraliza_formulas_y_preserva_datos(entrada, esperado):
    resultado = sin_formula(entrada)
    assert resultado == esperado
    assert type(resultado) is type(esperado)
