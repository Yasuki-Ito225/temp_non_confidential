"use client";

import { useRef } from "react";
import { ALLOWED_FILE_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/constants";

interface AttachedFile {
  name: string;
  mediaType: string;
  base64Data: string;
}

interface FileAttachmentProps {
  attachedFile: AttachedFile | null;
  onAttach: (file: AttachedFile) => void;
  onRemove: () => void;
  disabled: boolean;
}

export default function FileAttachment({
  attachedFile,
  onAttach,
  onRemove,
  disabled,
}: FileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      alert("添付ファイルのサイズが上限を超えています。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const mediaType = file.type || "text/plain";
    if (!ALLOWED_FILE_TYPES.includes(mediaType as typeof ALLOWED_FILE_TYPES[number]) && !mediaType.startsWith("text/")) {
      alert("添付できるファイル形式は .txt / .md / .csv / .json / .yaml のみです。");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl is "data:<mediaType>;base64,<data>"
      const base64Data = dataUrl.split(",")[1];
      onAttach({ name: file.name, mediaType, base64Data });
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="file-attachment">
      {attachedFile ? (
        <div className="file-attachment__preview">
          <span className="file-attachment__icon" aria-hidden="true">📎</span>
          <span className="file-attachment__name">{attachedFile.name}</span>
          <button
            type="button"
            className="file-attachment__remove"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`添付ファイル ${attachedFile.name} を削除`}
          >
            ✕
          </button>
        </div>
      ) : (
        <label className={`file-attachment__label${disabled ? " file-attachment__label--disabled" : ""}`}>
          <span className="file-attachment__icon" aria-hidden="true">📎</span>
          <span className="file-attachment__text">ファイルを添付</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.json,.yaml,.yml"
            className="file-attachment__input"
            onChange={handleFileChange}
            disabled={disabled}
            aria-label="ファイルを選択"
          />
        </label>
      )}
    </div>
  );
}
