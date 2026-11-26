from datetime import datetime, timedelta, timezone

from app.modulos.usuarios.models import EquipmentReservation
from tests.conftest import iniciar_sesion
from tests.seguridad.helpers import APROBADOR, PENDIENTE, PROYECTO, gasto


def test_aprobador_no_puede_aprobar_su_propia_solicitud(pg_client, pg_db):
    solicitud = gasto(pg_db, solicitante=APROBADOR)
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    respuesta = pg_client.post(f"/api/solicitudes/{solicitud.id}/aprobar", json={})
    pg_db.refresh(solicitud)
    assert respuesta.status_code == 409, respuesta.text
    assert solicitud.status == PENDIENTE


def test_aprobador_puede_aprobar_solicitud_de_otro_usuario(pg_client, pg_db):
    solicitud = gasto(pg_db)
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    respuesta = pg_client.post(f"/api/solicitudes/{solicitud.id}/aprobar", json={})
    pg_db.refresh(solicitud)
    assert respuesta.status_code == 200, respuesta.text
    assert solicitud.status == "Aprobado"


def test_aprobador_no_puede_aprobar_su_propia_reserva(pg_client, pg_db):
    inicio = datetime.now(timezone.utc) + timedelta(days=10)
    reserva = EquipmentReservation(
        equipment_id="f0000000-0000-0000-0000-000000000001",
        project_id=PROYECTO, reserved_by_user_id=APROBADOR,
        start_time=inicio, end_time=inicio + timedelta(hours=1), status=PENDIENTE,
    )
    pg_db.add(reserva)
    pg_db.commit()
    iniciar_sesion(pg_client, "aprobador@cpq.local")
    respuesta = pg_client.post(f"/api/reservas/{reserva.id}/aprobar", json={})
    pg_db.refresh(reserva)
    assert respuesta.status_code == 409, respuesta.text
    assert reserva.status == PENDIENTE
