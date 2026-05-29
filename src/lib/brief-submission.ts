export type UploadedMaterialFile = {
  bucket: string;
  contentType: string;
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
};

export type BriefSaveState = {
  briefId: string;
  message: string;
  status: "idle" | "success" | "error";
  uploadedFiles: UploadedMaterialFile[];
};

export const initialBriefSaveState: BriefSaveState = {
  briefId: "",
  message: "",
  status: "idle",
  uploadedFiles: [],
};
