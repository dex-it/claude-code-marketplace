export const config = {
  port: Number(process.env.PORT ?? 3000),
  // файл базы SQLite; по умолчанию - база в памяти процесса, заполняется из data/orders-sample.json
  dbPath: process.env.DB_PATH ?? ':memory:',
  courierService: {
    url: process.env.COURIER_URL ?? 'http://127.0.0.1:4020',
    token: process.env.COURIER_TOKEN ?? '',
  },
};
