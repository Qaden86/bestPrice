import express from 'express';
import fs from 'fs';
import path from 'path';

import { RESULTS_PATH } from '../config/path';

const app = express();

const publicDir = path.join(
  process.cwd(),
  'dashboard'
);

app.use(express.static(publicDir));

app.get('/api/results', (_, res) => {
  try {
    const raw = fs.readFileSync(
      RESULTS_PATH,
      'utf-8'
    );

    res.json(JSON.parse(raw));
  } catch (e) {
    console.error('[API ERROR]', e);

    res.json([]);
  }
});

app.listen(3000, () => {
  console.log(
    'Dashboard: http://localhost:3000'
  );
});