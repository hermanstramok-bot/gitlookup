import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../db.js';
import { clearTextCache } from './texts.js'; // добавлено

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function setupImportRoutes(app) {

  // ==============================
  // ИМПОРТ ТЕКСТА
  // ==============================
  app.post('/api/import/text', (req, res) => {
    const startTime = Date.now();
    console.log('=== IMPORT TEXT START ===');
    const { title, content, icon } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    try {
      const db = getDB();
      db.run(
        `INSERT INTO texts (title, type, raw_content, icon, imported_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [title, 'text', content, icon || '/icons/default.png']
      );
      const idRes = db.exec(`SELECT last_insert_rowid() AS id`);
      const id = idRes?.[0]?.values?.[0]?.[0];
      saveDB();

      // Очищаем кеш текстов, чтобы новый текст стал доступен при первом открытии
      clearTextCache();

      console.log(`✓ Text imported in ${Date.now() - startTime} ms`);
      return res.json({
        success: true,
        id,
        title,
        type: 'text',
        imported_at: new Date().toISOString()
      });
    } catch (err) {
      console.error(`✗ Text import failed after ${Date.now() - startTime} ms`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  // ==============================
  // ИМПОРТ YOUTUBE
  // ==============================
  app.post('/api/import/youtube', (req, res) => {
    const importStart = Date.now();
    console.log('\n=== IMPORT YOUTUBE START ===');
    console.log('URL received:', req.body.youtube_url);

    const { youtube_url, title: customTitle, icon } = req.body;

    if (!youtube_url) {
      return res.status(400).json({ error: 'YouTube URL required' });
    }

    const downloadDir = path.join(__dirname, '..', 'downloads', uuidv4());
    console.log('Temporary download directory:', downloadDir);
    fs.mkdirSync(downloadDir, { recursive: true });

    // Команды: сначала ручные субтитры, потом автогенерированные
    const commands = [
      {
        name: 'manual subs',
        cmd: `python -m yt_dlp --write-subs --skip-download --sub-langs "de,en,ru" -o "%(title)s" "${youtube_url}"`
      },
      {
        name: 'auto subs',
        cmd: `python -m yt_dlp --write-auto-subs --skip-download --sub-langs "de,en,ru" -o "%(title)s" "${youtube_url}"`
      }
    ];

    let currentCommandIndex = 0;

    const cleanup = () => {
      setTimeout(() => {
        if (fs.existsSync(downloadDir)) {
          console.log(`🧹 Cleaning up temporary directory: ${downloadDir}`);
          fs.rmSync(downloadDir, { recursive: true, force: true });
        }
      }, 1000);
    };

    // ===== Функция проверки языка субтитров =====
    function isGermanText(text) {
      const sample = text.slice(0, 2000).toLowerCase();
      const germanIndicators = /\b(der|die|das|und|ist|wir|sie|ich|nicht|zu|auf|mit|sich|dass|ein|eine|einen|dem|den|des|für|von|zum)\b/i;
      const englishIndicators = /\b(the|and|of|to|for|with|that|this|are|is)\b/i;
      const hasGerman = germanIndicators.test(sample);
      const hasEnglish = englishIndicators.test(sample);
      if (hasGerman && !hasEnglish) return true;
      if (hasGerman && hasEnglish) {
        const germanCount = (sample.match(/\b(der|die|das|und|ist|wir|sie|ich|nicht)\b/gi) || []).length;
        const englishCount = (sample.match(/\b(the|and|of|to|for|with)\b/gi) || []).length;
        return germanCount > englishCount;
      }
      return false;
    }

    const processSubtitles = () => {
      if (currentCommandIndex >= commands.length) {
        console.error('❌ All attempts failed: no usable subtitles found.');
        cleanup();
        return res.status(400).json({
          error: 'No German subtitles found for this video. Please try another video with German subtitles.'
        });
      }

      const command = commands[currentCommandIndex];
      console.log(`\n🔍 [Attempt ${currentCommandIndex + 1}/${commands.length}] ${command.name}`);
      console.log(`▶️  Running: ${command.cmd}`);

      exec(command.cmd, { cwd: downloadDir }, (error, stdout, stderr) => {
        console.log(`=== EXEC CALLBACK (${command.name}) ===`);
        if (stdout) console.log('STDOUT:', stdout.slice(0, 500) + (stdout.length > 500 ? '...' : ''));
        if (stderr) console.log('STDERR:', stderr.slice(0, 500) + (stderr.length > 500 ? '...' : ''));
        if (error) console.log('EXEC ERROR:', error.message);

        let files = [];
        try {
          files = fs.readdirSync(downloadDir);
          console.log(`📁 Files in ${downloadDir}:`, files);
        } catch (readErr) {
          console.log('Cannot read directory:', readErr);
        }

        const vttFiles = files.filter(f => f.endsWith('.vtt'));
        console.log(`🎞️  Found VTT files: ${vttFiles.length ? vttFiles.join(', ') : 'none'}`);

        let germanVtt = vttFiles.find(f => /\.de\b|de[-_]|_de\./i.test(f));
        let selectedVtt = null;
        let selectionReason = '';

        if (germanVtt) {
          selectedVtt = germanVtt;
          selectionReason = `explicit German marker (${germanVtt})`;
          console.log(`✅ Found German-labelled VTT: ${germanVtt}`);
        } else if (vttFiles.length > 0) {
          selectedVtt = vttFiles[0];
          selectionReason = `fallback to ANY VTT (${selectedVtt}) – no German marker`;
          console.warn(`⚠️  No German marker in any VTT. Falling back to: ${selectedVtt}`);
        } else {
          console.log('❌ No VTT files in this attempt.');
          currentCommandIndex++;
          processSubtitles();
          return;
        }

        console.log(`🔎 Selected file: ${selectedVtt} (reason: ${selectionReason})`);
        const vttPath = path.join(downloadDir, selectedVtt);
        let vttContent;
        try {
          vttContent = fs.readFileSync(vttPath, 'utf-8');
        } catch (err) {
          console.error('Error reading VTT file:', err);
          currentCommandIndex++;
          processSubtitles();
          return;
        }

        const looksGerman = isGermanText(vttContent);
        console.log(`🌐 Language check: ${looksGerman ? 'GERMAN' : 'NOT GERMAN (or too short)'}`);
        if (!looksGerman) {
          console.error(`❌ The file ${selectedVtt} does not contain German text. Skipping this attempt.`);
          const sample = vttContent.slice(0, 500).replace(/\n/g, ' ');
          console.error(`📄 Sample: ${sample.substring(0, 200)}...`);
          currentCommandIndex++;
          processSubtitles();
          return;
        }

        // Сохраняем отладочную копию
        const debugDir = path.join(__dirname, '..', 'debug_subtitles');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const debugCopyPath = path.join(debugDir, `${Date.now()}_${selectedVtt.replace(/\.vtt$/, '')}_${command.name.replace(' ', '_')}.vtt`);
        fs.writeFileSync(debugCopyPath, vttContent);
        console.log(`💾 Debug copy saved: ${debugCopyPath}`);

        // Парсим VTT с обрезкой повторяющихся префиксов и заменой &nbsp;
        const subtitles = parseVtt(vttContent);
        if (!subtitles || subtitles.length === 0) {
          console.warn('Parsed subtitles array is empty, trying next command');
          currentCommandIndex++;
          processSubtitles();
          return;
        }
        console.log(`📝 Parsed ${subtitles.length} subtitle lines (first line: "${subtitles[0]?.text?.slice(0, 80)}...")`);

        let videoTitle = customTitle;
        if (!videoTitle) {
          videoTitle = selectedVtt
            .replace(/\.(de|en|ru)(-.*)?\.vtt$/, '')
            .replace(/\.vtt$/, '')
            .replace(/_[a-z]{2}$/, '');
          if (!videoTitle) videoTitle = 'YouTube Video';
        }

        const db = getDB();

        db.run(
          `INSERT INTO texts (title, type, youtube_url, icon, imported_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [videoTitle, 'video', youtube_url, icon || '/icons/default.png']
        );
        const idRes = db.exec(`SELECT last_insert_rowid() AS id`);
        const textId = idRes?.[0]?.values?.[0]?.[0];
        if (!textId) throw new Error('Failed to obtain inserted text ID');

        const stmt = db.prepare(`
          INSERT INTO subtitles (text_id, start_ms, end_ms, line_text, line_index)
          VALUES (?, ?, ?, ?, ?)
        `);
        db.run('BEGIN TRANSACTION');
        for (let i = 0; i < subtitles.length; i++) {
          const sub = subtitles[i];
          stmt.run([textId, sub.start_ms, sub.end_ms, sub.text, i]);
        }
        db.run('COMMIT');
        saveDB();

        // Очищаем кеш текстов (на случай, если видео когда-либо используется как текст)
        clearTextCache();

        console.log(`✓ Saved ${subtitles.length} subtitles for video ID ${textId} (title: ${videoTitle})`);
        cleanup();

        console.log(`✓ YouTube import finished in ${Date.now() - importStart} ms`);
        return res.json({
          success: true,
          id: textId,
          title: videoTitle,
          type: 'video',
          youtube_url,
          subtitle_count: subtitles.length,
          subtitles: subtitles.map(s => ({
            start: s.start_ms,
            end: s.end_ms,
            text: s.text
          }))
        });
      });
    };

    processSubtitles();
  });
}

// ==============================
// ПАРСЕР VTT С ОБРЕЗКОЙ ПОВТОРЯЮЩИХСЯ ПРЕФИКСОВ И ЗАМЕНОЙ &nbsp;
// ==============================
function parseVtt(vttContent) {
  const lines = vttContent.split(/\r?\n/);
  const rawSubs = [];
  let currentSub = null;

  if (lines[0] && lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;

    if (line === 'WEBVTT' ||
        line.startsWith('NOTE') ||
        line.startsWith('Kind:') ||
        line.startsWith('Language:') ||
        /^\d+$/.test(line)) {
      continue;
    }

    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      if (currentSub && currentSub.text) {
        rawSubs.push(currentSub);
      }
      currentSub = {
        start_ms: timeToMs(timeMatch[1]),
        end_ms: timeToMs(timeMatch[2]),
        text: ''
      };
      continue;
    }

    if (currentSub && line) {
      let clean = line
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')   // <-- ИСПРАВЛЕНИЕ: заменяем &nbsp; на обычный пробел
        .trim();
      if (clean) {
        currentSub.text += (currentSub.text ? ' ' : '') + clean;
      }
    }
  }

  if (currentSub && currentSub.text) {
    rawSubs.push(currentSub);
  }

  // Обрезаем общий префикс последовательных субтитров
  const subtitles = [];
  let previousText = '';

  for (const sub of rawSubs) {
    let text = sub.text.trim();
    if (previousText) {
      const prevWords = previousText.split(/\s+/);
      const currWords = text.split(/\s+/);

      let overlap = 0;
      for (let len = Math.min(prevWords.length, currWords.length); len > 0; len--) {
        const prevTail = prevWords.slice(-len).join(' ');
        const currHead = currWords.slice(0, len).join(' ');
        if (prevTail === currHead) {
          overlap = len;
          break;
        }
      }
      if (overlap > 0) {
        text = currWords.slice(overlap).join(' ');
      }
    }
    if (text.trim()) {
      subtitles.push({
        ...sub,
        text: text.trim()
      });
      previousText = sub.text.trim(); // оригинальный текст для будущего сравнения
    }
  }

  return subtitles;
}

// ==============================
// КОНВЕРТАЦИЯ ВРЕМЕНИ
// ==============================
function timeToMs(timeStr) {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const [sec, ms] = parts[2].split('.');
    return hours * 3600000 + minutes * 60000 + parseInt(sec, 10) * 1000 + parseInt(ms || '0', 10);
  }
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const [sec, ms] = parts[1].split('.');
    return minutes * 60000 + parseInt(sec, 10) * 1000 + parseInt(ms || '0', 10);
  }
  return 0;
}