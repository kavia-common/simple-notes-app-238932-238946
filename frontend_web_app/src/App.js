import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "simple-notes-app.notes.v1";

/**
 * Generates a reasonably unique id for notes without external dependencies.
 * Uses crypto.randomUUID when available; falls back to a timestamp+random string.
 */
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Returns a short preview from a note body for the list view.
 * @param {string} body
 */
function makePreview(body) {
  const normalized = (body || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "No additional text";
  return normalized.length > 80 ? `${normalized.slice(0, 80)}…` : normalized;
}

/**
 * Best-effort title derivation if user left title blank.
 * @param {string} title
 * @param {string} body
 */
function normalizeTitle(title, body) {
  const t = (title || "").trim();
  if (t) return t;
  const derived = (body || "").replace(/\s+/g, " ").trim().slice(0, 40);
  return derived ? derived : "Untitled note";
}

/**
 * Loads notes from localStorage, returns a safe array.
 */
function loadNotes() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Minimal shape normalization
    return parsed
      .filter((n) => n && typeof n === "object" && typeof n.id === "string")
      .map((n) => ({
        id: n.id,
        title: typeof n.title === "string" ? n.title : "",
        body: typeof n.body === "string" ? n.body : "",
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
        createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Saves notes to localStorage.
 * @param {Array} notes
 */
function saveNotes(notes) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Ignore quota/unavailable errors; app still works in-memory for the session.
  }
}

// PUBLIC_INTERFACE
function App() {
  /** Notes data */
  const [notes, setNotes] = useState(() => {
    const loaded = loadNotes();
    if (loaded.length > 0) return loaded;

    // Friendly first-run seed note
    const now = Date.now();
    return [
      {
        id: createId(),
        title: "Welcome to Simple Notes",
        body: "Create notes on the left, edit on the right.\n\n• Search by title or body\n• Notes save automatically in your browser\n• Works great on mobile too",
        createdAt: now,
        updatedAt: now,
      },
    ];
  });

  /** UI state */
  const [activeId, setActiveId] = useState(() => {
    const initial = loadNotes();
    return initial.length ? initial[0].id : null;
  });
  const [query, setQuery] = useState("");
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);

  /** Editor draft state (decoupled from list selection for smoother typing) */
  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId],
  );

  const [draftTitle, setDraftTitle] = useState(activeNote?.title || "");
  const [draftBody, setDraftBody] = useState(activeNote?.body || "");

  const titleInputRef = useRef(null);

  // Persist notes on change
  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  // Keep draft in sync when switching notes
  useEffect(() => {
    setDraftTitle(activeNote?.title || "");
    setDraftBody(activeNote?.body || "");
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure we always have a valid active note when notes change (e.g., deletions)
  useEffect(() => {
    if (!notes.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !notes.some((n) => n.id === activeId)) {
      setActiveId(notes[0].id);
    }
  }, [notes, activeId]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const haystack = `${n.title}\n${n.body}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [notes, query]);

  // PUBLIC_INTERFACE
  const handleCreateNote = () => {
    const now = Date.now();
    const newNote = {
      id: createId(),
      title: "",
      body: "",
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveId(newNote.id);

    // On mobile, open editor immediately
    setIsMobileEditorOpen(true);

    // Focus title after render
    window.setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  // PUBLIC_INTERFACE
  const handleSelectNote = (id) => {
    setActiveId(id);
    setIsMobileEditorOpen(true);
  };

  // PUBLIC_INTERFACE
  const handleDeleteNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // PUBLIC_INTERFACE
  const handleUpdateActiveNote = (patch) => {
    if (!activeId) return;

    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === activeId);
      if (idx < 0) return prev;

      const existing = prev[idx];
      const updated = {
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      };

      const next = [...prev];
      next.splice(idx, 1);
      // Keep most-recently-updated at the top for better UX
      return [updated, ...next].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  // PUBLIC_INTERFACE
  const handleSaveDraft = () => {
    if (!activeId) return;
    const normalized = {
      title: normalizeTitle(draftTitle, draftBody),
      body: draftBody,
    };
    handleUpdateActiveNote(normalized);
  };

  const emptyState = notes.length === 0;

  return (
    <div className="sn-app">
      <header className="sn-header">
        <div className="sn-header__left">
          <div className="sn-brand">
            <div className="sn-brand__dot" aria-hidden="true" />
            <div>
              <div className="sn-title">Simple Notes</div>
              <div className="sn-subtitle">Minimal, fast, local</div>
            </div>
          </div>
        </div>

        <div className="sn-header__right">
          <button className="sn-btn sn-btn--primary" onClick={handleCreateNote}>
            New note
          </button>
        </div>
      </header>

      <main className="sn-main">
        <section
          className={[
            "sn-pane sn-pane--list",
            isMobileEditorOpen ? "sn-hide-on-mobile" : "",
          ].join(" ")}
          aria-label="Notes list"
        >
          <div className="sn-listHeader">
            <label className="sn-search" aria-label="Search notes">
              <span className="sn-search__icon" aria-hidden="true">
                ⌕
              </span>
              <input
                className="sn-input sn-input--search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                inputMode="search"
              />
            </label>

            <div className="sn-listMeta" aria-label="Notes count">
              {filteredNotes.length} / {notes.length}
            </div>
          </div>

          <div className="sn-list">
            {filteredNotes.length === 0 ? (
              <div className="sn-emptyList">
                <div className="sn-emptyList__title">No matches</div>
                <div className="sn-emptyList__hint">
                  Try a different search term.
                </div>
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isActive = note.id === activeId;
                return (
                  <button
                    key={note.id}
                    className={["sn-noteCard", isActive ? "is-active" : ""].join(
                      " ",
                    )}
                    onClick={() => handleSelectNote(note.id)}
                    type="button"
                    aria-current={isActive ? "true" : "false"}
                  >
                    <div className="sn-noteCard__title">
                      {normalizeTitle(note.title, note.body)}
                    </div>
                    <div className="sn-noteCard__preview">
                      {makePreview(note.body)}
                    </div>
                    <div className="sn-noteCard__meta">
                      <span className="sn-noteCard__date">
                        {new Date(note.updatedAt).toLocaleString()}
                      </span>

                      <span className="sn-noteCard__spacer" />

                      <span
                        className="sn-iconBtn sn-iconBtn--danger"
                        role="button"
                        tabIndex={0}
                        aria-label={`Delete note: ${normalizeTitle(
                          note.title,
                          note.body,
                        )}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }
                        }}
                        title="Delete"
                      >
                        ✕
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="sn-mobileFooter">
            <button className="sn-btn sn-btn--primary" onClick={handleCreateNote}>
              New note
            </button>
          </div>
        </section>

        <section
          className={[
            "sn-pane sn-pane--editor",
            isMobileEditorOpen ? "" : "sn-hide-on-mobile",
          ].join(" ")}
          aria-label="Note editor"
        >
          <div className="sn-editorHeader">
            <button
              className="sn-btn sn-btn--ghost sn-show-on-mobile"
              onClick={() => setIsMobileEditorOpen(false)}
              type="button"
              aria-label="Back to notes list"
            >
              ← Notes
            </button>

            <div className="sn-editorHeader__actions">
              <button
                className="sn-btn sn-btn--secondary"
                onClick={handleSaveDraft}
                type="button"
                disabled={!activeId}
                title="Save changes"
              >
                Save
              </button>
            </div>
          </div>

          {emptyState ? (
            <div className="sn-editorEmpty">
              <div className="sn-editorEmpty__title">No notes yet</div>
              <div className="sn-editorEmpty__hint">
                Create your first note to start writing.
              </div>
              <button
                className="sn-btn sn-btn--primary"
                onClick={handleCreateNote}
              >
                Create a note
              </button>
            </div>
          ) : !activeNote ? (
            <div className="sn-editorEmpty">
              <div className="sn-editorEmpty__title">Select a note</div>
              <div className="sn-editorEmpty__hint">
                Choose one from the list to begin editing.
              </div>
            </div>
          ) : (
            <div className="sn-editor">
              <div className="sn-field">
                <label className="sn-label" htmlFor="note-title">
                  Title
                </label>
                <input
                  id="note-title"
                  ref={titleInputRef}
                  className="sn-input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() =>
                    handleUpdateActiveNote({
                      title: normalizeTitle(draftTitle, draftBody),
                    })
                  }
                  placeholder="Untitled note"
                  maxLength={120}
                />
              </div>

              <div className="sn-field sn-field--grow">
                <label className="sn-label" htmlFor="note-body">
                  Note
                </label>
                <textarea
                  id="note-body"
                  className="sn-textarea"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  onBlur={() =>
                    handleUpdateActiveNote({
                      title: normalizeTitle(draftTitle, draftBody),
                      body: draftBody,
                    })
                  }
                  placeholder="Write something…"
                />
              </div>

              <div className="sn-editorFooter">
                <div className="sn-muted">
                  Saved locally in your browser (localStorage).
                </div>

                <div className="sn-editorFooter__right">
                  <button
                    className="sn-btn sn-btn--danger"
                    onClick={() => handleDeleteNote(activeNote.id)}
                    type="button"
                  >
                    Delete
                  </button>
                  <button
                    className="sn-btn sn-btn--primary"
                    onClick={handleSaveDraft}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
