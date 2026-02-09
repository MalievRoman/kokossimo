"""
Telegram-бот для сбора обратной связи (отзывы, предложения, просьбы о связи).
Сохраняет данные в модель Feedback. Запуск: python manage.py run_telegram_bot
"""
import asyncio
import logging
import os
import re
from typing import Optional, Tuple

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.management.base import BaseCommand
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from shop.models import Feedback

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Состояния диалога
(
    CHOOSE_TYPE,
    ENTER_TEXT,
    ENTER_CONTACT,  # только для "просьба о связи"
) = range(3)

TYPE_REVIEW = "review"
TYPE_SUGGESTION = "suggestion"
TYPE_CONTACT = "contact_request"

# Текст кнопок на панели (должны совпадать с тем, что видит пользователь)
BTN_REVIEW = "✍️ Оставить отзыв"
BTN_SUGGESTION = "💡 Предложение"
BTN_CONTACT = "📞 Просьба о связи"
BTN_CANCEL = "↩️ Отмена"

BUTTON_TO_TYPE = {
    BTN_REVIEW: TYPE_REVIEW,
    BTN_SUGGESTION: TYPE_SUGGESTION,
    BTN_CONTACT: TYPE_CONTACT,
}

# Валидация телефона и email
PHONE_DIGITS_RE = re.compile(r"[\d+]")
EMAIL_RE = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)


def normalize_phone(raw: str) -> str:
    """Оставляет в строке только цифры и плюс для номера."""
    return "".join(PHONE_DIGITS_RE.findall(raw))


def is_valid_phone(phone: str) -> bool:
    """
    Проверка формата телефона: РФ и подобные.
    Допускаются: 10 цифр, 11 цифр (7/8 в начале), +7...
    """
    digits = normalize_phone(phone)
    if not digits:
        return False
    if digits.startswith("+"):
        digits = digits[1:]
    if len(digits) == 10 and digits[0] in "789":
        return True
    if len(digits) == 11 and digits[0] in "78":
        return True
    return False


def is_valid_email(email: str) -> bool:
    """Проверка формата email."""
    return bool(email and EMAIL_RE.match(email.strip()))


def parse_contact_line(contact_line: str) -> Tuple[str, str]:
    """Разбирает строку на телефон и email. Возвращает (phone, email)."""
    phone, email = "", ""
    for part in contact_line.replace(",", " ").split():
        part = part.strip()
        if not part:
            continue
        if "@" in part and "." in part:
            email = part
        else:
            phone = part if not phone else f"{phone}, {part}"
    if not phone and not email:
        phone = contact_line
    return (phone, email)


def get_welcome_keyboard():
    """Клавиатура приветствия - только выбор действий, без кнопки отмены."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_REVIEW)],
            [KeyboardButton(BTN_SUGGESTION)],
            [KeyboardButton(BTN_CONTACT)],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        is_persistent=True,
        input_field_placeholder="Выберите действие...",
    )


def get_action_keyboard():
    """Клавиатура после выбора действия - только кнопка отмены."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BTN_CANCEL)],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
        is_persistent=True,
        input_field_placeholder="Введите текст или нажмите отмена...",
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Команда /start — приветствие и кнопки на панели."""
    await update.message.reply_text(
        "👋 Здравствуйте!\n\n"
        "Нам важно ваше мнение. Здесь вы можете:\n"
        "• оставить отзыв\n"
        "• поделиться предложением\n"
        "• попросить связаться с вами\n\n"
        "Выберите действие кнопкой ниже — это займёт пару минут.",
        reply_markup=get_welcome_keyboard(),
    )
    return CHOOSE_TYPE


async def button_choose_type(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Пользователь нажал кнопку на панели (отзыв / предложение / просьба о связи)."""
    text = (update.message.text or "").strip()

    if text not in BUTTON_TO_TYPE:
        await update.message.reply_text(
            "Выберите, пожалуйста, одно из действий кнопкой ниже 👇",
            reply_markup=get_welcome_keyboard(),
        )
        return CHOOSE_TYPE

    context.user_data["feedback_type"] = BUTTON_TO_TYPE[text]

    type_labels = {
        TYPE_REVIEW: "✍️ отзыв",
        TYPE_SUGGESTION: "💡 предложение",
        TYPE_CONTACT: "📞 просьбу о связи",
    }
    label = type_labels[context.user_data["feedback_type"]]

    await update.message.reply_text(
        f"Отлично, вы выбрали {label}.\n\n"
        "Напишите ваше сообщение — мы обязательно прочитаем:",
        reply_markup=get_action_keyboard(),
    )
    return ENTER_TEXT


async def receive_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Пользователь прислал текст сообщения."""
    text = (update.message.text or "").strip()

    if text == BTN_CANCEL:
        context.user_data.clear()
        await update.message.reply_text(
            "↩️ Отменили. Выберите действие кнопкой ниже, когда будете готовы:",
            reply_markup=get_welcome_keyboard(),
        )
        return CHOOSE_TYPE

    if not text:
        await update.message.reply_text(
            "Напишите, пожалуйста, текст сообщения — пустое мы не отправим 😊",
            reply_markup=get_action_keyboard(),
        )
        return ENTER_TEXT

    context.user_data["feedback_text"] = text
    feedback_type = context.user_data.get("feedback_type", TYPE_REVIEW)

    if feedback_type == TYPE_CONTACT:
        await update.message.reply_text(
            "📱 Осталось оставить контакт для связи.\n\n"
            "Напишите телефон и/или email одним сообщением.\n"
            "Например: +7 999 123-45-67 или example@mail.ru",
            reply_markup=get_action_keyboard(),
        )
        return ENTER_CONTACT

    return await save_feedback_and_finish(update, context)


async def receive_contact(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Пользователь прислал контакт для просьбы о связи."""
    text = (update.message.text or "").strip()

    if text == BTN_CANCEL:
        context.user_data.clear()
        await update.message.reply_text(
            "↩️ Отменили. Выберите действие кнопкой ниже:",
            reply_markup=get_welcome_keyboard(),
        )
        return CHOOSE_TYPE

    contact_line = text
    phone, email = parse_contact_line(contact_line)

    if not phone and not email:
        await update.message.reply_text(
            "📱 Напишите телефон и/или email одним сообщением.\n"
            "Например: +7 999 123-45-67 или example@mail.ru",
            reply_markup=get_action_keyboard(),
        )
        return ENTER_CONTACT

    errors = []
    if phone and not is_valid_phone(phone):
        errors.append("📞 Телефон: укажите в формате +7 999 123-45-67 или 89991234567")
    if email and not is_valid_email(email):
        errors.append("✉️ Email: укажите в формате example@mail.ru")

    if errors:
        await update.message.reply_text(
            "Не получилось распознать контакт:\n\n" + "\n".join(errors) + "\n\nПопробуйте ещё раз 👇",
            reply_markup=get_action_keyboard(),
        )
        return ENTER_CONTACT

    context.user_data["contact_phone"] = phone
    context.user_data["contact_email"] = email
    return await save_feedback_and_finish(update, context)


def _create_feedback(
    feedback_type: str,
    text: str,
    telegram_user_id: Optional[int],
    telegram_username: str,
    contact_phone: str,
    contact_email: str,
) -> None:
    """Синхронное сохранение в БД (вызывается через sync_to_async)."""
    Feedback.objects.create(
        feedback_type=feedback_type,
        text=text,
        telegram_user_id=telegram_user_id,
        telegram_username=telegram_username,
        contact_phone=contact_phone,
        contact_email=contact_email,
    )


async def save_feedback_and_finish(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Сохраняем Feedback в БД и завершаем диалог."""
    user = update.effective_user
    feedback_type = context.user_data.get("feedback_type", TYPE_REVIEW)
    text = context.user_data.get("feedback_text", "")

    telegram_user_id = user.id if user else None
    telegram_username = ("@" + user.username) if user and user.username else ""

    try:
        await sync_to_async(_create_feedback)(
            feedback_type=feedback_type,
            text=text,
            telegram_user_id=telegram_user_id,
            telegram_username=telegram_username,
            contact_phone=context.user_data.get("contact_phone", ""),
            contact_email=context.user_data.get("contact_email", ""),
        )
    except Exception as e:
        logger.exception("Ошибка при сохранении обратной связи в БД: %s", e)
        await update.message.reply_text(
            "😔 Что-то пошло не так — сообщение не сохранилось. Попробуйте позже или напишите нам другим способом.",
            reply_markup=get_welcome_keyboard(),
        )
        context.user_data.clear()
        return CHOOSE_TYPE

    await update.message.reply_text(
        "✅ Готово! Спасибо, что нашли время — мы обязательно ознакомимся с вашим сообщением.\n\n"
        "Можете отправить ещё одно обращение или выбрать другое действие:",
        reply_markup=get_welcome_keyboard(),
    )
    context.user_data.clear()
    return CHOOSE_TYPE


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Отмена по команде /cancel."""
    context.user_data.clear()
    await update.message.reply_text(
        "↩️ Отменили. Выберите действие кнопкой ниже:",
        reply_markup=get_welcome_keyboard(),
    )
    return CHOOSE_TYPE


class Command(BaseCommand):
    help = "Запуск Telegram-бота для сбора обратной связи"

    def add_arguments(self, parser):
        parser.add_argument(
            "--token",
            type=str,
            default=getattr(settings, "TELEGRAM_BOT_TOKEN", None) or os.getenv("TELEGRAM_BOT_TOKEN"),
            help="Telegram Bot Token (или TELEGRAM_BOT_TOKEN в .env)",
        )

    def handle(self, *args, **options):
        token = options.get("token")
        if not token:
            self.stderr.write(
                "Укажите TELEGRAM_BOT_TOKEN в .env или передайте --token"
            )
            return

        conv = ConversationHandler(
            entry_points=[CommandHandler("start", start)],
            states={
                CHOOSE_TYPE: [
                    MessageHandler(filters.TEXT & ~filters.COMMAND, button_choose_type),
                ],
                ENTER_TEXT: [
                    MessageHandler(filters.TEXT & ~filters.COMMAND, receive_text),
                ],
                ENTER_CONTACT: [
                    MessageHandler(filters.TEXT & ~filters.COMMAND, receive_contact),
                ],
            },
            fallbacks=[CommandHandler("cancel", cancel)],
        )

        app = Application.builder().token(token).build()
        app.add_handler(conv)

        self.stdout.write("Бот запущен. Остановка: Ctrl+C")
        asyncio.run(app.run_polling())
