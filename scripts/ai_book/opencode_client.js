/**
 * opencode-run client for the book pipeline.
 *
 * Calls any model reachable through `opencode run -m <provider/model>` —
 * including the free models on the opencode provider (muse-spark, ling,
 * nemotron ... -free variants, cost 0) and, once the account has funds,
 * the claude-* models. One completion per call; retries transient failures.
 *
 * `opencode run` has no system-prompt slot, so the caller's system prompt is
 * embedded as a delimited <authoring-rules> block at the top of the message.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CALL_TIMEOUT_MS = 8 * 60 * 1000;

function callOpenCode(model, system, prompt, { retries = 2, timeoutMs = CALL_TIMEOUT_MS } = {}) {
  const msg = `<authoring-rules>\n${system}\n</authoring-rules>\n\n${prompt}\n\n` +
    `Output ONLY the Markdown for this section — no preamble, no explanations, no code fence around the whole answer.`;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return new Promise((resolve, reject) => {
        const child = spawn('opencode', ['run', '-m', model, '--format', 'json', '--pure', msg], {
          cwd: ROOT,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        let out = '', err = '';
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
        child.stdout.on('data', d => { out += d; });
        child.stderr.on('data', d => { err += d; });
        child.on('close', code => {
          clearTimeout(timer);
          if (code !== 0 && !out.trim()) return reject(new Error(err.trim() || `opencode exited ${code}`));
          const texts = [];
          let apiErr = null;
          for (const line of out.split('\n')) {
            if (!line.trim()) continue;
            let j;
            try { j = JSON.parse(line); } catch (_) { continue; }
            if (j.type === 'error') { apiErr = j.error; continue; }
            if (j.type === 'text' && j.part && typeof j.part.text === 'string') texts.push(j.part.text);
          }
          if (apiErr) return reject(new Error(`${apiErr.name || 'APIError'}: ${(apiErr.data && apiErr.data.message) || apiErr.message || 'unknown'}`));
          const text = texts.join('').trim();
          if (!text) return reject(new Error('empty response'));
          resolve(text);
        });
      });
    } catch (e) {
      lastErr = e;
      console.log(`   [retry ${attempt}/${retries}] ${e.message}`);
    }
  }
  throw lastErr;
}

module.exports = { callOpenCode };
