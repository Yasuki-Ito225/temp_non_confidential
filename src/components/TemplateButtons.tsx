"use client";

import { TemplateItem } from "@/types/config";

interface TemplateButtonsProps {
  templates: TemplateItem[];
  onSelect: (text: string) => void;
  disabled: boolean;
}

export default function TemplateButtons({ templates, onSelect, disabled }: TemplateButtonsProps) {
  if (templates.length === 0) return null;

  return (
    <div className="template-buttons" role="group" aria-label="テンプレートメッセージ">
      <p className="template-buttons__label">よく使う質問：</p>
      <div className="template-buttons__list">
        {templates.map((template, idx) => (
          <button
            key={idx}
            className="template-buttons__button"
            onClick={() => onSelect(template.text)}
            disabled={disabled}
            aria-label={`テンプレート: ${template.label}`}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}
