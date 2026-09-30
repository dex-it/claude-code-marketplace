# FEAT-4. Срок жизни сессии

R1. isExpired(session) - true, если текущее время >= session.createdAt + session.ttlMs, иначе false.
R2. createSession({ ttlMs }) с ttlMs <= 0 отклоняется как неверный вход.
