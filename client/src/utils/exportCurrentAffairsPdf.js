function escapeHtml(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function openCurrentAffairsCapsulePdf({
  affairs = [],
  monthLabel = "",
  categoryLabel = "All Categories",
}) {
  if (!affairs.length) return;

  const titleSuffix = monthLabel ? `${monthLabel} · ${categoryLabel}` : categoryLabel;
  const cardsHtml = affairs
    .map((item, idx) => {
      const dateStr = item.published_at
        ? new Date(item.published_at).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "";
      const points = Array.isArray(item.key_points) ? item.key_points : [];
      return `
        <article class="card">
          <div class="meta">
            <span class="pill">${escapeHtml(item.category)}</span>
            <span>${escapeHtml(dateStr)}</span>
          </div>
          <h2>${idx + 1}. ${escapeHtml(item.title)}</h2>
          <p class="body">${escapeHtml(item.body)}</p>
          ${points.length ? `<ul>${points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join("")}</ul>` : ""}
          ${item.static_gk ? `<div class="gk"><strong>Static GK Takeaway:</strong> ${escapeHtml(item.static_gk)}</div>` : ""}
        </article>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>HHK Current Affairs Capsule - ${escapeHtml(titleSuffix)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 24px; line-height: 1.55; }
    .header { border-bottom: 2px solid #6557dc; padding-bottom: 12px; margin-bottom: 20px; }
    .brand { font-size: 20px; font-weight: 800; color: #6557dc; }
    .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; break-inside: avoid; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .pill { background: #eef2ff; color: #4338ca; padding: 2px 9px; border-radius: 999px; font-weight: 600; }
    h2 { font-size: 15.5px; margin: 4px 0 8px; color: #0f172a; }
    .body { margin: 0 0 8px; font-size: 13.5px; }
    ul { margin: 6px 0 8px; padding-left: 20px; font-size: 13px; }
    li { margin-bottom: 4px; }
    .gk { background: #f8fafc; border-left: 3px solid #6557dc; padding: 8px 10px; font-size: 13px; border-radius: 4px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">HHK Banking Exam Prep — Current Affairs Capsule</div>
    <div class="sub">${escapeHtml(titleSuffix)} · ${affairs.length} Briefing(s)</div>
  </div>
  ${cardsHtml}
</body>
</html>`;

  const oldFrame = document.getElementById("hhk-ca-print-frame");
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "hhk-ca-print-frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 200);
}