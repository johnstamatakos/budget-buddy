import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseFile } from './parsers/index.js';
import { analyzeTransactions } from './ai/transactionAnalyzer.js';
import { normalizeTransactions } from './utils/normalizeTransactions.js';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const monthlyIncome = parseFloat(req.body.monthlyIncome) || 0;

    const rawData = await parseFile(buffer, mimetype, originalname);
    const rawTransactions = await analyzeTransactions(rawData);
    const transactions = normalizeTransactions(rawTransactions);

    return res.json({ transactions, monthlyIncome });
  } catch (err) {
    console.error('Error in /api/analyze:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Budget Buddy server running on http://localhost:${PORT}`);
});
