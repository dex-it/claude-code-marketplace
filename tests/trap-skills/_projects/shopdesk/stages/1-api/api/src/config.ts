export const config = {
  port: Number(process.env.PORT ?? 3000),
  notifierUrl: process.env.NOTIFIER_URL ?? 'http://localhost:4010',
  analyticsUrl: process.env.ANALYTICS_URL ?? 'http://localhost:4020',
};
