#!/usr/bin/env python3
"""Проверка документов-кейсов #432 без запуска исполнителя: мутации различаются только слотами ключа,
приманки и ловушки на месте, ссылки на ADR существуют, статусы источников такие, как записаны в ключе.

Использование: python3 check-doc-cases.py   (из любого каталога; код возврата 0 - всё сходится)
"""
import difflib
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import doc_cases as DC  # noqa: E402
import docs_data as D  # noqa: E402

fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


# --- статусы и тексты источников, на которые опирается ключ ------------------------------------------------
adr = {f"ADR-{n:04d}": (status, dec + " " + why) for n, _, _, status, _, _, dec, why in D.PLATFORM_ADR}
for svc, (pfx, items) in D.SERVICE_ADR.items():
    for n, _, _, status, _, _, dec, why, _ in items:
        adr[f"{pfx}-ADR-{n:03d}"] = (status, dec + " " + why)
for n, _, _, status, _, dec in D.RECORDS:
    adr[f"REC-{n:02d}"] = (status, dec)

expect = {
    "ADR-0021": "Accepted", "ADR-0009": "Superseded by ADR-0021", "REC-07": "Superseded by ADR-0009",
    "ADR-0026": "Accepted", "ADR-0019": "Superseded by ADR-0026", "ADR-0011": "Superseded by ADR-0019",
    "SHP-ADR-002": "Accepted", "SHP-ADR-001": "Accepted", "ADR-0013": "Accepted", "ADR-0010": "Deprecated",
    "ADR-0032": "Proposed", "ADR-0028": "Accepted", "ADR-0031": "Accepted", "NTF-ADR-001": "Accepted",
    "NTF-ADR-002": "Accepted", "NTF-ADR-003": "Deprecated",
}
for k, st in expect.items():
    check(k in adr and adr[k][0] == st, f"{k}: статус {adr.get(k, ('нет',))[0]!r}, ожидался {st!r}")
check("ADR-0035" not in adr, "ADR-0035 уже существует: правка в документе объявляет новый номер")
check("5 лет" in adr["ADR-0028"][1], "ADR-0028 не называет 5 лет")
check("пяти" in adr["NTF-ADR-002"][1] or "пять" in adr["NTF-ADR-002"][1], "NTF-ADR-002 не называет порог пяти ошибок")
check("смещение" in adr["ADR-0013"][1], "ADR-0013 не запрещает смещение")


def lines(text):
    return text.replace("\n", " ").split(". ")


def changed(a, b):
    """Абзацы (по пустой строке), отличающиеся между вариантами."""
    pa, pb = a.split("\n\n"), b.split("\n\n")
    out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, pa, pb, autojunk=False).get_opcodes():
        if tag != "equal":
            out.extend((x, "") for x in pa[i1:i2])
            out.extend(("", y) for y in pb[j1:j2])
    return out


def heads(pairs):
    names = set()
    for a, b in pairs:
        for t in (a, b):
            m = re.match(r"\s*(Д\d|FR-N\d|NFR-N\d|## [^\n]+)", t)
            if m:
                names.add(m.group(1))
    return names


def flat(t):
    return re.sub(r"\s+", " ", t)


dA, d0, dU = (DC.design_doc(v) for v in ("A", "0", "U"))
check(heads(changed(d0, dA)) == {"Д3", "Д5", "Д6"}, f"A против 0 различаются не только Д3, Д5, Д6: {heads(changed(d0, dA))}")
hu = heads(changed(d0, dU))
check(hu <= {"Д7", "## Изменения ADR", "## Открытые вопросы"} and "Д7" in hu, f"0 против U различаются не только Д7 и разделом изменений: {hu}")
check(dA.count("## Изменения ADR") == 1 and d0.count("## Изменения ADR") == 1 and "## Изменения ADR" not in dU, "раздел «Изменения ADR»")
check("ADR-0013" not in dU and "ADR-0035" not in dU, "в U есть ссылка на ADR-0013 или ADR-0035: отмена не должна быть объявлена и не должна быть подсказана")
for lure in ("IBus.PublishAsync", "AddPolicyHandler", "KeyNotFoundException"):
    check(lure in flat(dA), f"ловушка {lure} не в A")
    check(lure not in flat(d0) and lure not in flat(dU), f"ловушка {lure} в чистом варианте")
for need in ("AddStandardResilienceHandler", "IOutbox.EnqueueAsync", "ShippingError"):
    check(need in d0 and need in dU and need not in dA, f"верное решение {need}")
for decoy in ("feature_switches", "разделения по арендаторам нет"):
    check(all(decoy in t for t in (dA, d0, dU)), f"приманка {decoy} не во всех вариантах")

rA, r0 = DC.requirements_doc("A"), DC.requirements_doc("0")
check(heads(changed(r0, rA)) == {"FR-N4", "FR-N5", "NFR-N1"}, f"RA против R0: {heads(changed(r0, rA))}")
for lure in ("сразу после сохранения заказа", "7 лет", "без релиза сервиса"):
    check(lure in flat(rA) and lure not in flat(r0), f"ловушка {lure}")
for decoy in ("SMS", "NTF-ADR-002", "разделения по арендаторам нет", "## Изменения ADR"):
    check(decoy in rA and decoy in r0, f"приманка {decoy}")

# --- каждый названный в документах ADR существует ----------------------------------------------------------
for name, text in (("A", dA), ("0", d0), ("U", dU), ("RA", rA), ("R0", r0)):
    for ref in sorted(set(re.findall(r"\b(?:[A-Z]{3}-)?ADR-\d{3,4}\b|\bREC-\d\d\b", text))):
        check(ref in adr or ref == "ADR-0035", f"{name}: ссылка {ref} не существует")

# --- все ветки собираются --------------------------------------------------------------------------------
for branch, (path, text, *_rest) in DC.BRANCHES.items():
    check(text().endswith("\n") and path.startswith("docs/"), f"{branch}: текст или путь")

if fails:
    print("\n".join("FAIL: " + f for f in fails))
    sys.exit(1)
print("OK: мутации различаются только слотами ключа, приманки и ловушки на месте, ссылки существуют")
