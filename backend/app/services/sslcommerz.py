"""SSLCommerz payment gateway (build prompt 10: a Bangladeshi gateway, sandbox first).

Flow:
1. checkout_url(): ask SSLCommerz for a payment session and send the sponsor to its page.
2. The sponsor pays on SSLCommerz's page (sandbox: test cards and wallets, no real money).
3. SSLCommerz sends the browser back to our success, fail or cancel address, and also calls
   our IPN address server to server (only reachable once the backend is hosted).
4. We never trust what the callback says. We ask SSLCommerz's own validation API with our
   store password, and only then mark the payment succeeded. See payments.confirm_sslcommerz.

Settings: PAYMENT_PROVIDER=sslcommerz, SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD,
SSLCOMMERZ_SANDBOX=true (false = real money on securepay.sslcommerz.com).
"""

import logging
import secrets
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.errors import ApiError
from app.models import Payment

log = logging.getLogger("app.sslcommerz")

SANDBOX_HOST = "https://sandbox.sslcommerz.com"
LIVE_HOST = "https://securepay.sslcommerz.com"

# SSLCommerz statuses that mean the money was taken
PAID = {"VALID", "VALIDATED"}
# Statuses that mean it was not, and will not be
NOT_PAID = {"FAILED", "CANCELLED", "EXPIRED", "INVALID_TRANSACTION"}


@dataclass(frozen=True)
class CheckoutInfo:
    """Who pays and for what. SSLCommerz requires customer details on every session."""

    customer_name: str
    customer_email: str
    customer_phone: str
    customer_address: str
    product_name: str


def _clip(value: str, size: int) -> str:
    return (value or "").strip()[:size]


class SslCommerzGateway:
    def __init__(self, store_id: str, store_password: str, sandbox: bool = True):
        self.store_id = store_id
        self.store_password = store_password
        self.host = SANDBOX_HOST if sandbox else LIVE_HOST

    # ---- 1. Start a session ----------------------------------------------------------

    def checkout_url(self, payment: Payment, api_base: str, info: CheckoutInfo) -> str:
        # Our own transaction id (SSLCommerz allows up to 30 characters). Stored on the payment
        # so the callbacks can find it again; random, so it cannot be guessed.
        tran_id = "MP" + secrets.token_hex(14)
        payment.gateway_ref = tran_id
        back = api_base.rstrip("/") + "/api/payments/sslcommerz"
        data = {
            "store_id": self.store_id,
            "store_passwd": self.store_password,
            "total_amount": f"{payment.gross_amount:.2f}",
            "currency": "BDT",
            "tran_id": tran_id,
            "success_url": f"{back}/success",
            "fail_url": f"{back}/fail",
            "cancel_url": f"{back}/cancel",
            "ipn_url": f"{back}/ipn",
            "cus_name": _clip(info.customer_name, 50) or "Sponsor",
            "cus_email": _clip(info.customer_email, 50),
            "cus_phone": _clip(info.customer_phone, 20) or "01700000000",
            "cus_add1": _clip(info.customer_address, 50) or "Dhaka",
            "cus_city": "Dhaka",
            "cus_postcode": "1000",
            "cus_country": "Bangladesh",
            "shipping_method": "NO",
            "num_of_item": "1",
            "product_name": _clip(info.product_name, 255) or "Sponsorship",
            "product_category": "Sponsorship",
            "product_profile": "non-physical-goods",
            "value_a": str(payment.id),  # passed back to us untouched, for the logs
        }
        try:
            r = httpx.post(f"{self.host}/gwprocess/v4/api.php", data=data, timeout=30)
            body = r.json()
        except (httpx.HTTPError, ValueError) as e:
            log.error("SSLCommerz session request failed: %s", type(e).__name__)
            raise ApiError(502, "Could not reach the payment provider. Please try again.", "gateway_failed") from None

        url = str(body.get("GatewayPageURL") or "")
        if body.get("status") != "SUCCESS" or not url:
            reason = str(body.get("failedreason") or "no reason given")[:200]
            log.error("SSLCommerz refused the session: %s", reason)
            raise ApiError(502, f"The payment provider refused the payment: {reason}", "gateway_failed")
        # Only ever send the sponsor to SSLCommerz itself.
        parsed = urlparse(url)
        if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".sslcommerz.com"):
            raise ApiError(502, "The payment provider sent an unexpected address.", "gateway_failed")
        return url

    def verify(self, payment_id: str, status: str, amount: str, signature: str) -> bool:
        return False  # SSLCommerz does not use the mock's signed webhook

    # ---- 4. Ask SSLCommerz what really happened -------------------------------------

    def _get(self, path: str, params: dict[str, str]) -> dict:
        params = {**params, "store_id": self.store_id, "store_passwd": self.store_password, "format": "json"}
        try:
            r = httpx.get(f"{self.host}{path}", params=params, timeout=30)
            return r.json()
        except (httpx.HTTPError, ValueError) as e:
            log.error("SSLCommerz check failed: %s", type(e).__name__)
            raise ApiError(502, "Could not check the payment with the provider.", "gateway_failed") from None

    def validate(self, val_id: str) -> dict:
        """Validation API: the authoritative answer for one completed payment."""
        return self._get("/validator/api/validationserverAPI.php", {"val_id": val_id})

    def lookup(self, tran_id: str) -> list[dict]:
        """Transaction query API: every attempt SSLCommerz has for our tran_id."""
        body = self._get("/validator/api/merchantTransIDvalidationAPI.php", {"tran_id": tran_id})
        element = body.get("element") or []
        return element if isinstance(element, list) else []
