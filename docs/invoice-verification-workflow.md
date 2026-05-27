# Invoice Verification Workflow

## Overview

When a new invoice PDF is loaded, the app runs a 3-phase flow before any data is written to Supabase:

```
Phase 1 → Phase 1.5 → Phase 2 → Save (robocza)
Upload     Review      Form       ↓
                                Approve (zatwierdź) → inventory updates
```

**Critical rule**: stock levels are never modified until the user explicitly approves the invoice (`zatwierdź`). Saving creates a `robocza` (draft) invoice only.

---

## Phase 1 — Upload

User selects a PDF. `InvoiceUploader` → `handleReadAI()` → `extractFromFile()` (pdfjs-dist, local only).

If extraction finds line items it enters Phase 1.5. Otherwise it goes straight to Phase 2 (manual form).

---

## Phase 1.5 — Extracted Items Review

### Item statuses

Each extracted item gets an assignment status from `getAssignmentStatus(item, towary)` in `invoicePositionValidator.js`:

| Status | Meaning | Will enter warehouse? |
|--------|---------|----------------------|
| `ready` | Matched product + price > 0 | ✅ Yes, on approval |
| `service_cost` | Marked as service/cost | ❌ No |
| `needs_review` | Match score 0.65–0.84 | ❌ No — save as draft |
| `needs_price` | Price is 0 | ❌ No — save as draft |
| `needs_product` | No product match | ❌ No — save as draft |
| `ignored` | Metadata / header line | ❌ Skipped |

### Product matching thresholds

| Score | Action |
|-------|--------|
| ≥ 0.85 | Auto-matched (`matchedProductId` set) |
| 0.65–0.84 | Suggestion only — requires user confirmation |
| < 0.65 | No match — user must select or create product |

### Per-item actions

- **Usługa** — marks item as `service_item`, clears product match, skips warehouse impact
- **Towar** — restores item to `inventory_item` (can be used after Usługa)
- **+ Towar** — opens the create-product mini-modal (duplicate check → Supabase insert → auto-assign)
- **Pomiń / Przywróć** — excludes / includes item from save

### Contractor detection

`prepareContractorFromInvoice()` extracts contractor from PDF text. `validateContractorFromPdf()` then:

1. Rejects generic names (`sprzedawca`, `nabywca`, etc.) — user must pick manually
2. Validates NIP checksum via `validatePolishNip()`; shows `nContractorNipWarning` on failure
3. Attempts NIP-based match in existing contractors, then name-based fuzzy match
4. Falls back to "new contractor from PDF" — created on invoice save via `ensureContractorForInvoice()`

### Bottom actions

| Scenario | Primary button | Secondary button |
|----------|---------------|-----------------|
| 0 ready items | _(disabled) Brak pozycji gotowych do magazynu_ | Zapisz fakturę roboczą z pozycjami do weryfikacji |
| Some ready, some not | Dodaj X gotowych pozycji → | Zapisz Y do weryfikacji |
| All active are ready | Dodaj wszystkie pozycje → | _(hidden)_ |

**"Pomiń pozycje"** — skip all extracted items, go to manual form.

---

## Phase 2 — Invoice Form

Standard form: numer, data, kontrahent, magazyn, notatki + positions list.

Positions can come from:
- Extracted items (committed from Phase 1.5)
- Draft items (committed via "Zapisz X do weryfikacji")
- Manual additions (`+ Dodaj pozycję`)

**Save** inserts a `robocza` invoice. No warehouse changes.

---

## Security constraints (hard rules)

These rules must never be relaxed without explicit user confirmation:

1. **No auto-approve** — invoice is always saved as `robocza`
2. **No inventory update on save** — only `zatwierdź` triggers stock changes
3. **No auto-create products** — `+ Towar` always requires user interaction and shows duplicate warning
4. **No generic contractor names** — `isGenericContractorName()` blocks "Sprzedawca", "Nabywca", etc.
5. **No trash items as warehouse-ready** — score threshold ≥ 0.85 required for `_towarId` to be set in `mapParsedPozycjaToFormPozycja()`

---

## Key files

| File | Purpose |
|------|---------|
| `src/pages/Faktury.jsx` | Main invoice page + all modal phases |
| `src/utils/invoiceVerificationStatus.js` | Status helpers, contractor validation, blocking reasons |
| `src/utils/invoicePositionValidator.js` | `getAssignmentStatus`, `preparePositionsForInvoiceSave`, `preparePositionsForInvoiceDraft` |
| `src/utils/invoiceLineMapper.js` | `mapParsedPozycjaToFormPozycja` — score threshold gating |
| `src/utils/contractorMatcher.js` | `findMatchingContractor`, `prepareContractorFromInvoice` |
| `src/utils/contractorService.js` | `ensureContractorForInvoice` — create/reuse contractor |
| `src/utils/invoiceValidation.js` | `validatePolishNip` — NIP checksum |
| `src/utils/productNormalizer.js` | `advancedSimilarity` — token + tech-param scoring |
| `src/context/ToastContext.jsx` | Toast notifications: `success`, `error`, `warning`, `info` |

---

## Toast conventions

| Type | When |
|------|------|
| `success` | NIP-matched contractor, all items matched |
| `warning` | Items need matching, invalid NIP, name-matched contractor |
| `info` | New contractor from PDF, draft items added, price alerts |
| `error` | Validation failures, save errors |
