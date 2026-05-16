-- Выполнить от имени владельца таблицы или суперпользователя (psql, pgAdmin).
-- Замените YOUR_CERTIFICATES_DB_USER на роль из CERTIFICATES_POSTGRES_USER в .env.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.certificate_transactions TO YOUR_CERTIFICATES_DB_USER;
GRANT USAGE, SELECT ON SEQUENCE public.certificate_transactions_id_seq TO YOUR_CERTIFICATES_DB_USER;
