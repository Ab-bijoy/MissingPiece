"""SSLCommerz gateway: start a session, then trust only SSLCommerz's validation API.

SSLCommerz itself is faked here (no network, no real store).
"""

import pytest

from app.config import get_settings
from app.models import Offer, Payment
from app.models.enums import OfferStage, PaymentStatus
from app.services import sslcommerz
from tests.conftest import auth


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def json(self):
        return self.body


class FakeSslCommerz:
    """Answers like SSLCommerz's sandbox. `paid` maps tran_id -> (status, currency, amount)."""

    def __init__(self):
        self.sessions = []
        self.paid: dict[str, tuple[str, str, str]] = {}
        self.page_url = "https://sandbox.sslcommerz.com/EasyCheckOut/testcde123"

    def post(self, url, data, timeout):
        assert url.endswith("/gwprocess/v4/api.php") and data["store_passwd"] == "test-pass"
        self.sessions.append(data)
        return FakeResponse({"status": "SUCCESS", "GatewayPageURL": self.page_url})

    def get(self, url, params, timeout):
        assert params["store_passwd"] == "test-pass"
        if url.endswith("validationserverAPI.php"):
            tran_id = params["val_id"].removeprefix("VAL-")
            if tran_id not in self.paid:
                return FakeResponse({"status": "INVALID_TRANSACTION"})
            status, currency, amount = self.paid[tran_id]
            return FakeResponse(
                {"status": status, "tran_id": tran_id, "currency_type": currency, "currency_amount": amount}
            )
        tran_id = params["tran_id"]
        if tran_id not in self.paid:
            return FakeResponse({"APIConnect": "DONE", "no_of_trans_found": 0, "element": []})
        status, currency, amount = self.paid[tran_id]
        return FakeResponse(
            {"element": [{"status": status, "tran_id": tran_id, "currency_type": currency, "currency_amount": amount}]}
        )


@pytest.fixture
def ssl(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "sslcommerz")
    monkeypatch.setattr(s, "sslcommerz_store_id", "test-store")
    monkeypatch.setattr(s, "sslcommerz_store_password", "test-pass")
    monkeypatch.setattr(s, "sslcommerz_sandbox", True)
    fake = FakeSslCommerz()
    monkeypatch.setattr(sslcommerz.httpx, "post", fake.post)
    monkeypatch.setattr(sslcommerz.httpx, "get", fake.get)
    return fake


def start(client, scene, f):
    o = client.post(f"/api/requests/{scene['request'].id}/offers", json={}, headers=auth(scene["sponsor"])).json()
    f.accept(o["id"])
    r = client.post(f"/api/offers/{o['id']}/payments", json={"method": "card"}, headers=auth(scene["sponsor"]))
    assert r.status_code == 201, r.text
    return o["id"], r.json()


def tran_of(db, payment_id):
    db.expire_all()
    return db.get(Payment, payment_id).gateway_ref


def test_start_sends_sponsor_to_sslcommerz(client, scene, f, db, ssl):
    _, res = start(client, scene, f)
    assert res["checkout_url"] == ssl.page_url
    sent = ssl.sessions[0]
    assert sent["total_amount"] == "21000.00" and sent["currency"] == "BDT"
    assert sent["success_url"].endswith("/api/payments/sslcommerz/success")
    tran_id = tran_of(db, res["payment_id"])
    assert sent["tran_id"] == tran_id and len(tran_id) <= 30


def test_validated_payment_succeeds(client, scene, f, db, ssl):
    offer_id, res = start(client, scene, f)
    tran_id = tran_of(db, res["payment_id"])
    ssl.paid[tran_id] = ("VALID", "BDT", "21000.00")
    r = client.post(
        "/api/payments/sslcommerz/success",
        data={"tran_id": tran_id, "val_id": f"VAL-{tran_id}"},
        follow_redirects=False,
    )
    assert r.status_code == 303 and r.headers["location"].endswith("/sponsor/offers?payment=succeeded")
    db.expire_all()
    assert db.get(Payment, res["payment_id"]).status == PaymentStatus.succeeded
    assert db.get(Offer, offer_id).stage == OfferStage.received
    # The IPN arriving afterwards changes nothing
    again = client.post("/api/payments/sslcommerz/ipn", data={"tran_id": tran_id, "val_id": f"VAL-{tran_id}"})
    assert again.json() == {"status": "succeeded"}


def test_forged_success_is_not_trusted(client, scene, f, db, ssl):
    """Someone posts to the success address without paying: SSLCommerz says no."""
    _, res = start(client, scene, f)
    tran_id = tran_of(db, res["payment_id"])
    r = client.post(
        "/api/payments/sslcommerz/success", data={"tran_id": tran_id, "val_id": "VAL-made-up"}, follow_redirects=False
    )
    assert r.headers["location"].endswith("payment=failed")
    db.expire_all()
    assert db.get(Payment, res["payment_id"]).status == PaymentStatus.pending


def test_someone_elses_val_id_is_not_trusted(client, scene, f, db, ssl):
    """A real, paid val_id from another transaction cannot pay for this one."""
    _, res = start(client, scene, f)
    tran_id = tran_of(db, res["payment_id"])
    ssl.paid["MPsomeoneelse"] = ("VALID", "BDT", "21000.00")
    client.post("/api/payments/sslcommerz/success", data={"tran_id": tran_id, "val_id": "VAL-MPsomeoneelse"})
    db.expire_all()
    assert db.get(Payment, res["payment_id"]).status == PaymentStatus.pending


def test_wrong_amount_is_not_accepted(client, scene, f, db, ssl):
    _, res = start(client, scene, f)
    tran_id = tran_of(db, res["payment_id"])
    ssl.paid[tran_id] = ("VALID", "BDT", "10.00")
    r = client.post(
        "/api/payments/sslcommerz/success",
        data={"tran_id": tran_id, "val_id": f"VAL-{tran_id}"},
        follow_redirects=False,
    )
    assert r.headers["location"].endswith("payment=failed")
    db.expire_all()
    assert db.get(Payment, res["payment_id"]).status == PaymentStatus.pending


def test_failed_then_retry(client, scene, f, db, ssl):
    offer_id, res = start(client, scene, f)
    tran_id = tran_of(db, res["payment_id"])
    ssl.paid[tran_id] = ("FAILED", "BDT", "21000.00")
    r = client.post("/api/payments/sslcommerz/fail", data={"tran_id": tran_id}, follow_redirects=False)
    assert r.headers["location"].endswith("payment=failed")
    db.expire_all()
    assert db.get(Payment, res["payment_id"]).status == PaymentStatus.failed
    assert db.get(Offer, offer_id).stage == OfferStage.accepted
    # The sponsor tries again
    r = client.post(f"/api/offers/{offer_id}/payments", json={"method": "card"}, headers=auth(scene["sponsor"]))
    assert r.status_code == 201


def test_callbacks_closed_when_not_using_sslcommerz(client):
    r = client.post("/api/payments/sslcommerz/success", data={"tran_id": "MPx", "val_id": "x"})
    assert r.status_code == 404


def test_missing_store_details_refused(client, scene, f, monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "payment_provider", "sslcommerz")
    monkeypatch.setattr(s, "sslcommerz_store_id", "")
    o = client.post(f"/api/requests/{scene['request'].id}/offers", json={}, headers=auth(scene["sponsor"])).json()
    f.accept(o["id"])
    r = client.post(f"/api/offers/{o['id']}/payments", json={"method": "card"}, headers=auth(scene["sponsor"]))
    assert r.status_code == 503 and r.json()["code"] == "no_gateway"
