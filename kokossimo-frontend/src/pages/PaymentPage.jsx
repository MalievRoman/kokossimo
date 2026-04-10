import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import {
  createOrder,
  createYooKassaPayment,
  getCurrentUser,
  getDeliveryCities,
  updateProfile,
} from '../services/api';
import { useCart } from '../context/CartContext';
import { formatRuPhone, isPhoneInputKeyAllowed } from '../utils/phone';
import './PaymentPage.css';

const PAYMENT_OPTIONS = [
  { value: 'card', label: 'Оплата картой' },
  { value: 'sbp', label: 'СБП' },
  { value: 'tpay', label: 'T-Pay' },
];

const DELIVERY_TIME_SLOTS = [
  { value: '10:00 - 12:00', label: '10:00 - 12:00' },
  { value: '13:00 - 16:00', label: '13:00 - 16:00' },
  { value: '17:00 - 19:00', label: '17:00 - 19:00' },
];

const emptyCourierDraft = {
  streetHouse: '',
  entrance: '',
  floor: '',
  apartmentOffice: '',
  intercom: '',
  comment: '',
};

const CheckoutStep = ({
  step,
  title,
  subtitle,
  expanded,
  locked,
  onToggle,
  children,
}) => (
  <section className={`checkout-step ${expanded ? 'checkout-step--expanded' : ''} ${locked ? 'checkout-step--locked' : ''}`}>
    <button
      type="button"
      className="checkout-step__header"
      onClick={onToggle}
      disabled={locked}
      aria-expanded={expanded}
    >
      <span className="checkout-step__number">{step}</span>
      <span className="checkout-step__heading">
        <span className="checkout-step__title">{title}</span>
        {subtitle ? <span className="checkout-step__subtitle">{subtitle}</span> : null}
      </span>
      <span className="checkout-step__icon" aria-hidden="true">
        <ChevronDown size={22} strokeWidth={1.6} />
      </span>
    </button>
    <div className="checkout-step__body" aria-hidden={!expanded}>
      <div className="checkout-step__body-inner">
        <div className="checkout-step__content">{children}</div>
      </div>
    </div>
  </section>
);

const buildDeliveryDays = () => {
  const formatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const weekday = formatter.format(date).replace('.', '');
    return {
      value: date.toISOString().slice(0, 10),
      day: String(date.getDate()).padStart(2, '0'),
      weekday,
    };
  });
};

const splitStreetAndHouse = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) {
    return { street: '', house: '' };
  }
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { street: value, house: '' };
  }
  return {
    street: parts.slice(0, -1).join(', '),
    house: parts.slice(-1)[0],
  };
};

const getFirstKnownCityKey = (value, cityConfig) => {
  if (!cityConfig) return '';
  const normalized = String(value || '').trim().toLowerCase();
  return (
    Object.entries(cityConfig).find(([, config]) => config.label.toLowerCase() === normalized)?.[0] || ''
  );
};

const formatPrice = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;

const MobileMenuCloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 6L18 18M18 6L6 18"
      stroke="#716A6A"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const isStorePickupPoint = (point) => point?.type === 'Самовывоз из магазина';

const getPickupProviderLabel = (point) => point?.providerLabel || 'СДЭК';

const getAddressFieldLabel = (deliveryMethod, selectedPickupPoint) => {
  if (deliveryMethod === 'courier') {
    return 'Адрес доставки';
  }

  if (deliveryMethod === 'pickup' && selectedPickupPoint) {
    return isStorePickupPoint(selectedPickupPoint) ? 'В магазине' : 'Пункт выдачи';
  }

  return 'Адрес';
};

const PaymentPage = ({ modalMode = false }) => {
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const courierHintRef = useRef(null);
  const prevAddressCompleteRef = useRef(false);
  const prevRecipientCompleteRef = useRef(false);

  const [authToken] = useState(() => localStorage.getItem('authToken') || '');
  const [expandedStep, setExpandedStep] = useState('address');
  const [delivery, setDelivery] = useState({
    city: '',
    method: '',
    pickupPointId: '',
    courierAddress: null,
    deliveryDate: '',
    deliveryTime: '',
  });
  const [recipient, setRecipient] = useState({
    phone: '+7',
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    consentData: false,
    consentMarketing: false,
  });
  const [paymentOption, setPaymentOption] = useState('');
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupDraftId, setPickupDraftId] = useState('');
  const [courierDrawerOpen, setCourierDrawerOpen] = useState(false);
  const [courierHintOpen, setCourierHintOpen] = useState(false);
  const [courierDraft, setCourierDraft] = useState(emptyCourierDraft);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cityConfig, setCityConfig] = useState(null);
  const [cityConfigError, setCityConfigError] = useState(null);

  const loadCityConfig = useCallback(() => {
    setCityConfig(null);
    setCityConfigError(null);
    getDeliveryCities()
      .then((res) => {
        setCityConfig(res.data || {});
      })
      .catch(() => {
        setCityConfigError('Не удалось загрузить настройки доставки.');
      });
  }, []);

  useEffect(() => {
    if (cartItems.length === 0) return undefined;
    loadCityConfig();
    return undefined;
  }, [cartItems.length, loadCityConfig]);

  const subtotal = Number(getTotalPrice()) || 0;
  const deliveryDays = useMemo(() => buildDeliveryDays(), []);
  const currentCity = delivery.city && cityConfig ? cityConfig[delivery.city] : null;
  const pickupPoints = currentCity?.pickupPoints || [];
  const selectedPickupPoint = pickupPoints.find((point) => point.id === delivery.pickupPointId) || null;
  const pickupDraftPoint = pickupPoints.find((point) => point.id === pickupDraftId) || null;
  const addressFieldLabel = getAddressFieldLabel(delivery.method, selectedPickupPoint);
  const pickupProviderLabel = getPickupProviderLabel(selectedPickupPoint);

  const deliveryFee = useMemo(() => {
    if (!currentCity || !delivery.method) return 0;
    return delivery.method === 'pickup' ? currentCity.pickupFee : currentCity.courierFee;
  }, [currentCity, delivery.method]);

  const total = subtotal + deliveryFee;

  const courierDraftComplete = useMemo(() => {
    if (!currentCity || delivery.method !== 'courier') return false;
    return (
      String(courierDraft.streetHouse).trim() &&
      String(courierDraft.entrance).trim() &&
      String(courierDraft.floor).trim() &&
      String(courierDraft.apartmentOffice).trim() &&
      String(courierDraft.intercom).trim()
    );
  }, [courierDraft, currentCity, delivery.method]);

  const recipientComplete = useMemo(() => {
    return (
      String(recipient.phone).trim().length > 3 &&
      String(recipient.email).trim() &&
      String(recipient.firstName).trim() &&
      String(recipient.lastName).trim() &&
      recipient.consentData
    );
  }, [recipient]);

  const addressComplete = useMemo(() => {
    if (!currentCity || !delivery.method) return false;
    if (delivery.method === 'pickup') {
      return Boolean(selectedPickupPoint);
    }
    return Boolean(delivery.courierAddress && delivery.deliveryDate && delivery.deliveryTime);
  }, [currentCity, delivery, selectedPickupPoint]);

  const readyToPay = addressComplete && recipientComplete && Boolean(paymentOption);

  useEffect(() => {
    if (!authToken || !cityConfig) return;

    getCurrentUser(authToken)
      .then((response) => {
        const data = response.data || {};
        const matchedCityKey = getFirstKnownCityKey(data.city, cityConfig);
        setRecipient((prev) => ({
          ...prev,
          phone: formatRuPhone(data.phone || prev.phone),
          email: data.email || '',
          firstName: data.first_name || '',
          lastName: data.last_name || '',
        }));
        if (matchedCityKey) {
          setDelivery((prev) => ({
            ...prev,
            city: prev.city || matchedCityKey,
            method: prev.method || (cityConfig[matchedCityKey].courierAvailable ? '' : 'pickup'),
          }));
        }
        const profileStreet = [data.street, data.house].filter(Boolean).join(', ');
        setCourierDraft((prev) => ({
          ...prev,
          streetHouse: profileStreet || prev.streetHouse,
          apartmentOffice: data.apartment || prev.apartmentOffice,
        }));
      })
      .catch(() => {});
  }, [authToken, cityConfig]);

  useEffect(() => {
    if (!modalMode && !pickupModalOpen && !courierDrawerOpen) {
      return undefined;
    }

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousHtmlOverscroll = html.style.overscrollBehavior;

    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const previousBodyHeight = body.style.height;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    html.style.overscrollBehavior = 'none';

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.height = previousHtmlHeight;
      html.style.overscrollBehavior = previousHtmlOverscroll;

      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      body.style.height = previousBodyHeight;
      body.style.overscrollBehavior = previousBodyOverscroll;

      window.scrollTo(0, scrollY);
    };
  }, [courierDrawerOpen, modalMode, pickupModalOpen]);

  useEffect(() => {
    const justCompletedAddress = addressComplete && !prevAddressCompleteRef.current;
    if (justCompletedAddress && expandedStep === 'address') {
      setExpandedStep('recipient');
    }
    prevAddressCompleteRef.current = addressComplete;
  }, [addressComplete, expandedStep]);

  useEffect(() => {
    const justCompletedRecipient = recipientComplete && !prevRecipientCompleteRef.current;
    if (justCompletedRecipient && expandedStep === 'recipient') {
      setExpandedStep('payment');
    }
    prevRecipientCompleteRef.current = recipientComplete;
  }, [expandedStep, recipientComplete]);

  useEffect(() => {
    if (!courierHintOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (courierHintRef.current && !courierHintRef.current.contains(event.target)) {
        setCourierHintOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [courierHintOpen]);

  const closeCheckout = () => {
    if (modalMode) {
      navigate(-1);
      return;
    }
    navigate('/cart');
  };

  const handleCityChange = (event) => {
    const nextCity = event.target.value;
    const nextCityConfig = nextCity && cityConfig ? cityConfig[nextCity] : null;

    setDelivery({
      city: nextCity,
      method: nextCityConfig ? (nextCityConfig.courierAvailable ? '' : 'pickup') : '',
      pickupPointId: '',
      courierAddress: null,
      deliveryDate: '',
      deliveryTime: '',
    });
    setPickupDraftId('');
    setExpandedStep('address');
    setPaymentOption('');
    setStatus({ type: '', message: '' });
    setCourierHintOpen(false);
  };

  const handleDeliveryMethodChange = (method) => {
    if (!currentCity) return;
    if (method === 'courier' && !currentCity.courierAvailable) return;
    setDelivery((prev) => ({
      ...prev,
      method,
      pickupPointId: '',
      courierAddress: null,
      deliveryDate: '',
      deliveryTime: '',
    }));
    setExpandedStep('address');
    setStatus({ type: '', message: '' });
    setCourierHintOpen(false);
  };

  const openPickupModal = () => {
    setPickupDraftId(delivery.pickupPointId || pickupPoints[0]?.id || '');
    setPickupModalOpen(true);
  };

  const confirmPickupAddress = () => {
    if (!pickupDraftId) return;
    setDelivery((prev) => ({
      ...prev,
      pickupPointId: pickupDraftId,
      courierAddress: null,
      deliveryDate: '',
      deliveryTime: '',
    }));
    setPickupModalOpen(false);
    setExpandedStep('recipient');
  };

  const openCourierDrawer = () => {
    setCourierDraft(delivery.courierAddress || courierDraft);
    setCourierDrawerOpen(true);
  };

  const handleCourierDraftChange = (field) => (event) => {
    const value = event.target.value;
    setCourierDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const confirmCourierAddress = () => {
    if (!courierDraftComplete) return;
    setDelivery((prev) => ({
      ...prev,
      courierAddress: { ...courierDraft },
      pickupPointId: '',
      deliveryDate: '',
      deliveryTime: '',
    }));
    setCourierDrawerOpen(false);
  };

  const handleRecipientChange = (field) => (event) => {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    setRecipient((prev) => ({
      ...prev,
      [field]: value,
    }));
    setStatus({ type: '', message: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!authToken) {
      navigate('/auth');
      return;
    }

    if (!readyToPay) {
      setStatus({ type: 'error', message: 'Заполните обязательные поля и выберите способ оплаты.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    const fullName = [recipient.lastName, recipient.firstName, recipient.middleName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');

    const commentParts = [];
    let orderStreet = '';
    let orderHouse = '';
    let orderApartment = '';

    if (delivery.method === 'pickup' && selectedPickupPoint) {
      orderStreet = selectedPickupPoint.address;
      orderHouse = selectedPickupPoint.name;
      orderApartment = selectedPickupPoint.type;
      commentParts.push(`Самовывоз: ${selectedPickupPoint.address}`);
      commentParts.push(`${pickupProviderLabel}: ${selectedPickupPoint.name}`);
    }

    if (delivery.method === 'courier' && delivery.courierAddress) {
      const splitAddress = splitStreetAndHouse(delivery.courierAddress.streetHouse);
      orderStreet = splitAddress.street || delivery.courierAddress.streetHouse;
      orderHouse = splitAddress.house || `подъезд ${delivery.courierAddress.entrance}`;
      orderApartment = delivery.courierAddress.apartmentOffice;
      commentParts.push(`Подъезд: ${delivery.courierAddress.entrance}`);
      commentParts.push(`Этаж: ${delivery.courierAddress.floor}`);
      commentParts.push(`Домофон: ${delivery.courierAddress.intercom}`);
      if (delivery.courierAddress.comment) {
        commentParts.push(delivery.courierAddress.comment);
      }
      if (delivery.deliveryDate && delivery.deliveryTime) {
        commentParts.push(`Доставка: ${delivery.deliveryDate}, ${delivery.deliveryTime}`);
      }
    }

    try {
      updateProfile(authToken, {
        first_name: recipient.firstName,
        last_name: recipient.lastName,
        email: recipient.email,
        phone: recipient.phone,
        city: currentCity?.label || '',
        street: orderStreet,
        house: orderHouse,
        apartment: orderApartment,
      }).catch(() => {});

      const response = await createOrder(
        {
          full_name: fullName,
          phone: recipient.phone,
          email: recipient.email,
          city: currentCity?.label || '',
          street: orderStreet || 'Уточняется',
          house: orderHouse || '—',
          apartment: orderApartment,
          postal_code: '',
          comment: commentParts.filter(Boolean).join('. '),
          delivery_method: delivery.method === 'pickup' ? 'pickup' : 'courier',
          payment_method: 'card_online',
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
        },
        authToken
      );

      const orderId = response?.data?.id;
      const paymentResponse = await createYooKassaPayment(orderId, authToken);
      const confirmationUrl = paymentResponse?.data?.confirmation_url;
      if (!confirmationUrl) {
        throw new Error('Не удалось получить ссылку на оплату.');
      }

      clearCart();
      window.location.href = confirmationUrl;
    } catch (error) {
      if (error?.__kokoAuthRedirect) {
        return;
      }
      const apiMessage =
        error?.response?.data?.detail ||
        error?.message ||
        'Не удалось создать заказ. Проверьте введённые данные.';
      setStatus({ type: 'error', message: apiMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="payment-page payment-page--empty">
        <div className="payment-shell payment-shell--empty page-animation">
          <button type="button" className="payment-shell__close" onClick={closeCheckout} aria-label="Закрыть оформление заказа">
            <MobileMenuCloseIcon />
          </button>
          <div className="payment-empty">
            <h1>Корзина пуста</h1>
            <p>Добавьте товары в корзину, чтобы перейти к оформлению заказа.</p>
            <button type="button" className="payment-primary-button payment-primary-button--active" onClick={() => navigate('/catalog')}>
              Перейти в каталог
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cityConfigError) {
    return (
      <div className="payment-page payment-page--empty">
        <div className="payment-shell payment-shell--empty page-animation">
          <button type="button" className="payment-shell__close" onClick={closeCheckout} aria-label="Закрыть оформление заказа">
            <X size={24} strokeWidth={1.7} />
          </button>
          <div className="payment-empty">
            <h1>Ошибка загрузки</h1>
            <p>{cityConfigError}</p>
            <button type="button" className="payment-primary-button payment-primary-button--active" onClick={loadCityConfig}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!cityConfig) {
    return (
      <div className="payment-page payment-page--empty">
        <div className="payment-shell payment-shell--empty page-animation">
          <button type="button" className="payment-shell__close" onClick={closeCheckout} aria-label="Закрыть оформление заказа">
            <X size={24} strokeWidth={1.7} />
          </button>
          <div className="payment-empty">
            <h1>Оформление заказа</h1>
            <p>Загружаем тарифы доставки…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`payment-page ${modalMode ? 'payment-page--modal' : ''}`}>
      <div className={`payment-shell page-animation ${modalMode ? 'payment-shell--modal' : ''}`}>
        <div className="payment-shell__top">
          <h1 className="payment-shell__title">ОФОРМЛЕНИЕ ЗАКАЗА</h1>
          <button type="button" className="payment-shell__close" onClick={closeCheckout} aria-label="Закрыть оформление заказа">
            <MobileMenuCloseIcon />
          </button>
        </div>

        <form className="payment-shell__layout" onSubmit={handleSubmit}>
          <div className="payment-shell__main">
            <CheckoutStep
              step={1}
              title="АДРЕС ДОСТАВКИ"
              subtitle={addressComplete ? '' : 'выбрать способ доставки'}
              expanded={expandedStep === 'address'}
              locked={false}
              onToggle={() => setExpandedStep('address')}
            >
              <div className="payment-field-row">
                <div className="payment-field-row__label">Населённый пункт</div>
                <div className="payment-field-row__control">
                  <label className="payment-select">
                    <select value={delivery.city} onChange={handleCityChange}>
                      <option value="">Выберите город</option>
                      {cityConfig
                        ? Object.entries(cityConfig).map(([key, config]) => (
                            <option key={key} value={key}>
                              {config.label}
                            </option>
                          ))
                        : null}
                    </select>
                  </label>
                </div>
              </div>

              <div className="payment-field-row">
                <div className="payment-field-row__label">Способ доставки</div>
                <div className="payment-field-row__control">
                  <div className="payment-radio-row">
                    <label className="payment-radio">
                      <input
                        type="radio"
                        checked={delivery.method === 'pickup'}
                        onChange={() => handleDeliveryMethodChange('pickup')}
                        disabled={!currentCity}
                      />
                      <span>Самовывоз</span>
                    </label>

                    <div className="payment-radio-option">
                      <label className={`payment-radio ${currentCity && !currentCity.courierAvailable ? 'payment-radio--disabled' : ''}`}>
                        <input
                          type="radio"
                          checked={delivery.method === 'courier'}
                          onChange={() => handleDeliveryMethodChange('courier')}
                          disabled={!currentCity || !currentCity.courierAvailable}
                        />
                        <span>Курьер</span>
                        {currentCity?.courierAvailable ? <small>{formatPrice(currentCity.courierFee)}</small> : null}
                      </label>

                      {currentCity && !currentCity.courierAvailable ? (
                        <div
                          ref={courierHintRef}
                          className={`payment-tooltip ${courierHintOpen ? 'payment-tooltip--open' : ''}`}
                          onMouseEnter={() => setCourierHintOpen(true)}
                          onMouseLeave={() => setCourierHintOpen(false)}
                        >
                          <button
                            type="button"
                            className="payment-tooltip__trigger"
                            aria-expanded={courierHintOpen}
                            aria-label="Почему курьер недоступен"
                            onClick={() => setCourierHintOpen((prev) => !prev)}
                          >
                            <Info size={18} strokeWidth={1.8} />
                          </button>
                          <div className="payment-tooltip__bubble" role="tooltip">
                            Пока недоступно в Вашем регионе
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="payment-field-row">
                <div className="payment-field-row__label">{addressFieldLabel}</div>
                <div className="payment-field-row__control">
                  {!delivery.method ? (
                    <button type="button" className="payment-secondary-button payment-secondary-button--disabled" disabled>
                      ВЫБРАТЬ
                    </button>
                  ) : delivery.method === 'pickup' ? (
                    selectedPickupPoint ? (
                      <div className="payment-address-block">
                        <span className="payment-address-block__provider">{pickupProviderLabel}</span>
                        <div className="payment-address-block__actions">
                          <div className="payment-address-block__value">{selectedPickupPoint.address}</div>
                          <button type="button" className="payment-secondary-button" onClick={openPickupModal}>
                            ИЗМЕНИТЬ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="payment-secondary-button" onClick={openPickupModal}>
                        ВЫБРАТЬ
                      </button>
                    )
                  ) : delivery.courierAddress ? (
                    <div className="payment-address-block">
                      <div className="payment-address-block__actions">
                        <div className="payment-address-block__value">{delivery.courierAddress.streetHouse}</div>
                        <button type="button" className="payment-secondary-button" onClick={openCourierDrawer}>
                          ИЗМЕНИТЬ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="payment-secondary-button" onClick={openCourierDrawer}>
                      ВЫБРАТЬ
                    </button>
                  )}
                </div>
              </div>

              {delivery.method === 'courier' && delivery.courierAddress ? (
                <div className="payment-field-row payment-field-row--delivery-time">
                  <div className="payment-field-row__label">Дата и время доставки</div>
                  <div className="payment-field-row__control">
                    <div className="payment-delivery-days">
                      {deliveryDays.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          className={`payment-day-pill ${delivery.deliveryDate === day.value ? 'payment-day-pill--active' : ''}`}
                          onClick={() => setDelivery((prev) => ({ ...prev, deliveryDate: day.value }))}
                        >
                          <span>{day.day}</span>
                          <small>{day.weekday}</small>
                        </button>
                      ))}
                    </div>

                    <div className="payment-time-slots">
                      {DELIVERY_TIME_SLOTS.map((slot) => (
                        <button
                          key={slot.value}
                          type="button"
                          className={`payment-time-pill ${delivery.deliveryTime === slot.value ? 'payment-time-pill--active' : ''}`}
                          onClick={() => setDelivery((prev) => ({ ...prev, deliveryTime: slot.value }))}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CheckoutStep>

            <CheckoutStep
              step={2}
              title="ПОЛУЧАТЕЛЬ"
              subtitle={recipientComplete ? '' : 'уточните данные'}
              expanded={expandedStep === 'recipient'}
              locked={!addressComplete}
              onToggle={() => {
                if (!addressComplete) return;
                setExpandedStep('recipient');
              }}
            >
              <div className="payment-recipient">
                <div className="payment-recipient__group">
                  <h2>КОНТАКТЫ</h2>
                  <div className="payment-recipient__grid">
                    <label className="payment-input">
                      <span>Номер телефона <b>*</b></span>
                      <input
                        type="tel"
                        value={recipient.phone}
                        onChange={(event) =>
                          setRecipient((prev) => ({ ...prev, phone: formatRuPhone(event.target.value) }))
                        }
                        onKeyDown={(event) => {
                          if (!isPhoneInputKeyAllowed(event)) {
                            event.preventDefault();
                          }
                        }}
                        placeholder="Введите номер"
                      />
                    </label>

                    <label className="payment-input">
                      <span>Контактная почта <b>*</b></span>
                      <input
                        type="email"
                        value={recipient.email}
                        onChange={handleRecipientChange('email')}
                        placeholder="Введите почту"
                      />
                    </label>
                  </div>
                </div>

                <div className="payment-recipient__group">
                  <h2>ДАННЫЕ</h2>
                  <div className="payment-recipient__grid">
                    <label className="payment-input">
                      <span>Имя <b>*</b></span>
                      <input
                        type="text"
                        value={recipient.firstName}
                        onChange={handleRecipientChange('firstName')}
                        placeholder="Введите Ваше имя"
                      />
                    </label>

                    <label className="payment-input">
                      <span>Фамилия <b>*</b></span>
                      <input
                        type="text"
                        value={recipient.lastName}
                        onChange={handleRecipientChange('lastName')}
                        placeholder="Введите Вашу фамилию"
                      />
                    </label>

                    <label className="payment-input">
                      <span>Отчество</span>
                      <input
                        type="text"
                        value={recipient.middleName}
                        onChange={handleRecipientChange('middleName')}
                        placeholder="Введите Ваше отчество"
                      />
                    </label>
                  </div>

                  <label className="payment-checkbox">
                    <input
                      type="checkbox"
                      checked={recipient.consentData}
                      onChange={handleRecipientChange('consentData')}
                    />
                    <span>Я даю согласие на передачу моих персональных данных с целью осуществления доставки товара третьим лицам <b>*</b></span>
                  </label>

                  <label className="payment-checkbox">
                    <input
                      type="checkbox"
                      checked={recipient.consentMarketing}
                      onChange={handleRecipientChange('consentMarketing')}
                    />
                    <span>Я даю согласие на получение рекламных рассылок в виде sms, email или в мессенджерах</span>
                  </label>
                </div>
              </div>
            </CheckoutStep>

            <CheckoutStep
              step={3}
              title="СПОСОБЫ ОПЛАТЫ"
              subtitle={paymentOption ? '' : 'выберите вариант'}
              expanded={expandedStep === 'payment'}
              locked={!recipientComplete}
              onToggle={() => {
                if (!recipientComplete) return;
                setExpandedStep('payment');
              }}
            >
              <div className="payment-payments">
                <h2>ВЫБЕРИТЕ ВАРИАНТ ОПЛАТЫ</h2>
                <div className="payment-payments__list">
                  {PAYMENT_OPTIONS.map((option) => (
                    <label key={option.value} className="payment-radio payment-radio--payment">
                      <input
                        type="radio"
                        name="payment-option"
                        checked={paymentOption === option.value}
                        onChange={() => setPaymentOption(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CheckoutStep>
          </div>

          <aside className="payment-summary">
            <h2>СУММА ЗАКАЗА</h2>
            <div className="payment-summary__row">
              <span>Стоимость товаров:</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {delivery.method === 'courier' && deliveryFee > 0 ? (
              <div className="payment-summary__row">
                <span>Курьер:</span>
                <span>{formatPrice(deliveryFee)}</span>
              </div>
            ) : null}
            <div className="payment-summary__divider" />
            <div className="payment-summary__row payment-summary__row--total">
              <span>ИТОГО:</span>
              <span>{formatPrice(total)}</span>
            </div>
            <button
              type="submit"
              className={`payment-primary-button ${readyToPay ? 'payment-primary-button--active' : ''}`}
              disabled={!readyToPay || isSubmitting}
            >
              {isSubmitting ? 'ПЕРЕХОД...' : 'ОПЛАТИТЬ'}
            </button>
            {status.message ? (
              <div className={`payment-status payment-status--${status.type || 'error'}`}>
                {status.message}
              </div>
            ) : null}
          </aside>
        </form>
      </div>

      {pickupModalOpen
        ? createPortal(
            <div className="payment-pickup-modal" role="dialog" aria-modal="true" aria-label="Выбор пункта самовывоза">
              <div className="payment-pickup-modal__map" aria-hidden="true">
                <div className="payment-pickup-modal__map-placeholder">
                  <span>ЗАГЛУШКА</span>
                </div>
              </div>
              <div className="payment-pickup-modal__panel">
                <button type="button" className="payment-shell__close payment-pickup-modal__close" onClick={() => setPickupModalOpen(false)} aria-label="Закрыть выбор пункта самовывоза">
                  <MobileMenuCloseIcon />
                </button>
                <h2>САМОВЫВОЗ</h2>
                <div className="payment-input">
                  <span>Пункт выдачи</span>
                  <label className="payment-select payment-select--light">
                    <select value={pickupDraftId} onChange={(event) => setPickupDraftId(event.target.value)}>
                      <option value="">Выберите вариант</option>
                      {pickupPoints.map((point) => (
                        <option key={point.id} value={point.id}>
                          {point.address}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {pickupDraftPoint ? (
                  <div className="payment-pickup-modal__details">
                    <p>Тип: {pickupDraftPoint.type}</p>
                    <p>Вес: {pickupDraftPoint.weight}</p>
                    <p>Время работы: {pickupDraftPoint.hours}</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  className={`payment-primary-button ${pickupDraftId ? 'payment-primary-button--active' : ''}`}
                  disabled={!pickupDraftId}
                  onClick={confirmPickupAddress}
                >
                  ПОДТВЕРДИТЬ АДРЕС
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {courierDrawerOpen
        ? createPortal(
            <div className="payment-drawer-layer" role="dialog" aria-modal="true" aria-label="Курьерский адрес">
              <button type="button" className="payment-drawer-layer__backdrop" onClick={() => setCourierDrawerOpen(false)} aria-label="Закрыть форму адреса доставки" />
              <aside className="payment-drawer">
                <button type="button" className="payment-shell__close payment-drawer__close" onClick={() => setCourierDrawerOpen(false)} aria-label="Закрыть форму адреса доставки">
                  <MobileMenuCloseIcon />
                </button>
                <h2>АДРЕС ДОСТАВКИ</h2>
                <p className="payment-drawer__city">{currentCity?.label || ''}</p>

                <div className="payment-drawer__fields">
                  <input
                    type="text"
                    value={courierDraft.streetHouse}
                    onChange={handleCourierDraftChange('streetHouse')}
                    placeholder="Улица и дом"
                  />
                  <div className="payment-drawer__grid">
                    <input
                      type="text"
                      value={courierDraft.entrance}
                      onChange={handleCourierDraftChange('entrance')}
                      placeholder="Подъезд"
                    />
                    <input
                      type="text"
                      value={courierDraft.floor}
                      onChange={handleCourierDraftChange('floor')}
                      placeholder="Этаж"
                    />
                    <input
                      type="text"
                      value={courierDraft.apartmentOffice}
                      onChange={handleCourierDraftChange('apartmentOffice')}
                      placeholder="Кв./офис"
                    />
                    <input
                      type="text"
                      value={courierDraft.intercom}
                      onChange={handleCourierDraftChange('intercom')}
                      placeholder="Домофон"
                    />
                  </div>
                  <input
                    type="text"
                    value={courierDraft.comment}
                    onChange={handleCourierDraftChange('comment')}
                    placeholder="Комментарий"
                  />
                </div>

                <button
                  type="button"
                  className={`payment-primary-button ${courierDraftComplete ? 'payment-primary-button--active' : ''}`}
                  disabled={!courierDraftComplete}
                  onClick={confirmCourierAddress}
                >
                  ПОДТВЕРДИТЬ АДРЕС
                </button>
              </aside>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default PaymentPage;
