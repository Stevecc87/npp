# NeoOhio Underwriter — Valuation Logic Memo (v1)

**Audience:** Acquisitions / real-estate underwriting team  
**Purpose:** Explain, at a practical level, how intake and photo analysis affect cash offer range.

---

## 1) How valuation is produced (high level)

1. Start from **Baseline Market Value** (input by user).
2. Apply **intake-based penalties** (condition, occupancy, systems, etc.).
3. Apply **system repair deductions + haircuts** (electrical/plumbing/foundation).
4. Generate **cash offer low/high** from adjusted value.
5. Apply **photo-analysis adjustment** (condition score + confidence).

This is a transparent rule-based model (not a black-box AVM).

---

## 2) Intake parameters and directional effect

## Occupancy
- Vacant: least friction (no extra occupancy penalty)
- Occupied: modest penalty
- Tenant-occupied: higher penalty

**Reasoning:** tenant/occupancy friction increases execution complexity and timeline risk.

## Timeline
- Immediate timeline improves pursue score
- Flexible timeline slightly reduces pursue score

**Reasoning:** timeline influences dealability more than intrinsic asset value.

## Motivation
- Higher seller motivation increases pursue score (and confidence)
- Lower motivation reduces pursue score

**Reasoning:** motivation changes conversion probability and negotiation leverage.

## Overall Condition
- Excellent → lowest condition penalty
- Good → moderate penalty
- Fair → larger penalty
- Poor → largest penalty

**Reasoning:** broad rehab burden and resale execution risk.

## Kitchen & Bath
- Updated → lowest penalty
- Average → moderate penalty
- Dated → higher penalty

**Reasoning:** major buyer-perception and renovation-cost driver.

## Roof Age
- Newer roof = lower penalty
- Older roof = higher penalty (especially older-lifecycle roofs)

**Reasoning:** near-term capex risk.

## HVAC Age
- Newer HVAC = lower penalty
- Older HVAC = higher penalty

**Reasoning:** replacement probability + operational risk.

## Electrical
- Better condition = lower repair reserve
- Outdated/major issues = higher reserve + haircut

## Plumbing
- Better condition = lower repair reserve
- Outdated/major issues = higher reserve + haircut

## Foundation
- Solid/minor = smaller impact
- Structural/major = large negative impact

**Reasoning (systems):** direct repair dollars + risk discount.

## Water Issues
- "Yes" meaningfully increases penalty

**Reasoning:** potential hidden damage/mold/remediation uncertainty.

---

## 3) Math summary (simplified)

- **Adjusted Value = Baseline Value × (1 − Total Penalty)**
- Then model computes a **low/high target band** off adjusted value
- Then subtracts system repair reserves and applies system haircuts
- Output: **Cash Offer Low / Cash Offer High**

Also produces:
- **Pursue Score** (0–100)
- **Confidence** (model confidence in estimate)

---

## 4) Photo analysis impact

Photo analysis returns:
- Condition Score (0–100)
- Confidence (0–1)
- Update level / rehab tier
- Observations + risk flags

The system then applies a **post-intake adjustment** to offer range and pursue score:
- Better visible condition + high confidence → upward adjustment
- Weaker visible condition / risk flags → downward pressure

---

## 5) Intake vs photos: precedence policy

When photo confidence is high (**>= 0.75**), photo evidence can override intake on:
- Kitchen condition
- Overall condition
- Water issue indicator
- System risk assumptions (major/minor)

This prevents stale or optimistic call notes from overpowering strong visual evidence.

---

## 6) Practical interpretation for team use

- Use model output as **decision support**, not blind autopilot.
- Trust increases when:
  - intake is complete,
  - photos are representative,
  - confidence is high,
  - overrides/notes are consistent with field reality.
- In edge cases, underwriter judgment remains final.

---

## 7) Current model status

- Rule engine is transparent and auditable.
- Photo analysis is integrated with confidence-aware override logic.
- Output includes explanation bullets and observations for traceability.

