const express = require('express');
const router = express.Router();
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs');

const upload = multer({ dest: '/tmp/' });

router.post('/convert', upload.single('doc'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = req.file.path;

  try {
    const { value: text } = await mammoth.extractRawText({ path: filePath });

    const flat = text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    const productName = find(flat, /Product Name\s+(.+?)\s+(?:Product Number|Status)/i) || 'Unknown Product';
    const instructionName = findInstructionName(text);
    const instructions = extractSteps(text);

    const json = {
      product_name: productName,
      instruction_name: {
        en: instructionName,
        hi: instructionName,
        es: instructionName,
        de: instructionName,
        fr: instructionName
      },
      instructions
    };

    fs.unlink(filePath, () => {});
    return res.json(json);
  } catch (err) {
    console.error('DOCX-parse error:', err);
    return res.status(500).json({ error: 'Failed to process file' });
  }
});

function find(source, regex) {
  const m = regex.exec(source);
  return m ? m[1].trim() : '';
}

function findInstructionName(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let idx = -1;
  lines.forEach((l, i) => { if (l.toLowerCase().includes('version')) idx = i; });
  return (idx !== -1 && idx < lines.length - 1) ? lines[idx + 1] : 'Instruction';
}

function extractSteps(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const stepStart = /^(\d{1,3})\s*(?:[.)-]\s*)?(.*)$/;
  const steps = [];
  let current = null;

  for (const line of lines) {
    const m = stepStart.exec(line);
    if (m) {
      if (current) steps.push(current);
      current = { step: parseInt(m[1], 10), instruction: m[2] || '' };
    } else if (current) {
      current.instruction += (current.instruction ? ' ' : '') + line;
    }
  }
  if (current) steps.push(current);

  return steps.map(s => {
    const placeholders = {};
    let instr = s.instruction;

    [...instr.matchAll(/_+/g)].forEach((m, i) => {
      const key = `step${s.step}_${i + 1}`;
      instr = instr.replace(m[0], `{${key}}`);
      placeholders[key] = { type: 'textbox', value: '' };
    });

    const block = {
      step: s.step,
      instruction: { en: instr, hi: instr, es: instr, de: instr, fr: instr }
    };
    if (Object.keys(placeholders).length) {
      block.placeholders = placeholders;
      block.has_placeholder = true;
    }
    return block;
  });
}

module.exports = router;