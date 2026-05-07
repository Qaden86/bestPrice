import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

// отдаём JSON результат
app.get('/api/results', (req, res) => {
  const filePath = path.join(__dirname, '../crawler-result.json');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  res.json(data);
});

// простая HTML страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Dashboard running: http://localhost:${PORT}`);
});