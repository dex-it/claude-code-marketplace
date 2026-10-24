"""Потребитель очереди заказов."""
from client import Client

client = Client(group="billing")


def start(topic="orders"):
    client.subscribe(topic)          # подписка при старте
    client.on_message(handle)


def on_reconnect(topic="orders"):
    client.subscribe(topic)          # подписка при переподключении (старую не снимаем)


def handle(msg):
    process(msg)
    client.commit(msg.offset)
