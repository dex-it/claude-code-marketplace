#!/usr/bin/env python3
import sys
try: ok = open('out/t1.txt', encoding='utf-8').read().strip() == 'ok'
except OSError: ok = False
print('OK' if ok else 'FAIL'); sys.exit(0 if ok else 1)
