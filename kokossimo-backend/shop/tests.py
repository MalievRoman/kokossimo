from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Order


@override_settings(
    YOOKASSA_SHOP_ID="test-shop-id",
    YOOKASSA_SECRET_KEY="test-secret-key",
    YOOKASSA_RETURN_URL="https://example.com/checkout/success",
)
class YooKassaIntegrationTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="test-user", password="pass12345")
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.order = Order.objects.create(
            user=self.user,
            status="new",
            delivery_method="courier",
            payment_method="yookassa",
            payment_status="pending",
            full_name="Тестовый Пользователь",
            phone="+79990000000",
            email="test@example.com",
            city="Москва",
            street="Тверская",
            house="1",
            apartment="10",
            postal_code="101000",
            comment="",
            total_price=Decimal("100.00"),
        )

    @patch("shop.views.YooKassaClient")
    def test_create_yookassa_payment_success(self, client_cls):
        client_instance = client_cls.return_value
        client_instance.create_payment.return_value = SimpleNamespace(
            payment_id="pay_123",
            status="pending",
            amount_value="100.00",
            confirmation_url="https://yookassa.ru/pay/abc",
            raw={"id": "pay_123"},
        )

        response = self.client.post(
            "/api/payments/yookassa/create/",
            {"order_id": self.order.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["payment_id"], "pay_123")
        self.assertTrue(response.data["confirmation_url"].startswith("https://"))

        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_provider, "yookassa")
        self.assertEqual(self.order.payment_id, "pay_123")
        self.assertEqual(self.order.payment_status, "pending")

    def test_create_yookassa_payment_rejects_non_yookassa_order(self):
        self.order.payment_method = "cash_on_delivery"
        self.order.save(update_fields=["payment_method"])

        response = self.client.post(
            "/api/payments/yookassa/create/",
            {"order_id": self.order.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    @patch("shop.views.YooKassaClient")
    def test_yookassa_webhook_success_and_idempotent(self, client_cls):
        self.order.payment_id = "pay_123"
        self.order.payment_provider = "yookassa"
        self.order.save(update_fields=["payment_id", "payment_provider"])

        client_instance = client_cls.return_value
        client_instance.get_payment.return_value = {
            "id": "pay_123",
            "status": "succeeded",
            "amount": {"value": "100.00", "currency": "RUB"},
            "metadata": {"order_id": str(self.order.id)},
        }

        payload = {
            "event": "payment.succeeded",
            "object": {"id": "pay_123"},
        }
        first = self.client.post("/api/payments/yookassa/webhook/", payload, format="json")
        second = self.client.post("/api/payments/yookassa/webhook/", payload, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "paid")
        self.assertEqual(self.order.payment_status, "succeeded")
        self.assertIsNotNone(self.order.paid_at)

    @patch("shop.views.YooKassaClient")
    def test_yookassa_webhook_canceled_marks_order_cancelled(self, client_cls):
        self.order.payment_id = "pay_cancel"
        self.order.payment_provider = "yookassa"
        self.order.save(update_fields=["payment_id", "payment_provider"])

        client_instance = client_cls.return_value
        client_instance.get_payment.return_value = {
            "id": "pay_cancel",
            "status": "canceled",
            "amount": {"value": "100.00", "currency": "RUB"},
            "metadata": {"order_id": str(self.order.id)},
        }

        response = self.client.post(
            "/api/payments/yookassa/webhook/",
            {"event": "payment.canceled", "object": {"id": "pay_cancel"}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, "canceled")
        self.assertEqual(self.order.status, "cancelled")

    @patch("shop.views.YooKassaClient")
    def test_yookassa_webhook_rejects_amount_mismatch(self, client_cls):
        self.order.payment_id = "pay_bad_amount"
        self.order.payment_provider = "yookassa"
        self.order.save(update_fields=["payment_id", "payment_provider"])

        client_instance = client_cls.return_value
        client_instance.get_payment.return_value = {
            "id": "pay_bad_amount",
            "status": "succeeded",
            "amount": {"value": "999.99", "currency": "RUB"},
            "metadata": {"order_id": str(self.order.id)},
        }

        response = self.client.post(
            "/api/payments/yookassa/webhook/",
            {"event": "payment.succeeded", "object": {"id": "pay_bad_amount"}},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        self.order.refresh_from_db()
        self.assertNotEqual(self.order.status, "paid")
