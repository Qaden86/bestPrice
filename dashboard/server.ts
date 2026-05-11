import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();

app.use(express.static('dashboard'));

app.get('/api/results', (_, res) => {

  const file = path.join(
    process.cwd(),
    'storage',
    'results.json'
  );

  // 🔥 FIX: файл может отсутствовать
  if (!fs.existsSync(file)) {

    return res.json({
      results: [],
      success: 0,
      failed: 0
    });
  }

  const raw = fs.readFileSync(file, 'utf-8');

  const results = JSON.parse(raw || '[]');

  const success = results.filter(
    (x: any) => x.finalOk === true
  ).length;

  const failed = results.filter(
    (x: any) => x.finalOk === false
  ).length;

  res.json({
    results,
    success,
    failed
  });
});

app.listen(3000, () => {
  console.log('Dashboard: http://localhost:3000');
});