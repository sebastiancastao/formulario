"use server";

import type {
  BriefSaveState,
  UploadedMaterialFile,
} from "@/lib/brief-submission";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const FILE_FIELD_NAME = "materialFiles";
const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const briefFieldNames = [
  "clientName",
  "brandName",
  "contactName",
  "contactEmail",
  "projectName",
  "projectType",
  "publishWindow",
  "purposeSummary",
  "challenge",
  "audience",
  "mainTakeaway",
  "desiredAction",
  "storyFlow",
  "keyMoments",
  "interactions",
  "materials",
  "referenceLinks",
  "constraints",
  "approvals",
  "updateCadence",
  "extraNotes",
] as const;

type BriefFieldName = (typeof briefFieldNames)[number];
type BriefPayload = Record<BriefFieldName, string>;
type BriefDatabasePayload = BriefPayload & {
  materialFiles?: UploadedMaterialFile[];
};

const requiredFieldNames: BriefFieldName[] = ["brandName", "materials"];

function buildPayload(formData: FormData): BriefPayload {
  const payload = Object.fromEntries(
    briefFieldNames.map((fieldName) => {
      const value = formData.get(fieldName);
      return [fieldName, typeof value === "string" ? value.trim() : ""];
    }),
  );

  return payload as BriefPayload;
}

function buildShareSummary(
  data: BriefPayload,
  uploadedFiles: UploadedMaterialFile[],
) {
  const lines = [
    "# Brief de materiales y operacion",
    "",
    "## Marca / organizacion",
    data.brandName || "Pendiente",
    "",
    "## Materiales y fuentes",
    data.materials || "Pendiente",
    "",
    "## Archivos subidos",
    uploadedFiles.length > 0
      ? uploadedFiles.map((file) => `- ${file.name}`).join("\n")
      : "Sin archivos subidos",
    "",
    "## Links de apoyo",
    data.referenceLinks || "Pendiente",
    "",
    "## Restricciones",
    data.constraints || "Pendiente",
    "",
    "## Aprobaciones y dependencias",
    data.approvals || "Pendiente",
    "",
    "## Ritmo de actualizacion",
    data.updateCadence || "Pendiente",
    "",
    "## Notas adicionales",
    data.extraNotes || "Pendiente",
  ];

  return lines.join("\n");
}

function validatePayload(payload: BriefPayload) {
  const missingLabels = requiredFieldNames.filter((fieldName) => {
    return payload[fieldName].trim().length === 0;
  });

  if (missingLabels.length > 0) {
    return "Completa los campos obligatorios antes de guardar en Supabase.";
  }

  if (payload.contactEmail) {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail);

    if (!isValidEmail) {
      return "El correo de contacto no tiene un formato valido.";
    }
  }

  return "";
}

function getFilesFromFormData(formData: FormData) {
  return formData
    .getAll(FILE_FIELD_NAME)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function validateFiles(files: File[]) {
  if (files.length > MAX_FILES) {
    return `Solo se permiten hasta ${MAX_FILES} archivos por envio.`;
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `El archivo ${file.name} supera el limite de 20 MB.`;
    }
  }

  return "";
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "archivo";
}

async function getExistingMaterialFiles(
  briefId: string,
  tableName: string,
) {
  if (!briefId.trim()) {
    return [] as UploadedMaterialFile[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(tableName)
    .select("payload")
    .eq("id", briefId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible leer el payload existente del brief. Detalle: ${error.message}`,
    );
  }

  if (!data || !data.payload || typeof data.payload !== "object") {
    return [] as UploadedMaterialFile[];
  }

  const payload = data.payload as {
    materialFiles?: unknown;
  };

  if (!Array.isArray(payload.materialFiles)) {
    return [] as UploadedMaterialFile[];
  }

  return payload.materialFiles.filter((file): file is UploadedMaterialFile => {
    if (!file || typeof file !== "object") {
      return false;
    }

    const candidate = file as Partial<UploadedMaterialFile>;

    return (
      typeof candidate.bucket === "string" &&
      typeof candidate.contentType === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.path === "string" &&
      typeof candidate.size === "number" &&
      typeof candidate.uploadedAt === "string"
    );
  });
}

async function uploadMaterialFiles(
  briefId: string,
  files: File[],
  bucketName: string,
) {
  const supabase = getSupabaseAdminClient();
  const uploadedAt = new Date().toISOString();
  const uploadedFiles: UploadedMaterialFile[] = [];

  for (const file of files) {
    const safeFileName = sanitizeFileName(file.name);
    const objectPath = `briefs/${briefId}/${crypto.randomUUID()}-${safeFileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (error) {
      throw new Error(`No fue posible subir el archivo ${file.name} a Supabase.`);
    }

    uploadedFiles.push({
      bucket: bucketName,
      contentType: file.type || "application/octet-stream",
      name: file.name,
      path: objectPath,
      size: file.size,
      uploadedAt,
    });
  }

  return uploadedFiles;
}

export async function saveBrief(
  _prevState: BriefSaveState,
  formData: FormData,
): Promise<BriefSaveState> {
  try {
    const payload = buildPayload(formData);
    const validationError = validatePayload(payload);

    if (validationError) {
      return {
        briefId: "",
        message: validationError,
        status: "error",
        uploadedFiles: [],
      };
    }

    const files = getFilesFromFormData(formData);
    const fileValidationError = validateFiles(files);

    if (fileValidationError) {
      return {
        briefId: "",
        message: fileValidationError,
        status: "error",
        uploadedFiles: [],
      };
    }

    const briefIdValue = formData.get("briefId");
    const hasExistingBrief =
      typeof briefIdValue === "string" && briefIdValue.trim().length > 0;
    const briefId =
      hasExistingBrief
        ? briefIdValue.trim()
        : crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    const tableName = process.env.SUPABASE_BRIEFS_TABLE ?? "client_briefs";
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET ?? "brief-materials";
    const existingFiles = hasExistingBrief
      ? await getExistingMaterialFiles(briefId, tableName)
      : [];
    const newUploadedFiles = await uploadMaterialFiles(briefId, files, bucketName);
    const mergedMaterialFiles = [...existingFiles, ...newUploadedFiles];
    const databasePayload: BriefDatabasePayload = {
      ...payload,
      materialFiles: mergedMaterialFiles,
    };
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from(tableName).upsert(
      {
        id: briefId,
        status: "submitted",
        client_name: payload.clientName || "Pendiente",
        brand_name: payload.brandName || null,
        contact_name: payload.contactName || "Pendiente",
        contact_email: payload.contactEmail || "pendiente@example.com",
        project_name: payload.projectName || "Seccion 4",
        project_type: payload.projectType || "materiales-operacion",
        publish_window: payload.publishWindow || null,
        payload: databasePayload,
        share_summary: buildShareSummary(payload, mergedMaterialFiles),
        submitted_at: submittedAt,
        updated_at: submittedAt,
      },
      {
        onConflict: "id",
      },
    );

    if (error) {
      return {
        briefId,
        message: "Supabase respondio con un error al guardar el brief.",
        status: "error",
        uploadedFiles: mergedMaterialFiles,
      };
    }

    return {
      briefId,
      message:
        newUploadedFiles.length > 0
          ? "Seccion 4 y archivos guardados en Supabase correctamente."
          : "Seccion 4 guardada en Supabase correctamente.",
      status: "success",
      uploadedFiles: mergedMaterialFiles,
    };
  } catch (error) {
    return {
      briefId: "",
      message:
        error instanceof Error
          ? error.message
          : "No fue posible conectar con Supabase.",
      status: "error",
      uploadedFiles: [],
    };
  }
}
