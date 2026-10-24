export const config = {
  port: Number(process.env.PORT ?? 3000),
  courierService: {
    url: process.env.COURIER_URL ?? 'http://127.0.0.1:4020',
    token: process.env.COURIER_TOKEN ?? '',
  },
};
