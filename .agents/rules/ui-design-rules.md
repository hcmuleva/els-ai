# UI Design Rules & Guidelines

## 1. NEVER USE SINGLE-SIDED ACCENT BORDERS
- **STRICTLY PROHIBITED**: Do not design cards or containers with a colored border on only one side (e.g., `borderTopWidth: 4`, top colored accent line, `borderLeftWidth: 4`, colored left stripe).
- **Why**: It looks unprofessional, dated, and unmistakably AI-generated.
- **Allowed Alternative**:
  - Always use balanced, uniform borders around cards: `borderWidth: 1`, `borderColor: '#E8ECF4'` (or a subtle neutral border).
  - Express vibrant brand accents using inner elements:
    - Saturated badges / pills with icons (e.g., `<Sparkles size={11} color="#EA580C" /> Creativity`).
    - Soft tinted illustration or icon boxes (`backgroundColor: '#FFE8DF'`).
    - Subtle button accents or clean header tags.

## 2. Card Design Standards
- Uniform `borderWidth: 1` with neutral borders like `#E8ECF4` or `#E2E8F0`.
- Smooth `borderRadius` (16 to 24px).
- Subtle, soft elevation/shadow (`shadowColor: '#1A1D3A'`, opacity `0.04` to `0.06`, radius `8` to `12`).
- Professional, uncluttered layouts with clean padding and clear typography hierarchy.
