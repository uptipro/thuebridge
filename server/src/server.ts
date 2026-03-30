import { app } from './app.js';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`FaaS server listening on http://localhost:${port}`);
});
