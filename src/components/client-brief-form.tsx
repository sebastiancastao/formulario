"use client";

import { saveBrief } from "@/app/actions/save-brief";
import {
  initialBriefSaveState,
  type BriefSaveState,
  type UploadedMaterialFile,
} from "@/lib/brief-submission";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

const STORAGE_KEY = "interactive-brief-draft-v1";
const STORAGE_UPDATED_AT_KEY = "interactive-brief-updated-at-v1";
const STORAGE_REMOTE_BRIEF_ID_KEY = "interactive-brief-remote-id-v1";
const STORAGE_LANGUAGE_KEY = "interactive-brief-language-v1";

type Language = "es" | "pt";
type LocalStatusKey = "" | "recoveredDraft" | "recoverError" | "draftReset";

type BriefFormData = {
  brandName: string;
  materials: string;
  referenceLinks: string;
  constraints: string;
  approvals: string;
  updateCadence: string;
  extraNotes: string;
};

type FieldName = keyof BriefFormData;
type FieldType = "text" | "textarea" | "select";

type FieldOption = {
  label: string;
  value: string;
};

type FieldConfig = {
  name: FieldName;
  label: string;
  type: FieldType;
  helper: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  fullWidth?: boolean;
  options?: FieldOption[];
};

type CopyConfig = {
  fields: FieldConfig[];
  headerEyebrow: string;
  intro: string;
  languageToggle: string;
  lastSavedLabel: string;
  locale: string;
  noRecentSave: string;
  progressLabel: string;
  resetButton: string;
  resetConfirm: string;
  responsesLabel: string;
  savedFiles: string;
  sectionHint: string;
  sectionIntro: string;
  sectionTitle: string;
  selectPlaceholder: string;
  selectedFiles: string;
  statusMessages: Record<Exclude<LocalStatusKey, "">, string>;
  submitIdle: string;
  submitPending: string;
  supportPrefix: string;
  supportStrong: string;
  supportSuffix: string;
  title: string;
  uploadHelper: string;
  uploadLimit: string;
  uploadTitle: string;
};

const initialBriefData: BriefFormData = {
  brandName: "",
  materials: "",
  referenceLinks: "",
  constraints: "",
  approvals: "",
  updateCadence: "",
  extraNotes: "",
};

const copyByLanguage: Record<Language, CopyConfig> = {
  es: {
    fields: [
      {
        name: "brandName",
        label: "Marca / organizacion",
        type: "text",
        helper:
          "Indica a que marca, empresa u organizacion corresponde este brief.",
        placeholder: "Ej: SeoLab",
        required: true,
        fullWidth: true,
      },
      {
        name: "materials",
        label: "Materiales y fuentes disponibles",
        type: "textarea",
        helper:
          "Que ya tienen listo: textos, cifras, decks, Excel, entrevistas, fotos o videos.",
        placeholder:
          "Ej: informe PDF, base de datos en Sheets, carpeta con fotos y tres testimonios aprobados.",
        rows: 5,
        required: true,
        fullWidth: true,
      },
      {
        name: "referenceLinks",
        label: "Links de apoyo",
        type: "textarea",
        helper:
          "Pega aqui links a Drive, Notion, Figma, Docs, dashboards u otras referencias.",
        placeholder: "Ej: https://drive..., https://figma..., https://docs...",
        rows: 4,
        fullWidth: true,
      },
      {
        name: "constraints",
        label: "Restricciones o cosas que deben evitarse",
        type: "textarea",
        helper: "Limites de tono, legales, tecnicos, visuales o de marca.",
        placeholder:
          "Ej: no mostrar cifras preliminares, evitar tono demasiado institucional, no usar mapa interactivo pesado.",
        rows: 4,
        fullWidth: true,
      },
      {
        name: "approvals",
        label: "Aprobaciones y dependencias",
        type: "textarea",
        helper:
          "Quien valida contenidos, que areas intervienen y que puede retrasar el proceso.",
        placeholder:
          "Ej: Legal aprueba cifras, producto revisa naming y el equipo regional valida antes de publicar.",
        rows: 4,
        fullWidth: true,
      },
      {
        name: "updateCadence",
        label: "Como se actualizara en el tiempo",
        type: "select",
        helper: "Define si sera un esfuerzo unico o una pieza viva.",
        options: [
          { value: "one-off", label: "Una sola entrega" },
          { value: "campaign", label: "Se actualiza por campana" },
          { value: "monthly", label: "Actualizacion mensual" },
          { value: "quarterly", label: "Actualizacion trimestral" },
          { value: "pending", label: "Aun no esta definido" },
        ],
        fullWidth: true,
      },
      {
        name: "extraNotes",
        label: "Notas adicionales",
        type: "textarea",
        helper: "Cualquier contexto que ayude a formular mejor la idea.",
        placeholder:
          "Ej: Hay una oportunidad de lanzarlo junto con una campana de pauta o evento presencial.",
        rows: 4,
        fullWidth: true,
      },
    ],
    headerEyebrow: "Formulario",
    intro:
      "Aqui solo se carga la parte operativa: materiales disponibles, links de apoyo, restricciones, aprobaciones y ritmo de actualizacion. El borrador se guarda automaticamente en este navegador para retomarlo despues.",
    languageToggle: "Ver en portugues",
    lastSavedLabel: "Ultimo guardado",
    locale: "es-CO",
    noRecentSave: "Aun no hay un guardado reciente.",
    progressLabel: "completado",
    resetButton: "Reiniciar borrador local",
    resetConfirm:
      "Esto limpiara el borrador guardado en este navegador. Quieres continuar?",
    responsesLabel: "respuestas",
    savedFiles: "Archivos guardados",
    sectionHint:
      "Si algo aun no existe, indiquenlo. Es mejor decir pendiente que dejarlo implicito.",
    sectionIntro:
      "Esta parte define con que insumos cuentan, que restricciones existen y como se mantendra viva la pieza si evoluciona en el tiempo.",
    sectionTitle: "Materiales y operacion",
    selectPlaceholder: "Selecciona una opcion",
    selectedFiles: "Archivos seleccionados",
    statusMessages: {
      recoveredDraft:
        "Se recupero el ultimo borrador guardado en este navegador.",
      recoverError: "No fue posible recuperar el borrador anterior.",
      draftReset: "Borrador local reiniciado.",
    },
    submitIdle: "Guardar",
    submitPending: "Guardando...",
    supportPrefix:
      "Si necesitan adjuntar archivos o bases, peguen los links dentro de",
    supportStrong: "Links de apoyo",
    supportSuffix: ".",
    title: "Materiales y operacion",
    uploadHelper:
      "Adjunta PDF, Excel, documentos, imagenes o ZIP. Se suben al guardar el formulario.",
    uploadLimit:
      "Maximo 5 archivos. Maximo 20 MB por archivo. En Next 16 este formulario usa Server Actions con bodySizeLimit aumentado a 50 MB.",
    uploadTitle: "Archivos para subir",
  },
  pt: {
    fields: [
      {
        name: "brandName",
        label: "Marca / organizacao",
        type: "text",
        helper:
          "Indique a qual marca, empresa ou organizacao este brief corresponde.",
        placeholder: "Ex: SeoLab",
        required: true,
        fullWidth: true,
      },
      {
        name: "materials",
        label: "Materiais e fontes disponiveis",
        type: "textarea",
        helper:
          "O que ja esta pronto: textos, numeros, decks, Excel, entrevistas, fotos ou videos.",
        placeholder:
          "Ex: relatorio em PDF, base de dados no Sheets, pasta com fotos e tres depoimentos aprovados.",
        rows: 5,
        required: true,
        fullWidth: true,
      },
      {
        name: "referenceLinks",
        label: "Links de apoio",
        type: "textarea",
        helper:
          "Cole aqui links de Drive, Notion, Figma, Docs, dashboards ou outras referencias.",
        placeholder: "Ex: https://drive..., https://figma..., https://docs...",
        rows: 4,
        fullWidth: true,
      },
      {
        name: "constraints",
        label: "Restricoes ou itens a evitar",
        type: "textarea",
        helper: "Limites de tom, legais, tecnicos, visuais ou de marca.",
        placeholder:
          "Ex: nao mostrar numeros preliminares, evitar um tom muito institucional, nao usar um mapa interativo pesado.",
        rows: 4,
        fullWidth: true,
      },
      {
        name: "approvals",
        label: "Aprovacoes e dependencias",
        type: "textarea",
        helper:
          "Quem valida os conteudos, quais areas participam e o que pode atrasar o processo.",
        placeholder:
          "Ex: Juridico aprova os numeros, produto revisa o naming e o time regional valida antes da publicacao.",
        rows: 4,
        fullWidth: true,
      },
      {
        name: "updateCadence",
        label: "Como sera atualizado ao longo do tempo",
        type: "select",
        helper: "Defina se sera um esforco unico ou uma peca viva.",
        options: [
          { value: "one-off", label: "Entrega unica" },
          { value: "campaign", label: "Atualizacao por campanha" },
          { value: "monthly", label: "Atualizacao mensal" },
          { value: "quarterly", label: "Atualizacao trimestral" },
          { value: "pending", label: "Ainda nao definido" },
        ],
        fullWidth: true,
      },
      {
        name: "extraNotes",
        label: "Notas adicionais",
        type: "textarea",
        helper: "Qualquer contexto que ajude a formular melhor a ideia.",
        placeholder:
          "Ex: Existe a oportunidade de lancar junto com uma campanha de midia ou um evento presencial.",
        rows: 4,
        fullWidth: true,
      },
    ],
    headerEyebrow: "Formulario",
    intro:
      "O objetivo deste formulario e reunir as informacoes necessarias para criar paginas especiais voltadas para divulgacao organica. Essas paginas podem incluir infograficos, elementos interativos, recursos visuais e conteudo otimizado para melhorar seu alcance, utilidade e posicionamento.",
    languageToggle: "Voltar ao espanhol",
    lastSavedLabel: "Ultimo salvamento",
    locale: "pt-BR",
    noRecentSave: "Ainda nao ha um salvamento recente.",
    progressLabel: "preenchido",
    resetButton: "Reiniciar rascunho local",
    resetConfirm:
      "Isso vai limpar o rascunho salvo neste navegador. Deseja continuar?",
    responsesLabel: "respostas",
    savedFiles: "Arquivos salvos",
    sectionHint:
      "Se algo ainda nao existe, indiquem isso. E melhor escrever pendente do que deixar implicito.",
    sectionIntro:
      "Esta parte define com quais insumos voces contam, que restricoes existem e como a peca sera mantida viva se evoluir ao longo do tempo.",
    sectionTitle: "Materiais e operacao",
    selectPlaceholder: "Selecione uma opcao",
    selectedFiles: "Arquivos selecionados",
    statusMessages: {
      recoveredDraft:
        "O ultimo rascunho salvo neste navegador foi recuperado.",
      recoverError: "Nao foi possivel recuperar o rascunho anterior.",
      draftReset: "Rascunho local reiniciado.",
    },
    submitIdle: "Salvar",
    submitPending: "Salvando...",
    supportPrefix:
      "Se precisarem anexar arquivos ou bases, coloquem os links em",
    supportStrong: "Links de apoio",
    supportSuffix: ".",
    title: "Materiais e operacao",
    uploadHelper:
      "Anexe PDF, Excel, documentos, imagens ou ZIP. Eles sao enviados ao salvar o formulario.",
    uploadLimit:
      "Maximo de 5 arquivos. Maximo de 20 MB por arquivo. No Next 16 este formulario usa Server Actions com bodySizeLimit aumentado para 50 MB.",
    uploadTitle: "Arquivos para enviar",
  },
};

function isFilled(value: string) {
  return value.trim().length > 0;
}

function normalizeDraft(raw: unknown): BriefFormData {
  if (!raw || typeof raw !== "object") {
    return initialBriefData;
  }

  const source = raw as Partial<Record<FieldName, unknown>>;
  const normalizedEntries = Object.keys(initialBriefData).map((key) => {
    const fieldName = key as FieldName;
    const value = source[fieldName];
    return [fieldName, typeof value === "string" ? value : ""];
  });

  return Object.fromEntries(normalizedEntries) as BriefFormData;
}

function formatSavedAt(value: string | null, copy: CopyConfig) {
  if (!value) {
    return copy.noRecentSave;
  }

  return new Date(value).toLocaleString(copy.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function translateSubmitMessage(message: string, language: Language) {
  if (!message || language === "es") {
    return message;
  }

  if (message === "Completa los campos obligatorios antes de guardar en Supabase.") {
    return "Preencha os campos obrigatorios antes de salvar no Supabase.";
  }

  if (message === "El correo de contacto no tiene un formato valido.") {
    return "O email de contato nao tem um formato valido.";
  }

  if (message === "Brief guardado en Supabase correctamente.") {
    return "Brief salvo corretamente no Supabase.";
  }

  if (message === "No fue posible guardar el brief en Supabase.") {
    return "Nao foi possivel salvar o brief no Supabase.";
  }

  if (message === "Missing SUPABASE_URL.") {
    return "Falta configurar SUPABASE_URL.";
  }

  if (message === "Missing SUPABASE_SERVICE_ROLE_KEY.") {
    return "Falta configurar SUPABASE_SERVICE_ROLE_KEY.";
  }

  if (message === "Configura SUPABASE_URL con tu proyecto real de Supabase.") {
    return "Configure SUPABASE_URL com o projeto real do Supabase.";
  }

  if (
    message ===
    "Configura SUPABASE_SERVICE_ROLE_KEY con tu service role real."
  ) {
    return "Configure SUPABASE_SERVICE_ROLE_KEY com a service role real.";
  }

  const maxFilesMatch = message.match(
    /^Solo se permiten hasta (\d+) archivos por envio\.$/,
  );

  if (maxFilesMatch) {
    return `Sao permitidos no maximo ${maxFilesMatch[1]} arquivos por envio.`;
  }

  const oversizeMatch = message.match(
    /^El archivo (.+) supera el limite de 20 MB\.$/,
  );

  if (oversizeMatch) {
    return `O arquivo ${oversizeMatch[1]} ultrapassa o limite de 20 MB.`;
  }

  const uploadMatch = message.match(
    /^No fue posible subir el archivo (.+) a Supabase\.$/,
  );

  if (uploadMatch) {
    return `Nao foi possivel enviar o arquivo ${uploadMatch[1]} ao Supabase.`;
  }

  const payloadMatch = message.match(
    /^No fue posible leer el payload existente del brief\. Detalle: (.+)$/,
  );

  if (payloadMatch) {
    return `Nao foi possivel ler o payload existente do brief. Detalhe: ${payloadMatch[1]}`;
  }

  return message;
}

export function ClientBriefForm() {
  const [language, setLanguage] = useState<Language>("es");
  const [formData, setFormData] = useState<BriefFormData>(initialBriefData);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [selectedMaterialFileNames, setSelectedMaterialFileNames] = useState<
    string[]
  >([]);
  const [statusMessageKey, setStatusMessageKey] = useState<LocalStatusKey>("");
  const [storedBriefId, setStoredBriefId] = useState("");
  const materialFilesInputRef = useRef<HTMLInputElement | null>(null);
  const canPersistDraft = useRef(false);
  const canPersistLanguage = useRef(false);
  const [submitState, submitAction, isSubmitting] = useActionState<
    BriefSaveState,
    FormData
  >(saveBrief, initialBriefSaveState);

  const copy = copyByLanguage[language];
  const fields = copy.fields;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const savedDraft = window.localStorage.getItem(STORAGE_KEY);
        const savedAt = window.localStorage.getItem(STORAGE_UPDATED_AT_KEY);
        const remoteBriefId = window.localStorage.getItem(
          STORAGE_REMOTE_BRIEF_ID_KEY,
        );
        const savedLanguage = window.localStorage.getItem(STORAGE_LANGUAGE_KEY);

        if (savedLanguage === "es" || savedLanguage === "pt") {
          setLanguage(savedLanguage);
        }

        if (savedDraft) {
          setFormData(normalizeDraft(JSON.parse(savedDraft)));
          setStatusMessageKey("recoveredDraft");
        }

        if (savedAt) {
          setLastSavedAt(savedAt);
        }

        if (remoteBriefId) {
          setStoredBriefId(remoteBriefId);
        }
      } catch {
        setStatusMessageKey("recoverError");
      } finally {
        canPersistDraft.current = true;
        canPersistLanguage.current = true;
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!canPersistLanguage.current) {
      return;
    }

    window.localStorage.setItem(STORAGE_LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (!submitState.briefId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStoredBriefId(submitState.briefId);
      window.localStorage.setItem(
        STORAGE_REMOTE_BRIEF_ID_KEY,
        submitState.briefId,
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [submitState.briefId]);

  useEffect(() => {
    if (submitState.status !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedMaterialFileNames([]);

      if (materialFilesInputRef.current) {
        materialFilesInputRef.current.value = "";
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [submitState.status]);

  useEffect(() => {
    if (!canPersistDraft.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      window.localStorage.setItem(STORAGE_UPDATED_AT_KEY, savedAt);
      setLastSavedAt(savedAt);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [formData]);

  useEffect(() => {
    if (!statusMessageKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessageKey("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessageKey]);

  const totalFields = fields.length;
  const filledFields = fields.filter((field) => isFilled(formData[field.name])).length;
  const progress = Math.round((filledFields / totalFields) * 100);
  const translatedSubmitMessage = translateSubmitMessage(
    submitState.message,
    language,
  );

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;
    const fieldName = name as FieldName;

    setFormData((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function handleLanguageToggle() {
    setLanguage((current) => (current === "es" ? "pt" : "es"));
  }

  function handleMaterialFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedMaterialFileNames(files.map((file) => file.name));
  }

  function handleResetDraft() {
    const shouldReset = window.confirm(copy.resetConfirm);

    if (!shouldReset) {
      return;
    }

    setFormData(initialBriefData);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_UPDATED_AT_KEY);
    window.localStorage.removeItem(STORAGE_REMOTE_BRIEF_ID_KEY);
    setLastSavedAt(null);
    setSelectedMaterialFileNames([]);
    setStoredBriefId("");
    setStatusMessageKey("draftReset");

    if (materialFilesInputRef.current) {
      materialFilesInputRef.current.value = "";
    }
  }

  return (
    <form
      action={submitAction}
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
    >
      <input type="hidden" name="briefId" value={storedBriefId} readOnly />

      <div className="rounded-[2rem] border border-line bg-white/92 p-5 shadow-[0_18px_60px_rgba(36,127,148,0.12)] sm:p-8">
        <header className="rounded-[1.75rem] bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-soft)_100%)] px-5 py-6 text-white sm:px-6 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/78">
                {copy.headerEyebrow}
              </p>
              <h1 className="mt-3 font-display text-4xl leading-[0.95] tracking-[-0.035em] text-white sm:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-4 text-sm leading-7 text-white/90 sm:text-base">
                {copy.intro}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLanguageToggle}
              className="self-start rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              {copy.languageToggle}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <div className="rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm font-medium text-white">
              {progress}% {copy.progressLabel}
            </div>
            <div className="rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm font-medium text-white">
              {filledFields}/{totalFields} {copy.responsesLabel}
            </div>
            <div className="rounded-full border border-white/18 bg-white/14 px-4 py-2 text-sm font-medium text-white">
              {copy.lastSavedLabel}: {formatSavedAt(lastSavedAt, copy)}
            </div>
          </div>

          <p aria-live="polite" className="mt-3 min-h-6 text-sm text-white/84">
            {statusMessageKey ? copy.statusMessages[statusMessageKey] : ""}
          </p>
        </header>

        <fieldset className="mt-8 rounded-[1.75rem] border border-line bg-surface p-5 shadow-[0_8px_30px_rgba(34,93,110,0.06)] sm:p-6">
          <legend className="sr-only">{copy.sectionTitle}</legend>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-3xl leading-[0.98] tracking-[-0.03em] text-foreground">
                {copy.sectionTitle}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                {copy.sectionIntro}
              </p>
            </div>
            <div className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-muted">
              {filledFields}/{totalFields} {copy.responsesLabel}
            </div>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-dashed border-line bg-[rgba(96,196,189,0.08)] px-4 py-3 text-sm leading-6 text-muted">
            {copy.sectionHint}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {fields.map((field) => {
              const fieldValue = formData[field.name];
              const fieldLabel = field.required ? `${field.label} *` : field.label;
              const sharedClasses =
                "mt-3 w-full rounded-[1.15rem] border border-line bg-white px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";

              return (
                <label
                  key={field.name}
                  className={`block ${field.fullWidth ? "md:col-span-2" : ""}`}
                  htmlFor={field.name}
                >
                  <span className="text-sm font-semibold text-foreground">
                    {fieldLabel}
                  </span>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {field.helper}
                  </p>

                  {field.type === "text" ? (
                    <input
                      id={field.name}
                      name={field.name}
                      type="text"
                      value={fieldValue}
                      onChange={handleChange}
                      required={field.required}
                      placeholder={field.placeholder}
                      className={sharedClasses}
                    />
                  ) : null}

                  {field.type === "textarea" ? (
                    <>
                      <textarea
                        id={field.name}
                        name={field.name}
                        value={fieldValue}
                        onChange={handleChange}
                        required={field.required}
                        rows={field.rows ?? 4}
                        placeholder={field.placeholder}
                        className={`${sharedClasses} resize-y`}
                      />
                      {field.name === "materials" ? (
                        <div className="mt-4 rounded-[1.15rem] border border-dashed border-line bg-[rgba(96,196,189,0.06)] px-4 py-4">
                          <p className="text-sm font-semibold text-foreground">
                            {copy.uploadTitle}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            {copy.uploadHelper}
                          </p>
                          <input
                            ref={materialFilesInputRef}
                            id="materialFiles"
                            name="materialFiles"
                            type="file"
                            multiple
                            onChange={handleMaterialFilesChange}
                            className="mt-3 block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-[rgba(36,127,148,0.12)] file:px-4 file:py-2 file:font-semibold file:text-foreground"
                          />
                          <p className="mt-2 text-xs leading-5 text-muted">
                            {copy.uploadLimit}
                          </p>
                          {selectedMaterialFileNames.length > 0 ? (
                            <div className="mt-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-muted">
                              <p className="font-semibold text-foreground">
                                {copy.selectedFiles}
                              </p>
                              <ul className="mt-2 space-y-1">
                                {selectedMaterialFileNames.map((fileName, index) => (
                                  <li key={`${fileName}-${index}`}>{fileName}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {field.type === "select" ? (
                    <select
                      id={field.name}
                      name={field.name}
                      value={fieldValue}
                      onChange={handleChange}
                      required={field.required}
                      className={`${sharedClasses} appearance-none`}
                    >
                      <option value="">{copy.selectPlaceholder}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <footer className="mt-8 border-t border-line pt-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-soft)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(36,127,148,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? copy.submitPending : copy.submitIdle}
            </button>

            <button
              type="button"
              onClick={handleResetDraft}
              className="rounded-full border border-transparent bg-transparent px-5 py-3 text-sm font-medium text-muted transition hover:text-foreground"
            >
              {copy.resetButton}
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted">
            {copy.supportPrefix} <strong>{copy.supportStrong}</strong>
            {copy.supportSuffix}
          </p>
          {submitState.uploadedFiles.length > 0 ? (
            <div className="mt-4 rounded-[1.25rem] border border-line bg-[rgba(96,196,189,0.08)] px-4 py-4">
              <p className="text-sm font-semibold text-foreground">
                {copy.savedFiles}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {submitState.uploadedFiles.map((file: UploadedMaterialFile) => (
                  <li key={file.path}>
                    {file.name} - {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p
            aria-live="polite"
            className={`mt-3 text-sm ${
              submitState.status === "error"
                ? "text-red-700"
                : submitState.status === "success"
                  ? "text-accent"
                  : "text-muted"
            }`}
          >
            {translatedSubmitMessage}
          </p>
        </footer>
      </div>
    </form>
  );
}
