"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addNote, updateStatus } from "@/app/familias/[id]/actions";
import { statuses } from "@/lib/families/validation";
import { todayISO } from "@/lib/date";
export function FamilyFollowUp({
  id,
  status,
  activationDate,
  updatedAt,
}: {
  id: string;
  status: string;
  activationDate: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [date, setDate] = useState(activationDate);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const noteId = useRef<string | null>(null);
  async function submit(kind: "status" | "note") {
    if (pending) return;
    setPending(true);
    setMessage("");
    try {
      noteId.current ??= crypto.randomUUID();
      const result =
        kind === "status"
          ? await updateStatus({
              id,
              updatedAt,
              status: current,
              activationDate: date,
            })
          : await addNote({ id: noteId.current, familyId: id, content });
      setMessage(result.message);
      if (result.ok) {
        if (kind === "note") {
          setContent("");
          noteId.current = null;
        }
        router.refresh();
      }
    } catch {
      setMessage(
        "Não foi possível confirmar a operação. Tente novamente ou entre na sua conta em outra aba.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="card">
      <h2>Atualizar acompanhamento</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit("status");
        }}
      >
        <div className="form-grid">
          <label className="field">
            Situação
            <select
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={pending}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Data de ativação
            <input
              type="date"
              value={date}
              max={todayISO()}
              required={current === "ativa"}
              disabled={pending}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button disabled={pending} className="button">
            Atualizar situação
          </button>
        </div>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit("note");
        }}
      >
        <label className="field">
          Nova observação
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={5000}
            required
            disabled={pending}
          />
        </label>
        <div className="form-actions">
          <small>
            Observações registradas não podem ser editadas nesta etapa.
          </small>
          <button disabled={pending || !content.trim()} className="button">
            Adicionar observação
          </button>
        </div>
      </form>
      {message && (
        <p role="status" className="feedback">
          {message}
        </p>
      )}
    </section>
  );
}
