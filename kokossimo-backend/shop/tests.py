from types import SimpleNamespace

from django.test import RequestFactory, SimpleTestCase, override_settings

from .views import _yookassa_return_url


class YooKassaReturnUrlTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.order = SimpleNamespace(id=321)

    @override_settings(YOOKASSA_RETURN_URL="https://frontend.example/checkout/success")
    def test_return_url_appends_order_parameter(self):
        request = self.factory.get("/")

        result = _yookassa_return_url(request, self.order)

        self.assertEqual(result, "https://frontend.example/checkout/success?order=321")

    @override_settings(YOOKASSA_RETURN_URL="https://frontend.example/checkout/success?source=yookassa")
    def test_return_url_preserves_existing_query_parameters(self):
        request = self.factory.get("/")

        result = _yookassa_return_url(request, self.order)

        self.assertEqual(result, "https://frontend.example/checkout/success?source=yookassa&order=321")
