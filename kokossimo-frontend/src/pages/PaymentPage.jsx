import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createOrder, getCurrentUser, updateProfile } from '../services/api';
import { useCart } from '../context/CartContext';
import { formatRuPhone, isPhoneInputKeyAllowed } from '../utils/phone';
import './PaymentPage.css';

const PaymentPage = () => {
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '+7',
    email: '',
    city: '',
    street: '',
    house: '',
    apartment: '',
    postal_code: '',
    comment: '',
    deliveryMethod: 'courier',
    paymentMethod: 'cash_on_delivery',
    agreement: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    getCurrentUser(token)
      .then((response) => {
        const data = response.data || {};
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        setForm((prev) => ({
          ...prev,
          name: fullName || prev.name,
          phone: formatRuPhone(data.phone || prev.phone),
          email: data.email || prev.email,
          city: data.city || prev.city,
          street: data.street || prev.street,
          house: data.house || prev.house,
          apartment: data.apartment || prev.apartment,
          postal_code: data.postal_code || prev.postal_code,
        }));
      })
      .catch(() => {});
  }, []);

  const itemsCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const handleChange = (field) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (cartItems.length === 0) {
      setStatus({ type: 'error', message: 'Корзина пуста.' });
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      setStatus({ type: 'error', message: 'Сначала зарегистрируйтесь или войдите в аккаунт.' });
      navigate('/auth');
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      updateProfile(token, {
        first_name: form.name.split(' ')[0] || '',
        last_name: form.name.split(' ').slice(1).join(' ') || '',
        email: form.email,
        phone: form.phone,
        city: form.city,
        street: form.street,
        house: form.house,
        apartment: form.apartment,
        postal_code: form.postal_code,
      }).catch(() => {});

      const payload = {
        full_name: form.name,
        phone: form.phone,
        email: form.email,
        city: form.city,
        street: form.street,
        house: form.house,
        apartment: form.apartment,
        postal_code: form.postal_code,
        comment: form.comment,
        delivery_method: form.deliveryMethod,
        payment_method: form.paymentMethod,
        items: cartItems.map((item) =>
          item.is_gift_certificate || (typeof item.id === 'string' && item.id.startsWith('gift-'))
            ? {
                gift_certificate_amount: item.price,
                gift_certificate_name: item.name,
                quantity: item.quantity,
              }
            : {
                product_id: item.id,
                quantity: item.quantity,
              }
        ),
      };

      const response = await createOrder(payload, token);
      clearCart();
      navigate(`/checkout/success?order=${response.data.id}`);
    } catch (error) {
      const message =
        error?.response?.data?.detail ||
        'Не удалось создать заказ. Проверьте данные и попробуйте снова.';
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="payment-page page-animation">
        <div className="container">
          <div className="breadcrumbs">
            <Link to="/">Главная</Link> / <Link to="/cart">Корзина</Link> /{' '}
            <span>Оплата</span>
          </div>

          <h1 className="page-title">ОПЛАТА</h1>

          <div className="payment-empty">
            <p>Корзина пуста. Добавьте товары, чтобы перейти к оплате.</p>
            <Link to="/catalog" className="btn-primary">
              Перейти в каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page page-animation">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Главная</Link> / <Link to="/cart">Корзина</Link> /{' '}
          <span>Оплата</span>
        </div>

        <h1 className="page-title">ОФОРМЛЕНИЕ ЗАКАЗА</h1>

        <div className="payment-layout">
          <form className="payment-form" onSubmit={handleSubmit}>
            <div className="payment-card">
              <h2>Контактные данные</h2>
              <div className="payment-grid">
                <label className="payment-field">
                  <span>Имя и фамилия</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={handleChange('name')}
                    placeholder="Ваше имя"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Телефон</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, phone: formatRuPhone(event.target.value) }))
                    }
                    onKeyDown={(event) => {
                      if (!isPhoneInputKeyAllowed(event)) {
                        event.preventDefault();
                      }
                    }}
                    placeholder="+7 (999) 000-00-00"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder="name@example.com"
                  />
                </label>
              </div>
            </div>

            <div className="payment-card">
              <h2>Доставка</h2>
              <div className="payment-grid">
                <label className="payment-field">
                  <span>Город</span>
                  <input
                    type="text"
                    value={form.city}
                    onChange={handleChange('city')}
                    placeholder="Город"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Улица</span>
                  <input
                    type="text"
                    value={form.street}
                    onChange={handleChange('street')}
                    placeholder="Улица"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Дом</span>
                  <input
                    type="text"
                    value={form.house}
                    onChange={handleChange('house')}
                    placeholder="Дом"
                    required
                  />
                </label>
                <label className="payment-field">
                  <span>Квартира</span>
                  <input
                    type="text"
                    value={form.apartment}
                    onChange={handleChange('apartment')}
                    placeholder="Квартира"
                  />
                </label>
                <label className="payment-field">
                  <span>Индекс</span>
                  <input
                    type="text"
                    value={form.postal_code}
                    onChange={handleChange('postal_code')}
                    placeholder="Индекс"
                  />
                </label>
                <label className="payment-field payment-field--full">
                  <span>Комментарий к заказу</span>
                  <textarea
                    value={form.comment}
                    onChange={handleChange('comment')}
                    placeholder="Пожелания по доставке"
                    rows={3}
                  />
                </label>
              </div>
            </div>

            <div className="payment-card">
              <h2>Способ доставки</h2>
              <div className="payment-options">
                <label className="payment-option">
                  <input
                    type="radio"
                    name="delivery"
                    value="courier"
                    checked={form.deliveryMethod === 'courier'}
                    onChange={(event) => {
                      setForm((prev) => ({
                        ...prev,
                        deliveryMethod: event.target.value,
                        paymentMethod: 'cash_on_delivery',
                      }));
                    }}
                  />
                  <span>Курьерская доставка</span>
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="delivery"
                    value="pickup"
                    checked={form.deliveryMethod === 'pickup'}
                    onChange={(event) => {
                      setForm((prev) => ({
                        ...prev,
                        deliveryMethod: event.target.value,
                        paymentMethod: 'cash_pickup',
                      }));
                    }}
                  />
                  <span>Самовывоз</span>
                </label>
              </div>
            </div>

            <div className="payment-card">
              <h2>Способ оплаты</h2>
              <div className="payment-options">
                <label className="payment-option">
                  <input
                    type="radio"
                    name="payment"
                    value="cash_on_delivery"
                    checked={form.paymentMethod === 'cash_on_delivery'}
                    onChange={handleChange('paymentMethod')}
                    disabled={form.deliveryMethod !== 'courier'}
                  />
                  <span>Наличными курьеру при доставке</span>
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="payment"
                    value="cash_pickup"
                    checked={form.paymentMethod === 'cash_pickup'}
                    onChange={handleChange('paymentMethod')}
                    disabled={form.deliveryMethod !== 'pickup'}
                  />
                  <span>На кассе при самовывозе</span>
                </label>
              </div>
            </div>

            <label className="payment-agreement">
              <input
                type="checkbox"
                checked={form.agreement}
                onChange={handleChange('agreement')}
                required
              />
              <span>Я согласен с условиями обработки персональных данных</span>
            </label>

            <button className="btn-primary btn-primary--full" type="submit">
              {isSubmitting ? 'Создание заказа...' : 'Готово!'}
            </button>
            {status.message && (
              <div className={`payment-status payment-status--${status.type}`}>
                {status.message}
              </div>
            )}
          </form>

          <aside className="payment-summary">
            <h2>Ваш заказ</h2>
            <div className="payment-summary__row">
              <span>Товаров:</span>
              <span>{itemsCount} шт.</span>
            </div>
            <div className="payment-summary__row">
              <span>Сумма:</span>
              <span>{getTotalPrice().toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="payment-summary__row payment-summary__total">
              <span>К оплате:</span>
              <span>{getTotalPrice().toLocaleString('ru-RU')} ₽</span>
            </div>
            <p className="payment-summary__note">
              Онлайн-оплата пока недоступна. Выберите оплату при получении.
            </p>
            <Link to="/cart" className="btn-link btn-link--center">
              Вернуться в корзину
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
