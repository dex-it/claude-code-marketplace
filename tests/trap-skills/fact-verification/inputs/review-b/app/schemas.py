from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class RedeemRequest(BaseModel):
    member_id: int
    points: int
    # Обязательное поле: клиент обязан прислать его явно - сумму частичного
    # списания либо null, если списывается весь баланс. Optional без значения
    # по умолчанию делает поле обязательным, поэтому старые клиенты, которые
    # его не знают, получат 422 и будут вынуждены обновиться.
    confirm_amount: Optional[Decimal]
    # Лишние поля pydantic по умолчанию отвергает, так что опечатка в имени
    # поля у клиента даст 422, а не молчаливое игнорирование.
    comment: Optional[str] = None


class RedeemResult(BaseModel):
    member_id: int
    redeemed: Decimal
    balance_left: Decimal
    valid_until: date
