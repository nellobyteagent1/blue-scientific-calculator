# Blue Scientific Calculator

A polished static scientific calculator web app with a blue glassmorphism-style interface.

## Features
- Standard arithmetic and parentheses
- Decimal support
- Clear and delete actions
- Scientific functions: `sin`, `cos`, `tan`, `log`, `ln`, `sqrt`
- Constants: `pi`, `e`
- Power operator: `^`
- Percent handling
- DEG/RAD angle modes
- Keyboard shortcuts
- Safe expression evaluation using tokenization + RPN parsing/evaluation (no raw `eval`)

## Run locally
Because it is a static app, you can open `index.html` directly or serve it with a tiny local server:

```bash
cd /root/.openclaw/workspace/main/projects/blue-scientific-calculator
python3 -m http.server 8000
```

Then open:
- `http://127.0.0.1:8000`

## Files
- `index.html`
- `styles.css`
- `script.js`
- `README.md`
