class ReportBuilder:
    def __init__(self, title: str):
        self.title = title
        self.body = ""
        self.accrued = 0
        self.skipped = 0

    def add_accrual(self, tx_id: str, points: int) -> None:
        self.accrued += 1
        self.body += f"+ {tx_id}: {points}\n"

    def add_skipped(self, tx_id: str, reason: str) -> None:
        self.skipped += 1
        self.body += f"- {tx_id}: {reason}\n"

    def render(self) -> str:
        header = f"{self.title}\nначислено: {self.accrued}, пропущено: {self.skipped}\n"
        return header + self.body
