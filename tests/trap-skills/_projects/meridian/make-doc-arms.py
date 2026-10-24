#!/usr/bin/env python3
"""Входы прогонов документ-кейсов #432: выдержки из тел `design-reviewer` и `requirements-reviewer` в
codebase-conventions/inputs/. Исполнителю прогона подаётся файл дисциплины путём (Skill tool ему не выдан), поэтому
в выдержку входят Phase 1 (контекст проекта, перечень Accepted ADR) и Phase 6 (шкала severity, в которой ADR
тоже названы), строка загрузки скилла из Phase 1 убрана.

  p - выдержка как есть, без нормы «решение документа против Accepted ADR» (контроль нормы);
  n - то же с нормой (design-reviewer: слово в слово из Phase 1; requirements-reviewer: кандидат, в агенте нормы нет).

Использование: make-doc-arms.py [--check]   без флага пишет inputs/*.md, с флагом сверяет их с телами агентов
(код возврата 1 при расхождении: тело агента ушло от снимка, прогон надо переписывать под новый снимок).
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
OUT = os.path.join(HERE, "..", "..", "codebase-conventions", "inputs")
DESIGN = os.path.join(ROOT, "plugins/specialists/architecture/dex-design-reviewer/agents/design-reviewer.md")
REQS = os.path.join(ROOT, "plugins/specialists/review/dex-requirements-reviewer/agents/requirements-reviewer.md")
NORM_D = ("Решение документа против `Accepted` ADR (читать актуальный в supersede-цепочке): либо документ объявляет "
          "отмену прежнего решения (правка того ADR либо supersede), либо это дефект.")
NORM_R = NORM_D.replace("Решение документа", "Требование документа")


def phase(text, n):
    m = re.search(r"^## Phase %d:.*?(?=^## Phase %d:)" % (n, n + 1), text, re.S | re.M)
    assert m, n
    return m.group(0).rstrip() + "\n"


def build(path, title, with_norm, norm):
    text = open(path, encoding="utf-8").read()
    p1 = phase(text, 1)
    lines = p1.split("\n")
    out = []
    for ln in lines:
        if ln.startswith("Загрузи `dex-skill-codebase-conventions"):
            continue  # скилла в прогоне нет
        if ln == NORM_D:
            if with_norm:
                out.append(ln)
            continue
        out.append(ln)
    p1 = "\n".join(out).rstrip() + "\n"
    if with_norm and norm not in p1:
        p1 += "\n" + norm + "\n"
    return f"# {title}\n\n{p1}\n{phase(text, 6)}"


files = {
    "DESIGN-REVIEWER-p.md": build(DESIGN, "Ревьюер дизайна: дисциплина", False, NORM_D),
    "DESIGN-REVIEWER-n.md": build(DESIGN, "Ревьюер дизайна: дисциплина", True, NORM_D),
    "REQUIREMENTS-REVIEWER-p.md": build(REQS, "Ревьюер требований: дисциплина", False, NORM_R),
    "REQUIREMENTS-REVIEWER-n.md": build(REQS, "Ревьюер требований: дисциплина", True, NORM_R),
}
bad = 0
for name, body in files.items():
    full = os.path.join(OUT, name)
    if "--check" in sys.argv:
        same = os.path.exists(full) and open(full, encoding="utf-8").read() == body
        print(("ok    " if same else "РАЗНИЦА ") + name)
        bad += not same
    else:
        open(full, "w", encoding="utf-8").write(body)
        print("записан", name, len(body), "символов")
sys.exit(1 if bad else 0)
