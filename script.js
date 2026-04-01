// State
let expression = '';
let lastResult = null;
let justCalculated = false;
let angleMode = 'deg'; // 'deg' or 'rad'
let memoryValue = 0;
let historyText = '';

// DOM refs
const displayEl = document.getElementById('display');
const expressionEl = document.getElementById('expression');
const historyEl = document.getElementById('history');
const memIndicator = document.getElementById('memory-indicator');

// --- Input Functions ---

function inputChar(ch) {
  if (justCalculated) {
    // If we just got a result and user types a number, start fresh
    if ('0123456789.'.includes(ch)) {
      expression = '';
    }
    justCalculated = false;
  }
  expression += ch;
  updateDisplay();
}

function inputOperator(op) {
  if (justCalculated) {
    // Continue from last result
    expression = String(lastResult);
    justCalculated = false;
  }
  // Avoid double operators
  if (expression && '+-*/^'.includes(expression.slice(-1))) {
    expression = expression.slice(0, -1);
  }
  expression += op;
  updateDisplay();
}

function inputFunc(fn) {
  if (justCalculated) {
    expression = '';
    justCalculated = false;
  }
  expression += fn;
  updateDisplay();
}

function inputConst(name) {
  if (justCalculated) {
    expression = '';
    justCalculated = false;
  }
  if (name === 'pi') expression += 'pi';
  else if (name === 'e') expression += 'e';
  updateDisplay();
}

function inputPercent() {
  if (!expression) return;
  expression += '%';
  updateDisplay();
}

function toggleSign() {
  if (!expression) return;
  // Find the last number in the expression and negate it
  const match = expression.match(/(.*?)(-?\d+\.?\d*)$/);
  if (match) {
    const prefix = match[1];
    const num = match[2];
    if (num.startsWith('-')) {
      expression = prefix + num.slice(1);
    } else {
      expression = prefix + '(-' + num + ')';
    }
    updateDisplay();
  }
}

function deleteLast() {
  if (justCalculated) {
    clearAll();
    return;
  }
  expression = expression.slice(0, -1);
  updateDisplay();
}

function clearAll() {
  expression = '';
  lastResult = null;
  justCalculated = false;
  historyText = '';
  historyEl.textContent = '';
  displayEl.classList.remove('error');
  updateDisplay();
}

// --- Evaluation ---

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    // Skip whitespace
    if (expr[i] === ' ') { i++; continue; }

    // Functions and constants
    if (/[a-z]/i.test(expr[i])) {
      let word = '';
      while (i < expr.length && /[a-z]/i.test(expr[i])) {
        word += expr[i++];
      }
      if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'fact'].includes(word)) {
        tokens.push({ type: 'func', value: word });
      } else if (word === 'pi') {
        tokens.push({ type: 'num', value: Math.PI });
      } else if (word === 'e') {
        tokens.push({ type: 'num', value: Math.E });
      } else {
        throw new Error('Unknown: ' + word);
      }
      continue;
    }

    // Numbers
    if (/[\d.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }

    // Operators and parens
    if ('+-*/^%()'.includes(expr[i])) {
      tokens.push({ type: 'op', value: expr[i] });
      i++;
      continue;
    }

    throw new Error('Unexpected: ' + expr[i]);
  }
  return tokens;
}

// Insert implicit multiplication: 2pi, pi(, )(, 2(, )2, etc.
function insertImplicitMult(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i > 0) {
      const prev = tokens[i - 1];
      const needMult =
        (prev.type === 'num' && t.type === 'num') ||
        (prev.type === 'num' && t.type === 'func') ||
        (prev.type === 'num' && t.value === '(') ||
        (prev.value === ')' && t.type === 'num') ||
        (prev.value === ')' && t.type === 'func') ||
        (prev.value === ')' && t.value === '(') ||
        (prev.value === '%' && t.type === 'num');
      if (needMult) {
        result.push({ type: 'op', value: '*' });
      }
    }
    result.push(t);
  }
  return result;
}

// Recursive descent parser
function parse(tokens) {
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

  function parseExpr() {
    let left = parseTerm();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parsePower();
    while (peek() && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parsePower();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parsePower() {
    let base = parseUnary();
    while (peek() && peek().value === '^') {
      consume();
      const exp = parseUnary();
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary() {
    if (peek() && peek().value === '-') {
      consume();
      return -parseUnary();
    }
    if (peek() && peek().value === '+') {
      consume();
      return parseUnary();
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let val = parsePrimary();
    while (peek() && peek().value === '%') {
      consume();
      val = val / 100;
    }
    return val;
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Unexpected end');

    if (t.type === 'num') {
      consume();
      return t.value;
    }

    if (t.type === 'func') {
      const fn = consume().value;
      // Expect '('
      if (!peek() || peek().value !== '(') throw new Error('Expected (');
      consume(); // (
      const arg = parseExpr();
      if (peek() && peek().value === ')') consume(); // )
      return applyFunc(fn, arg);
    }

    if (t.value === '(') {
      consume();
      const val = parseExpr();
      if (peek() && peek().value === ')') consume();
      return val;
    }

    throw new Error('Unexpected token');
  }

  const result = parseExpr();
  return result;
}

function toRad(deg) { return deg * Math.PI / 180; }

function applyFunc(fn, arg) {
  switch (fn) {
    case 'sin': return Math.sin(angleMode === 'deg' ? toRad(arg) : arg);
    case 'cos': return Math.cos(angleMode === 'deg' ? toRad(arg) : arg);
    case 'tan': return Math.tan(angleMode === 'deg' ? toRad(arg) : arg);
    case 'log': return Math.log10(arg);
    case 'ln': return Math.log(arg);
    case 'sqrt': return Math.sqrt(arg);
    case 'fact': return factorial(Math.round(arg));
    default: throw new Error('Unknown function: ' + fn);
  }
}

function factorial(n) {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function evaluate(expr) {
  if (!expr.trim()) return 0;
  const tokens = tokenize(expr);
  const withMult = insertImplicitMult(tokens);
  return parse(withMult);
}

function calculate() {
  if (!expression) return;
  try {
    displayEl.classList.remove('error');
    const result = evaluate(expression);
    if (isNaN(result)) throw new Error('Invalid');
    historyText = formatExpression(expression) + ' =';
    historyEl.textContent = historyText;
    lastResult = result;
    expression = '';
    expressionEl.textContent = '';
    displayEl.textContent = formatNumber(result);
    displayEl.classList.add('flash');
    setTimeout(() => displayEl.classList.remove('flash'), 400);
    justCalculated = true;
  } catch (e) {
    displayEl.textContent = 'Error';
    displayEl.classList.add('error');
    justCalculated = true;
  }
}

// --- Display ---

function formatNumber(n) {
  if (!isFinite(n)) return String(n);
  // Show up to 10 significant digits
  const s = Number(n.toPrecision(10));
  if (Math.abs(s) >= 1e15 || (Math.abs(s) < 1e-7 && s !== 0)) {
    return n.toExponential(6);
  }
  return String(s);
}

function formatExpression(expr) {
  return expr
    .replace(/\*/g, '\u00D7')
    .replace(/\//g, '\u00F7')
    .replace(/pi/g, '\u03C0');
}

function updateDisplay() {
  expressionEl.textContent = formatExpression(expression);
  if (!expression && lastResult !== null && justCalculated) {
    displayEl.textContent = formatNumber(lastResult);
  } else if (!expression) {
    displayEl.textContent = '0';
  } else {
    // Try to preview the result
    try {
      const preview = evaluate(expression);
      if (!isNaN(preview) && isFinite(preview)) {
        displayEl.textContent = formatNumber(preview);
        displayEl.classList.remove('error');
      }
    } catch {
      // Show last character of expression as feedback
    }
  }
  // Auto-scroll expression
  expressionEl.scrollLeft = expressionEl.scrollWidth;
}

// --- Angle Mode ---

function setAngleMode(mode) {
  angleMode = mode;
  document.getElementById('btn-deg').classList.toggle('active', mode === 'deg');
  document.getElementById('btn-rad').classList.toggle('active', mode === 'rad');
}

// --- Memory ---

function memoryClear() {
  memoryValue = 0;
  memIndicator.classList.remove('visible');
}

function memoryRecall() {
  if (justCalculated) {
    expression = '';
    justCalculated = false;
  }
  expression += String(memoryValue);
  updateDisplay();
}

function memoryAdd() {
  try {
    const val = justCalculated && lastResult !== null ? lastResult : evaluate(expression);
    if (!isNaN(val)) {
      memoryValue += val;
      memIndicator.classList.add('visible');
    }
  } catch {}
}

// --- Keyboard Support ---

document.addEventListener('keydown', function(e) {
  const key = e.key;

  // Prevent default for keys we handle
  if ('0123456789.+-*/^()%'.includes(key) || ['Enter', 'Backspace', 'Delete', 'Escape'].includes(key)) {
    e.preventDefault();
  }

  if ('0123456789.'.includes(key)) {
    inputChar(key);
  } else if (key === '+') {
    inputOperator('+');
  } else if (key === '-') {
    inputOperator('-');
  } else if (key === '*') {
    inputOperator('*');
  } else if (key === '/') {
    inputOperator('/');
  } else if (key === '^') {
    inputOperator('^');
  } else if (key === '(' || key === ')') {
    inputChar(key);
  } else if (key === '%') {
    inputPercent();
  } else if (key === 'Enter' || key === '=') {
    calculate();
  } else if (key === 'Backspace') {
    deleteLast();
  } else if (key === 'Delete' || key === 'Escape') {
    clearAll();
  }
});
