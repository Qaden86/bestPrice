import express from 'express';
import fs from 'fs';
import { RESULTS_PATH } from '../config/path';
import path from 'path';

const app = express();

app.use(express.static(path.join(process.cwd(), 'dashboard')));

app.get('/api/results', (_, res) => {
  try {
    const data = fs.readFileSync(RESULTS_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

app.listen(3000, () => {
  console.log('Dashboard: http://localhost:3000');
});