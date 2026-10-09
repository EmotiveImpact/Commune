import { useState, type FormEvent } from "react";
import { Plus, UsersRound } from "lucide-react";
import { useApp, type SplitTemplateInput } from "../state";
import { useSearchRecord } from "../ui/useSearchRecord";
import { type SplitTemplate } from "../live/model";
import {
  allocateExpense,
  type SplitMethod,
} from "../../../../packages/core/src/expenseSplit";
import { moneyInputError, parseMoneyInput } from "../data/moneyInput";
import { plainAmount } from "../../../../packages/core/src/money";
import {
  Button,
  Dialog,
  EmptyState,
  Feedback,
  Field,
  Panel,
  SectionHeading,
} from "../ui/components";
import { SplitEditor } from "../ui/SplitEditor";

function TemplateEditor({
  template,
  pending,
  error,
  onSave,
  onClose,
}: {
  template?: SplitTemplate;
  pending: boolean;
  error: string;
  onSave: (input: SplitTemplateInput) => void;
  onClose: () => void;
}) {
  const { hub } = useApp();
  const [name, setName] = useState(template?.name ?? "");
  const [method, setMethod] = useState<SplitMethod>(
    template?.method ?? "Equal",
  );
  const [included, setIncluded] = useState(
    template?.participants
      .map((item) => item.userId)
      .filter((id) => hub.members.some((member) => member.userId === id)) ??
      hub.members.map((member) => member.userId),
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      template?.participants.map((item) => [item.userId, item.value]) ?? [],
    ),
  );
  const [validation, setValidation] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation("");
    try {
      if (!name.trim()) throw new Error("Name this split template.");
      const exact =
        method === "Exact"
          ? included.map((id) => {
              const value = parseMoneyInput(values[id] ?? "", hub.currency);
              if (!value)
                throw new Error(
                  moneyInputError(values[id] ?? "", hub.currency, "Enter a positive exact amount for everyone included."),
                );
              return value;
            })
          : [];
      const total =
        method === "Exact"
          ? exact.reduce((sum, value) => sum + value, 0)
          : 1000000;
      allocateExpense(total, included, method, values, hub.currency);
      onSave({
        id: template?.id,
        name: name.trim(),
        method,
        participants: included.map((userId, index) => ({
          userId,
          // Exact amounts are stored as plain figures, like 1200.50,
          // however they were typed.
          value:
            method === "Equal"
              ? ""
              : method === "Exact"
                ? plainAmount(exact[index])
                : (values[userId] ?? ""),
        })),
      });
    } catch (cause) {
      setValidation(
        cause instanceof Error ? cause.message : "Check the template.",
      );
    }
  }
  return (
    <Dialog
      title={template ? "Edit split template" : "Save a split template"}
      pending={pending}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Template name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            maxLength={60}
            required
          />
        </Field>
        <SplitEditor
          members={hub.members}
          includedIds={included}
          onIncludedIds={setIncluded}
          method={method}
          onMethod={setMethod}
          values={values}
          onValues={setValues}
          currency={hub.currency}
          disabled={pending}
        />
        <p className="c-form-help">
          Available to this commune when adding an expense. Each expense still
          validates its amount and active participants before saving.
          {method === "Exact"
            ? " Exact templates work only when the expense total matches their saved amounts."
            : ""}
        </p>
        <Feedback error={validation || error} />
        <div className="a-field-row">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save template"}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function TemplatesScreen() {
  const { hub, splitTemplates, saveSplitTemplate, session, go, personName } = useApp();
  const [editor, setEditor] = useState<SplitTemplate | "new" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [archived, setArchived] = useState(false);
  const searchRecord = useSearchRecord("template", splitTemplates.filter(item => !item.archivedAt).map(item => item.id),
    () => setArchived(false));
  async function save(input: SplitTemplateInput) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await saveSplitTemplate(input);
      setEditor(null);
      setMessage(
        input.archived
          ? "Template archived. Find it in Archived to restore it."
          : "Template saved.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save template.",
      );
    } finally {
      setPending(false);
    }
  }
  if (!hub.id)
    return (
      <EmptyState
        title="Create a commune first."
        description="Saved split templates are shared with the people in your commune."
      />
    );
  const shown = splitTemplates.filter(
    (item) => Boolean(item.archivedAt) === archived,
  );
  return (
    <>
      <div className="a-toolbar">
        <div className="a-filters">
          {[false, true].map((value) => (
            <Button
              key={String(value)}
              variant="secondary"
              aria-pressed={archived === value}
              onClick={() => setArchived(value)}
            >
              {value ? "Archived" : "Active"}
            </Button>
          ))}
        </div>
        <Button
          onClick={() => {
            setError("");
            setEditor("new");
          }}
        >
          <Plus size={16} />
          Save template
        </Button>
      </div>
      <Feedback error={!editor ? error || searchRecord.error : ""} message={message} />
      {!shown.length && (
        <EmptyState
          title={
            archived
              ? "No archived splits."
              : "Your regular split, ready to use."
          }
          description={
            archived
              ? "Archived templates stay here so their creator or an admin can restore them."
              : "Save participants, percentages or share weights once. Choose the template in Add expense and check the final split."
          }
        />
      )}
      <div className="c-workflow-grid">
        {shown.map((template) => {
          const allowed =
            hub.role === "admin" || template.createdBy === session?.userId;
          const missing = template.participants.some(
            (item) =>
              !hub.members.some((member) => member.userId === item.userId),
          );
          return (
            <Panel className={`c-workflow-card${searchRecord.highlightedId === template.id ? " c-search-record-highlight" : ""}`}
              id={`search-record-template-${template.id}`} tabIndex={-1} key={template.id}>
              <SectionHeading
                title={template.name}
                action={
                  <UsersRound
                    size={17}
                    className="c-muted-icon"
                    aria-hidden="true"
                  />
                }
              />
              <p className="c-form-help">
                {template.method} ·{" "}
                {template.participants
                  .map((item) => personName(item.userId, "Former member", { left: true }))
                  .join(", ")}
              </p>
              {missing && (
                <p className="a-form-error">
                  Update the participants before using this template.
                </p>
              )}
              <div className="a-field-row">
                {!archived && (
                  <Button
                    disabled={missing || pending}
                    onClick={() => go("add-expense", { template: template.id })}
                  >
                    Use split{" "}<span className="c-visually-hidden">{template.name}</span>
                  </Button>
                )}
                {allowed && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        setError("");
                        setEditor(template);
                      }}
                    >
                      {archived ? "Edit & restore" : "Edit"}{" "}<span className="c-visually-hidden">{template.name}</span>
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pending || (archived && missing)}
                      onClick={() =>
                        void save({ ...template, archived: !archived })
                      }
                    >
                      {archived ? "Restore" : "Archive"}{" "}<span className="c-visually-hidden">{template.name}</span>
                    </Button>
                  </>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      {editor && (
        <TemplateEditor
          template={editor === "new" ? undefined : editor}
          pending={pending}
          error={error}
          onClose={() => setEditor(null)}
          onSave={(input) => void save(input)}
        />
      )}
    </>
  );
}
