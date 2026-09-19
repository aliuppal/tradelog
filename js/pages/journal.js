import { fetchNotes, upsertNote, deleteNote } from '../db.js';
import { formatDate, showToast, toLocalDateStr } from '../utils.js';

let notes = [];
let activeNote = null;

export async function renderJournal(container) {
  container.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
  notes = await fetchNotes();
  mountJournalUI(container);
}

function mountJournalUI(container) {
  container.innerHTML = `
    <div class="page journal-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Journal Notes</h1>
          <p class="page-sub">Your daily trading reflections</p>
        </div>
        <button class="btn-primary" id="journal-new">
          <i class="fa-solid fa-plus"></i> New Note
        </button>
      </div>

      <div class="journal-layout">
        <!-- Notes List -->
        <div class="journal-list card" id="journal-list">
          ${notes.length ? notesListHTML() : `<div class="empty-state small"><i class="fa-solid fa-book"></i><p>No notes yet</p></div>`}
        </div>

        <!-- Editor -->
        <div class="journal-editor card" id="journal-editor">
          <div class="editor-placeholder" id="editor-placeholder">
            <i class="fa-solid fa-pen-to-square"></i>
            <p>Select a note or create a new one</p>
          </div>
          <div class="editor-form hidden" id="editor-form">
            <div class="editor-header">
              <input type="date" id="note-date" class="note-date-input" />
              <div class="editor-actions">
                <button class="btn-danger btn-sm" id="delete-note-btn" title="Delete Note"><i class="fa-solid fa-trash"></i> Delete</button>
                <button class="btn-primary btn-sm" id="save-note-btn"><i class="fa-solid fa-floppy-disk"></i> Save</button>
              </div>
            </div>
            <input type="text" id="note-title" class="note-title-input" placeholder="Note title (optional)" />
            <textarea id="note-body" class="note-body-input" placeholder="Write your trading reflections, lessons learned, market observations..."></textarea>
            <div class="mood-row">
              <span class="mood-label">Mindset:</span>
              ${['😤','😐','🙂','😊','🔥'].map((e,i) => `
                <label class="mood-btn">
                  <input type="radio" name="mood" value="${i+1}" />
                  <span>${e}</span>
                </label>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('journal-new')?.addEventListener('click', () => openEditor(null));
  attachNoteListeners();
}

function notesListHTML() {
  return notes.map(n => `
    <div class="note-item ${activeNote?.id === n.id ? 'active' : ''}" data-id="${n.id}">
      <div class="note-item-header">
        <span class="note-item-date">${formatDate(n.note_date)}</span>
        <span class="note-mood">${moodEmoji(n.mood)}</span>
      </div>
      <span class="note-item-title">${n.title || 'Untitled'}</span>
      <span class="note-item-preview">${(n.body || '').slice(0, 80)}${(n.body?.length || 0) > 80 ? '…' : ''}</span>
    </div>`).join('');
}

function moodEmoji(mood) {
  const map = { 1: '😤', 2: '😐', 3: '🙂', 4: '😊', 5: '🔥' };
  return map[mood] || '';
}

function attachNoteListeners() {
  document.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', () => {
      const note = notes.find(n => n.id === item.dataset.id);
      if (note) openEditor(note);
    });
  });
}

function openEditor(note) {
  activeNote = note;
  const placeholder = document.getElementById('editor-placeholder');
  const form = document.getElementById('editor-form');
  placeholder?.classList.add('hidden');
  form?.classList.remove('hidden');

  const dateInput = document.getElementById('note-date');
  const titleInput = document.getElementById('note-title');
  const bodyInput = document.getElementById('note-body');
  const deleteBtn = document.getElementById('delete-note-btn');

  if (dateInput) dateInput.value = note?.note_date || toLocalDateStr();
  if (titleInput) titleInput.value = note?.title || '';
  if (bodyInput) bodyInput.value = note?.body || '';

  // Set mood
  if (note?.mood) {
    const radio = document.querySelector(`input[name="mood"][value="${note.mood}"]`);
    if (radio) radio.checked = true;
  }

  deleteBtn?.classList.toggle('hidden', !note);

  // Update active highlight
  document.querySelectorAll('.note-item').forEach(el => el.classList.toggle('active', el.dataset.id === note?.id));

  document.getElementById('save-note-btn')?.addEventListener('click', saveNote, { once: false });
  document.getElementById('delete-note-btn')?.addEventListener('click', handleDeleteNote, { once: false });

  // Cleanup previous listeners
  const saveBtn = document.getElementById('save-note-btn');
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.replaceWith(newSaveBtn);
  newSaveBtn.addEventListener('click', saveNote);

  const delBtn = document.getElementById('delete-note-btn');
  if (delBtn) {
    const newDelBtn = delBtn.cloneNode(true);
    delBtn.replaceWith(newDelBtn);
    newDelBtn.addEventListener('click', handleDeleteNote);
  }
}

async function saveNote() {
  const date = document.getElementById('note-date')?.value;
  const title = document.getElementById('note-title')?.value.trim();
  const body = document.getElementById('note-body')?.value.trim();
  const mood = parseInt(document.querySelector('input[name="mood"]:checked')?.value) || null;

  if (!date) { showToast('Please select a date', 'warning'); return; }

  const btn = document.getElementById('save-note-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }

  try {
    const noteData = { note_date: date, title, body, mood };
    if (activeNote?.id) noteData.id = activeNote.id;

    const saved = await upsertNote(noteData);
    activeNote = saved;

    // Refresh list
    notes = await fetchNotes();
    const listEl = document.getElementById('journal-list');
    if (listEl) { listEl.innerHTML = notesListHTML(); attachNoteListeners(); }

    showToast('Note saved', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save'; }
  }
}

async function handleDeleteNote() {
  if (!activeNote?.id) return;
  if (!confirm('Delete this note?')) return;
  try {
    await deleteNote(activeNote.id);
    notes = notes.filter(n => n.id !== activeNote.id);
    activeNote = null;

    const listEl = document.getElementById('journal-list');
    if (listEl) { listEl.innerHTML = notes.length ? notesListHTML() : `<div class="empty-state small"><i class="fa-solid fa-book"></i><p>No notes yet</p></div>`; attachNoteListeners(); }

    const placeholder = document.getElementById('editor-placeholder');
    const form = document.getElementById('editor-form');
    placeholder?.classList.remove('hidden');
    form?.classList.add('hidden');
    showToast('Note deleted', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}
