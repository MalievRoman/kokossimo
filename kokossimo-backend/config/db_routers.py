class AnalyticsRouter:
    """
    Направляет модели приложения erp_analytics в отдельную БД 'analytics'.
    """

    route_app_labels = {"erp_analytics"}
    analytics_alias = "analytics"

    def db_for_read(self, model, **hints):
        if model._meta.app_label in self.route_app_labels:
            return self.analytics_alias
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label in self.route_app_labels:
            return self.analytics_alias
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if (
            obj1._meta.app_label in self.route_app_labels
            or obj2._meta.app_label in self.route_app_labels
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label in self.route_app_labels:
            return db == self.analytics_alias
        if db == self.analytics_alias:
            return False
        return None


class CertificatesRouter:
    """
    Направляет модели Certificate и CertificateTransaction (shop) в БД 'certificates'.
    """

    certificates_alias = "certificates"
    _shop_model_names = frozenset({"certificate", "certificatetransaction"})

    def _uses_certificates_db(self, model):
        return (
            model._meta.app_label == "shop"
            and model._meta.model_name in self._shop_model_names
        )

    def db_for_read(self, model, **hints):
        if self._uses_certificates_db(model):
            return self.certificates_alias
        return None

    def db_for_write(self, model, **hints):
        if self._uses_certificates_db(model):
            return self.certificates_alias
        return None

    def allow_relation(self, obj1, obj2, **hints):
        if self._uses_certificates_db(obj1.__class__) or self._uses_certificates_db(obj2.__class__):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == "shop" and model_name in self._shop_model_names:
            # История Django — в default; модели unmanaged, DDL не нужен.
            return db == "default"
        if db == self.certificates_alias:
            return False
        return None
