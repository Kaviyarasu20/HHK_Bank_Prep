import { CustomSelect } from "../common/CustomSelect.jsx";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Building2, Landmark, RefreshCw, Scale, Search, ShieldCheck, Users } from "lucide-react";
import { studentBankingApi } from "../../api/bankingAwareness";
import { getSafeExternalUrl } from "../../utils/safeUrl";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "rates", label: "RBI Rates" },
  { id: "limits", label: "Banking Limits" },
  { id: "institutions", label: "Institutions" },
  { id: "regulators", label: "Regulatory Bodies" },
  { id: "leaders", label: "Banking Leaders" },
  { id: "static_gk", label: "Static GK" },
  { id: "terminology", label: "Terminology A–Z" },
];

const LIMIT_CATEGORIES = [
  "",
  "Priority Sector Lending",
  "Deposit Insurance",
  "KYC",
  "Digital Payments",
  "Lending",
  "Financial Inclusion",
  "Other Banking Limits",
];

const INSTITUTION_TYPES = [
  "",
  "Regulatory Institution",
  "Commercial Bank",
  "Development Financial Institution",
  "Payment Institution",
  "Other Financial Organization",
];

const EXAM_OPTIONS = [
  "",
  "IBPS PO",
  "IBPS Clerk",
  "SBI PO",
  "SBI Clerk",
  "IBPS RRB PO",
  "IBPS RRB Office Assistant",
  "RBI Grade B",
  "NABARD Grade A",
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function formatDate(d) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function FreshnessPill({ freshness }) {
  if (!freshness) return null;
  const cls = `ba-freshness ba-freshness--${freshness.state}`;
  return <span className={cls}>{freshness.label}</span>;
}

function SourceLink({ url, name }) {
  const safe = getSafeExternalUrl(url);
  if (!safe) return name ? <span style={{ fontSize: 12, color: "#64748b" }}>Source: {name}</span> : null;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5 }}>
      {name || "Official Source"} ↗
    </a>
  );
}

export function BankingAwarenessDashboard() {
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [leaderScope, setLeaderScope] = useState("current");
  const [letter, setLetter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [ratesData, setRatesData] = useState({ currentRates: [], history: [] });
  const [items, setItems] = useState([]);

  const loadSection = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        const res = await studentBankingApi.getOverview();
        setOverview(res.data ?? null);
      } else if (tab === "rates") {
        const res = await studentBankingApi.getRates({ q: search });
        setRatesData({ currentRates: res.currentRates ?? [], history: res.history ?? [] });
      } else if (tab === "limits") {
        const res = await studentBankingApi.getLimits({ q: search, category: categoryFilter });
        setItems(res.items ?? []);
      } else if (tab === "institutions") {
        const res = await studentBankingApi.getInstitutions({ q: search, type: typeFilter });
        setItems(res.items ?? []);
      } else if (tab === "regulators") {
        const res = await studentBankingApi.getRegulatoryBodies({ q: search });
        setItems(res.items ?? []);
      } else if (tab === "leaders") {
        const res = await studentBankingApi.getLeaders({ q: search, scope: leaderScope });
        setItems(res.items ?? []);
      } else if (tab === "static_gk") {
        const res = await studentBankingApi.getStaticGk({ q: search, exam: examFilter });
        setItems(res.items ?? []);
      } else if (tab === "terminology") {
        const res = await studentBankingApi.getTerminology({ q: search, letter });
        setItems(res.items ?? []);
      }
    } catch (err) {
      setError(err.message || "Failed to load Banking Awareness data.");
    } finally {
      setLoading(false);
    }
  }, [tab, search, categoryFilter, typeFilter, examFilter, leaderScope, letter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSection();
    }, search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [loadSection, search]);

  return (
    <div className="ba-hub">
      <div className="ca-subtabs" role="tablist" aria-label="Banking Awareness sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={tab === s.id}
            className={tab === s.id ? "primary-btn" : "outline-btn"}
            onClick={() => {
              setTab(s.id);
              setSearch("");
              setCategoryFilter("");
              setTypeFilter("");
              setExamFilter("");
              setLetter("");
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {tab !== "overview" && (
        <div className="ca-admin-filters" style={{ marginBottom: 14 }}>
          <label className="form-field" style={{ margin: 0 }}>
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${SECTIONS.find((x) => x.id === tab)?.label.toLowerCase()}…`}
            />
          </label>

          {tab === "limits" && (
            <label className="form-field" style={{ margin: 0 }}>
              Category
              <CustomSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                {LIMIT_CATEGORIES.map((c) => (
                  <option key={c || "all"} value={c}>
                    {c || "All categories"}
                  </option>
                ))}
              </CustomSelect>
            </label>
          )}

          {tab === "institutions" && (
            <label className="form-field" style={{ margin: 0 }}>
              Institution Type
              <CustomSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t || "all"} value={t}>
                    {t || "All types"}
                  </option>
                ))}
              </CustomSelect>
            </label>
          )}

          {tab === "leaders" && (
            <label className="form-field" style={{ margin: 0 }}>
              Appointments View
              <CustomSelect value={leaderScope} onChange={(e) => setLeaderScope(e.target.value)}>
                <option value="current">Current Approved Leaders</option>
                <option value="historical">Historical Appointments</option>
              </CustomSelect>
            </label>
          )}

          {tab === "static_gk" && (
            <label className="form-field" style={{ margin: 0 }}>
              Target Exam
              <CustomSelect value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
                {EXAM_OPTIONS.map((ex) => (
                  <option key={ex || "all"} value={ex}>
                    {ex || "All banking exams"}
                  </option>
                ))}
              </CustomSelect>
            </label>
          )}
        </div>
      )}

      {tab === "terminology" && (
        <div className="ba-az-bar" aria-label="A to Z filter">
          <button
            type="button"
            className={!letter ? "ba-az-btn active" : "ba-az-btn"}
            onClick={() => setLetter("")}
          >
            All
          </button>
          {LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              className={letter === l ? "ba-az-btn active" : "ba-az-btn"}
              onClick={() => setLetter(l)}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="ca-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-btn" onClick={() => void loadSection()}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="ca-state-box">Loading verified Banking Awareness reference data…</div>
      ) : tab === "overview" ? (
        <div className="ba-overview-grid">
          <section className="panel admin-panel">
            <div className="ca-admin-article-header">
              <h2><Landmark size={17} style={{ verticalAlign: "middle", marginRight: 6 }} />Current RBI Policy Rates</h2>
              <button type="button" className="text-link" onClick={() => setTab("rates")}>
                View history →
              </button>
            </div>
            {overview?.currentRates?.length ? (
              <div className="ca-cat-table-wrap">
                <table className="ca-cat-table">
                  <thead>
                    <tr>
                      <th>Rate</th>
                      <th>Current Value</th>
                      <th>Effective Date</th>
                      <th>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.currentRates.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.rate_name}</strong> ({r.rate_code})</td>
                        <td><strong>{r.rate_value}{r.unit}</strong></td>
                        <td>{formatDate(r.effective_date)}</td>
                        <td><FreshnessPill freshness={r.freshness} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ca-state-box">
                No verified RBI policy rates published yet. Rates appear here once verified against official RBI releases and approved by an administrator.
              </div>
            )}
          </section>

          <section className="panel admin-panel">
            <div className="ca-admin-article-header">
              <h2><Scale size={17} style={{ verticalAlign: "middle", marginRight: 6 }} />Key Banking Limits</h2>
              <button type="button" className="text-link" onClick={() => setTab("limits")}>
                Explore all →
              </button>
            </div>
            {overview?.keyLimits?.length ? (
              overview.keyLimits.map((l) => (
                <div className="ba-mini-row" key={l.id}>
                  <div>
                    <strong>{l.title}</strong>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{l.category}</div>
                  </div>
                  <strong>{l.value} {l.unit}</strong>
                </div>
              ))
            ) : (
              <div className="ca-state-box">No published banking limits yet.</div>
            )}
          </section>

          <section className="panel admin-panel">
            <div className="ca-admin-article-header">
              <h2><Users size={17} style={{ verticalAlign: "middle", marginRight: 6 }} />Current Banking Leadership</h2>
              <button type="button" className="text-link" onClick={() => setTab("leaders")}>
                View all →
              </button>
            </div>
            {overview?.currentLeaders?.length ? (
              overview.currentLeaders.map((ld) => (
                <div className="ba-mini-row" key={ld.id}>
                  <div>
                    <strong>{ld.person_name}</strong>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {ld.designation}{ld.organization_name ? ` · ${ld.organization_name}` : ""}
                    </div>
                  </div>
                  <FreshnessPill freshness={ld.freshness} />
                </div>
              ))
            ) : (
              <div className="ca-state-box">No published leadership appointments yet.</div>
            )}
          </section>

          <section className="panel admin-panel">
            <div className="ca-admin-article-header">
              <h2><BookOpen size={17} style={{ verticalAlign: "middle", marginRight: 6 }} />Reference Coverage</h2>
              <button type="button" className="text-link" onClick={() => setTab("terminology")}>
                Open A–Z Glossary →
              </button>
            </div>
            <div className="ba-mini-row"><span>Published Terminology Entries</span><strong>{overview?.counts?.terminology ?? 0}</strong></div>
            <div className="ba-mini-row"><span>Published Institutions</span><strong>{overview?.counts?.institutions ?? 0}</strong></div>
            <div className="ba-mini-row"><span>Published Regulatory Bodies</span><strong>{overview?.counts?.regulatoryBodies ?? 0}</strong></div>
            <div className="ba-mini-row"><span>Static GK Modules</span><strong>{overview?.staticGkHighlights?.length ?? 0}</strong></div>
          </section>
        </div>
      ) : tab === "rates" ? (
        <>
          <section className="panel admin-panel">
            <h2>Current Approved RBI Policy Rates</h2>
            {ratesData.currentRates.some((r) => r.freshness?.state === "verification_due" || r.freshness?.state === "outdated") && (
              <div className="ca-error-banner" role="status">
                <span>
                  <AlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  One or more RBI rates are due for re-verification against the latest MPC statement.
                </span>
              </div>
            )}
            {ratesData.currentRates.length === 0 ? (
              <div className="ca-state-box">No published RBI policy rates yet.</div>
            ) : (
              <div className="ca-cat-table-wrap">
                <table className="ca-cat-table">
                  <thead>
                    <tr>
                      <th>Rate</th>
                      <th>Current Value</th>
                      <th>Previous</th>
                      <th>Change</th>
                      <th>Effective Date</th>
                      <th>Last Verified</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratesData.currentRates.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.rate_name}</strong> ({r.rate_code})</td>
                        <td><strong>{r.rate_value}{r.unit}</strong></td>
                        <td>{r.previous_value != null ? `${r.previous_value}${r.unit}` : "—"}</td>
                        <td>{r.change_value != null ? `${Number(r.change_value) > 0 ? "+" : ""}${r.change_value}${r.unit}` : "—"}</td>
                        <td>{formatDate(r.effective_date)}</td>
                        <td>
                          {formatDate(r.verified_at)} <FreshnessPill freshness={r.freshness} />
                        </td>
                        <td><SourceLink url={r.source_url} name={r.source_name} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel admin-panel">
            <h2>Historical RBI Rate Changes</h2>
            {ratesData.history.length === 0 ? (
              <div className="ca-state-box">No historical RBI rate records available yet.</div>
            ) : (
              <div className="ca-cat-table-wrap">
                <table className="ca-cat-table">
                  <thead>
                    <tr>
                      <th>Effective Date</th>
                      <th>Rate</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Policy Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratesData.history.map((h) => (
                      <tr key={h.id}>
                        <td>{formatDate(h.effective_date)}</td>
                        <td><strong>{h.rate_name}</strong></td>
                        <td>{h.rate_value}{h.unit}</td>
                        <td><span className={`ca-badge ca-badge--${h.status}`}>{h.status}</span></td>
                        <td>{h.announcement_note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : items.length === 0 ? (
        <div className="ca-state-box">
          <Search size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
          No published records match your filter in this section yet.
        </div>
      ) : tab === "limits" ? (
        <div className="ba-card-grid">
          {items.map((l) => (
            <article className="panel affair-card" key={l.id}>
              <div className="affair-card-top">
                <span className="exam-pill">{l.category}</span>
                <FreshnessPill freshness={l.freshness} />
              </div>
              <h2>{l.title}</h2>
              <p><strong>Current Value:</strong> {l.value} {l.unit}</p>
              {l.applicable_to && <p><strong>Applicable To:</strong> {l.applicable_to}</p>}
              {l.description && <p>{l.description}</p>}
              {l.exam_notes && <div className="affair-static-gk"><strong>Exam Note:</strong> {l.exam_notes}</div>}
              <div className="ba-card-footer">
                <span>Effective: {formatDate(l.effective_from)}</span>
                <SourceLink url={l.source_url} name={l.source_name} />
              </div>
            </article>
          ))}
        </div>
      ) : tab === "institutions" ? (
        <div className="ba-card-grid">
          {items.map((i) => (
            <article className="panel affair-card" key={i.id}>
              <div className="affair-card-top">
                <span className="exam-pill"><Building2 size={12} /> {i.institution_type}</span>
                {i.established_year && <span style={{ fontSize: 12, color: "#64748b" }}>Est. {i.established_year}</span>}
              </div>
              <h2>{i.institution_name}{i.short_name ? ` (${i.short_name})` : ""}</h2>
              {i.headquarters && <p><strong>Headquarters:</strong> {i.headquarters}</p>}
              {i.parent_organization && <p><strong>Parent:</strong> {i.parent_organization}</p>}
              {i.description && <p>{i.description}</p>}
              <div className="ba-card-footer">
                <SourceLink url={i.official_website} name="Official Website" />
                <FreshnessPill freshness={i.freshness} />
              </div>
            </article>
          ))}
        </div>
      ) : tab === "regulators" ? (
        <div className="ba-card-grid">
          {items.map((r) => (
            <article className="panel affair-card" key={r.id}>
              <div className="affair-card-top">
                <span className="exam-pill"><ShieldCheck size={12} /> {r.applicable_sector || "Financial Regulator"}</span>
                {r.established_year && <span style={{ fontSize: 12, color: "#64748b" }}>Est. {r.established_year}</span>}
              </div>
              <h2>{r.organization_name}{r.short_name ? ` (${r.short_name})` : ""}</h2>
              {r.regulatory_domain && <p><strong>Domain:</strong> {r.regulatory_domain}</p>}
              {r.headquarters && <p><strong>Headquarters:</strong> {r.headquarters}</p>}
              {r.responsibilities && <p>{r.responsibilities}</p>}
              <div className="ba-card-footer">
                <SourceLink url={r.official_website || r.source_url} name="Official Portal" />
                <FreshnessPill freshness={r.freshness} />
              </div>
            </article>
          ))}
        </div>
      ) : tab === "leaders" ? (
        <div className="ba-card-grid">
          {items.map((ld) => (
            <article className="panel affair-card" key={ld.id}>
              <div className="affair-card-top">
                <span className="exam-pill">{ld.resolved_organization || ld.organization_name || "Banking Institution"}</span>
                <FreshnessPill freshness={ld.freshness} />
              </div>
              <h2>{ld.person_name}</h2>
              <p><strong>{ld.designation}</strong></p>
              <p style={{ fontSize: 13 }}>
                Appointed: {formatDate(ld.appointment_date)}
                {ld.end_date ? ` · Term Ended: ${formatDate(ld.end_date)}` : " · Current"}
              </p>
              {ld.previous_designation && <p style={{ fontSize: 13 }}>Previous Role: {ld.previous_designation}</p>}
              {ld.notes && <p>{ld.notes}</p>}
              <div className="ba-card-footer">
                <span>Verified: {formatDate(ld.verified_at)}</span>
                <SourceLink url={ld.source_url} name={ld.source_name} />
              </div>
            </article>
          ))}
        </div>
      ) : tab === "static_gk" ? (
        <div className="ba-card-grid">
          {items.map((gk) => {
            const facts = Array.isArray(gk.key_facts) ? gk.key_facts : [];
            return (
              <article className="panel affair-card" key={gk.id}>
                <div className="affair-card-top">
                  <span className="exam-pill">{gk.topic}</span>
                  <span className={`ca-badge ca-badge--${gk.importance_level}`}>
                    {(gk.importance_level || "important").replace("_", " ")}
                  </span>
                </div>
                <h2>{gk.title}</h2>
                <p>{gk.description}</p>
                {facts.length > 0 && (
                  <ul className="affair-points">
                    {facts.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                )}
                <div className="ba-card-footer">
                  <SourceLink url={gk.source_url} name={gk.source_name} />
                  <FreshnessPill freshness={gk.freshness} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="ba-card-grid">
          {items.map((t) => (
            <article className="panel affair-card" key={t.id}>
              <div className="affair-card-top">
                <span className="exam-pill">{t.category}</span>
                <span className={`ca-badge ca-badge--${t.importance_level}`}>
                  {(t.importance_level || "important").replace("_", " ")}
                </span>
              </div>
              <h2>
                {t.term}
                {t.abbreviation && t.abbreviation.toLowerCase() !== t.term.toLowerCase()
                  ? ` (${t.abbreviation})`
                  : ""}
              </h2>
              {t.full_form && <p style={{ fontSize: 13, color: "#475569" }}><strong>Full form:</strong> {t.full_form}</p>}
              <p>{t.definition}</p>
              {t.example && <div className="affair-static-gk"><strong>Example:</strong> {t.example}</div>}
              <div className="ba-card-footer">
                <SourceLink url={t.source_url} name={t.source_name} />
                <FreshnessPill freshness={t.freshness} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
