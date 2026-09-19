import { insertTrade, updateTrade } from './db.js';
import { showToast, toLocalDateStr } from './utils.js';

let onSaveCallback = null;

function handleOverlayClick(e) {
  if (e.target.id === 'trade-modal') closeModal();
}

export function closeModal() {
  const overlay = document.getElementById('trade-modal');
  overlay?.classList.add('hidden');
  document.body.style.overflow = '';
  overlay?.removeEventListener('click', handleOverlayClick);
}

function tradeFormHTML(trade) {
  const isEdit = !!trade?.id;
  const d = trade || {};
  return `
    <div class="modal-header">
      <h2 class="modal-title">${isEdit ? 'Edit Trade' : 'Add New Trade'}</h2>
      <button class="btn-icon" id="modal-close"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <form id="trade-form" autocomplete="off">
      <div class="form-grid">
        <!-- Row 1 -->
        <div class="form-group">
          <label>Symbol <span class="required">*</span></label>
          <input type="text" id="trade-symbol" value="${d.symbol || ''}" placeholder="e.g. ES, NQ, AAPL" required class="uppercase-input" />
        </div>
        <div class="form-group">
          <label>Date <span class="required">*</span></label>
          <input type="date" id="trade-date" value="${d.trade_date || toLocalDateStr()}" required />
        </div>
        <div class="form-group">
          <label>Side <span class="required">*</span></label>
          <select id="trade-side" required>
            <option value="">Select...</option>
            <option value="LONG" ${d.side === 'LONG' ? 'selected' : ''}>Long</option>
            <option value="SHORT" ${d.side === 'SHORT' ? 'selected' : ''}>Short</option>
          </select>
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" id="trade-qty" value="${d.quantity || ''}" placeholder="1" min="0.0001" step="any" />
        </div>

        <!-- Row 2 -->
        <div class="form-group">
          <label>Entry Price</label>
          <input type="number" id="entry-price" value="${d.entry_price || ''}" placeholder="0.00" step="any" />
        </div>
        <div class="form-group">
          <label>Exit Price</label>
          <input type="number" id="exit-price" value="${d.exit_price || ''}" placeholder="0.00" step="any" />
        </div>
        <div class="form-group">
          <label>Stop Loss</label>
          <input type="number" id="stop-loss" value="${d.stop_loss || ''}" placeholder="0.00" step="any" />
        </div>
        <div class="form-group">
          <label>Take Profit</label>
          <input type="number" id="take-profit" value="${d.take_profit || ''}" placeholder="0.00" step="any" />
        </div>

        <!-- Row 3 -->
        <div class="form-group">
          <label>P&L ($)</label>
          <input type="number" id="trade-pnl" value="${d.pnl || ''}" placeholder="Auto-calculated" step="any" />
        </div>
        <div class="form-group">
          <label>R:R Ratio</label>
          <input type="number" id="trade-rr" value="${d.rr || ''}" placeholder="Auto-calculated" step="any" readonly />
        </div>
        <div class="form-group">
          <label>Setup / Strategy</label>
          <input type="text" id="trade-setup" value="${d.setup || ''}" placeholder="e.g. Breakout, Reversal, MOB" list="setup-suggestions" />
          <datalist id="setup-suggestions">
            <option value="Breakout" /><option value="Reversal" /><option value="Trend Follow" />
            <option value="Gap Fill" /><option value="MOB" /><option value="VWAP Reclaim" />
            <option value="Opening Range" /><option value="Supply/Demand" />
          </datalist>
        </div>
        <div class="form-group">
          <label>Session</label>
          <select id="trade-session">
            <option value="">Select...</option>
            <option value="Pre-Market" ${d.session === 'Pre-Market' ? 'selected' : ''}>Pre-Market</option>
            <option value="Regular" ${d.session === 'Regular' ? 'selected' : ''}>Regular</option>
            <option value="After-Hours" ${d.session === 'After-Hours' ? 'selected' : ''}>After-Hours</option>
            <option value="Overnight" ${d.session === 'Overnight' ? 'selected' : ''}>Overnight</option>
          </select>
        </div>

        <!-- Emotions + Grade -->
        <div class="form-group">
          <label>Execution Grade</label>
          <select id="trade-grade">
            <option value="">—</option>
            <option value="A" ${d.grade === 'A' ? 'selected' : ''}>A — Perfect</option>
            <option value="B" ${d.grade === 'B' ? 'selected' : ''}>B — Good</option>
            <option value="C" ${d.grade === 'C' ? 'selected' : ''}>C — OK</option>
            <option value="D" ${d.grade === 'D' ? 'selected' : ''}>D — Poor</option>
            <option value="F" ${d.grade === 'F' ? 'selected' : ''}>F — Mistake</option>
          </select>
        </div>
        <div class="form-group">
          <label>Emotion</label>
          <select id="trade-emotion">
            <option value="">—</option>
            <option value="Calm" ${d.emotion === 'Calm' ? 'selected' : ''}>Calm</option>
            <option value="Confident" ${d.emotion === 'Confident' ? 'selected' : ''}>Confident</option>
            <option value="Fearful" ${d.emotion === 'Fearful' ? 'selected' : ''}>Fearful</option>
            <option value="Greedy" ${d.emotion === 'Greedy' ? 'selected' : ''}>Greedy</option>
            <option value="FOMO" ${d.emotion === 'FOMO' ? 'selected' : ''}>FOMO</option>
            <option value="Revenge" ${d.emotion === 'Revenge' ? 'selected' : ''}>Revenge</option>
          </select>
        </div>

        <!-- Full-width fields -->
        <div class="form-group form-full">
          <label>Screenshot URL</label>
          <input type="url" id="trade-screenshot" value="${d.screenshot_url || ''}" placeholder="https://..." />
        </div>
        <div class="form-group form-full">
          <label>Notes</label>
          <textarea id="trade-notes" rows="3" placeholder="What did you observe? What worked? What to improve?">${d.notes || ''}</textarea>
        </div>
      </div>

      <!-- Calculated Preview -->
      <div class="calc-preview" id="calc-preview">
        <span>Calculated P&L: <strong id="calc-pnl">—</strong></span>
        <span>R:R: <strong id="calc-rr">—</strong></span>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="modal-close-footer">Cancel</button>
        <button type="submit" class="btn-primary" id="modal-save">
          <span id="modal-save-text">${isEdit ? 'Save Changes' : 'Add Trade'}</span>
          <span class="spinner hidden" id="modal-spinner"></span>
        </button>
      </div>
    </form>`;
}

async function handleSubmit(e) {
  e.preventDefault();
  setModalLoading(true);

  const symbol = document.getElementById('trade-symbol')?.value.trim().toUpperCase();
  const trade_date = document.getElementById('trade-date')?.value;
  const side = document.getElementById('trade-side')?.value;
  const quantity = parseFloat(document.getElementById('trade-qty')?.value) || null;
  const entry_price = parseFloat(document.getElementById('entry-price')?.value) || null;
  const exit_price = parseFloat(document.getElementById('exit-price')?.value) || null;
  const stop_loss = parseFloat(document.getElementById('stop-loss')?.value) || null;
  const take_profit = parseFloat(document.getElementById('take-profit')?.value) || null;
  const pnl = parseFloat(document.getElementById('trade-pnl')?.value) || calculatePnlValue();
  const rr = parseFloat(document.getElementById('trade-rr')?.value) || null;
  const setup = document.getElementById('trade-setup')?.value.trim() || null;
  const session = document.getElementById('trade-session')?.value || null;
  const grade = document.getElementById('trade-grade')?.value || null;
  const emotion = document.getElementById('trade-emotion')?.value || null;
  const screenshot_url = document.getElementById('trade-screenshot')?.value.trim() || null;
  const notes = document.getElementById('trade-notes')?.value.trim() || null;

  const payload = { symbol, trade_date, side, quantity, entry_price, exit_price, stop_loss, take_profit, pnl, rr, setup, session, grade, emotion, screenshot_url, notes };

  try {
    const existingId = document.getElementById('trade-form')?.dataset.id;
    if (existingId) {
      await updateTrade(existingId, payload);
      showToast('Trade updated', 'success');
    } else {
      await insertTrade(payload);
      showToast('Trade added', 'success');
    }
    closeModal();
    if (onSaveCallback) onSaveCallback();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setModalLoading(false);
  }
}

// ─── Open modal (single export) ─────────────────────────────
export function openTradeModal(trade = null, onSave = null) {
  onSaveCallback = onSave;
  const overlay = document.getElementById('trade-modal');
  const inner = document.getElementById('trade-modal-inner');
  if (!overlay || !inner) return;

  inner.innerHTML = tradeFormHTML(trade);
  if (trade?.id) document.getElementById('trade-form').dataset.id = trade.id;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  setTimeout(() => document.getElementById('trade-symbol')?.focus(), 50);

  overlay.addEventListener('click', handleOverlayClick);
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-close-footer')?.addEventListener('click', closeModal);
  document.getElementById('trade-form')?.addEventListener('submit', handleSubmit);

  const calcFields = ['entry-price', 'exit-price', 'stop-loss', 'take-profit', 'trade-qty', 'trade-side'];
  calcFields.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { calculatePnl(); calculateRR(); });
    document.getElementById(id)?.addEventListener('change', () => { calculatePnl(); calculateRR(); });
  });

  // Uppercase symbol
  document.getElementById('trade-symbol')?.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
}

function calculatePnlValue() {
  const side = document.getElementById('trade-side')?.value;
  const entry = parseFloat(document.getElementById('entry-price')?.value);
  const exit = parseFloat(document.getElementById('exit-price')?.value);
  const qty = parseFloat(document.getElementById('trade-qty')?.value);
  if (!side || isNaN(entry) || isNaN(exit) || isNaN(qty)) return null;
  return side === 'LONG' ? (exit - entry) * qty : (entry - exit) * qty;
}

function calculatePnl() {
  const pnl = calculatePnlValue();
  const pnlInput = document.getElementById('trade-pnl');
  const calcPnlEl = document.getElementById('calc-pnl');
  if (pnl !== null) {
    if (pnlInput && !pnlInput.value) pnlInput.value = pnl.toFixed(2);
    if (calcPnlEl) {
      calcPnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2);
      calcPnlEl.className = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
    }
  }
}

function calculateRR() {
  const side = document.getElementById('trade-side')?.value;
  const entry = parseFloat(document.getElementById('entry-price')?.value);
  const sl = parseFloat(document.getElementById('stop-loss')?.value);
  const tp = parseFloat(document.getElementById('take-profit')?.value);

  if (!side || isNaN(entry) || isNaN(sl) || isNaN(tp)) return;

  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return;

  const rr = (reward / risk).toFixed(2);
  const rrInput = document.getElementById('trade-rr');
  const calcRREl = document.getElementById('calc-rr');
  if (rrInput) rrInput.value = rr;
  if (calcRREl) calcRREl.textContent = rr + 'R';
}

function setModalLoading(loading) {
  const btn = document.getElementById('modal-save');
  const text = document.getElementById('modal-save-text');
  const spinner = document.getElementById('modal-spinner');
  if (!btn) return;
  btn.disabled = loading;
  text?.classList.toggle('hidden', loading);
  spinner?.classList.toggle('hidden', !loading);
}
