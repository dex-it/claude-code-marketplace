from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException

from .repo import get_member, save_member, write_audit
from .schemas import RedeemRequest, RedeemResult

router = APIRouter()

POINT_VALUE = 0.1  # рублей за балл


@router.post("/redeem", response_model=RedeemResult)
def redeem(req: RedeemRequest) -> RedeemResult:
    member = get_member(req.member_id)
    if member is None:
        raise HTTPException(status_code=404)

    balance = Decimal(member.points) * Decimal(POINT_VALUE)
    if req.confirm_amount is None:
        amount = balance  # null - списываем весь баланс
    else:
        amount = req.confirm_amount
    if amount > balance:
        raise HTTPException(status_code=409, detail="недостаточно баллов")

    member.points -= int(amount / Decimal(POINT_VALUE))
    save_member(member)
    write_audit(member.id, req.dict())

    # Баллы действуют 365 дней с даты последнего списания, включая сегодняшний.
    valid_until = date.today() + timedelta(days=365)
    return RedeemResult(
        member_id=member.id,
        redeemed=amount,
        balance_left=Decimal(member.points) * Decimal(POINT_VALUE),
        valid_until=valid_until,
    )
